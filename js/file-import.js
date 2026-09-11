/**
 * ファイル読み込み (SQL / エクスポート済み JSON)
 *
 * - モーダルの「ファイルを開く」ボタン、または画面のどこかへドラッグ&ドロップで読み込む
 * - .sql / .ddl / .txt はテキストエリアに入れて即座にパース
 * - 本アプリでエクスポートした JSON はテーブル・リレーション・座標をそのまま復元
 */

const SQL_IMPORT_ACCEPT = '.sql,.ddl,.txt,.json,text/plain,application/json';

const isFiniteNum = (value) => typeof value === 'number' && Number.isFinite(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

/** ファイル名と中身から読み込み種別を判定 */
function detectImportKind(fileName, content) {
  if (/\.json$/i.test(fileName || '')) return 'json';
  const head = String(content || '').trimStart();
  return head.startsWith('{') && /"tables"\s*:/.test(head) ? 'json' : 'sql';
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeImportedColumn(col) {
  return {
    name: col.name,
    type: isNonEmptyString(col.type) ? col.type : 'text',
    pk: Boolean(col.pk),
    fk: isNonEmptyString(col.fk) ? col.fk : null,
    notNull: Boolean(col.notNull),
    unique: Boolean(col.unique),
    default: col.default ?? null,
  };
}

function isImportableTable(table) {
  return (
    Boolean(table) &&
    isNonEmptyString(table.id) &&
    isNonEmptyString(table.name) &&
    Array.isArray(table.columns) &&
    table.columns.every((col) => col && isNonEmptyString(col.name))
  );
}

function isImportableRelation(rel) {
  return (
    Boolean(rel) &&
    isNonEmptyString(rel.from) &&
    isNonEmptyString(rel.to) &&
    isNonEmptyString(rel.fromCol) &&
    isNonEmptyString(rel.toCol)
  );
}

/**
 * エクスポート JSON を検証し、描画に使える形へ正規化
 * @returns {{ok: true, diagram: {tables: object[], relations: object[], positions: object}} | {ok: false, error: string}}
 */
function validateExportedDiagram(data) {
  if (!data || typeof data !== 'object') return { ok: false, error: 'JSON の形式が不正です' };
  if (!Array.isArray(data.tables) || !data.tables.length) return { ok: false, error: 'tables が空か存在しません' };
  if (!data.tables.every(isImportableTable)) return { ok: false, error: 'tables に不正な要素があります (id / name / columns が必要)' };

  const tables = data.tables.map((table) => ({
    ...table,
    columns: table.columns.map(normalizeImportedColumn),
  }));
  const relations = (Array.isArray(data.relations) ? data.relations : [])
    .filter(isImportableRelation)
    .map((rel) => ({ ...rel, inferred: Boolean(rel.inferred) }));
  const positions = Object.fromEntries(
    Object.entries(data.positions || {}).filter(([, p]) => p && isFiniteNum(p.x) && isFiniteNum(p.y)),
  );

  return { ok: true, diagram: { tables, relations, positions } };
}

/** 検証済みの JSON ダイアグラムを状態へ反映 (座標が無いテーブルは自動レイアウトで補う) */
function applyImportedDiagram(diagram) {
  // SQL 本文を持たないため自動保存 (SQL を再パースして復元) の対象外にする
  appState.update({
    schema: { tables: diagram.tables, relations: diagram.relations },
    source: null,
    selectedTableId: null,
  });

  const layout = arrangeTables();
  appState.update({
    positions: Object.fromEntries(
      diagram.tables.map((table) => [table.id, diagram.positions[table.id] || layout[table.id]]),
    ),
  });

  renderTables();
  scheduleFitAndConnections(APP_CONFIG.timing.parseRenderMs);
}

function importDiagramJson(content, fileName) {
  const result = validateExportedDiagram(safeJsonParse(content));
  if (!result.ok) {
    openSchemaModal();
    setParseStatus(`${fileName}: ${result.error}`, 'error');
    return;
  }

  applyImportedDiagram(result.diagram);
  closeSchemaModal();
  showToast(`${fileName} から ${result.diagram.tables.length} テーブルを復元しました (JSON 由来のため自動保存の対象外)`, 'success');
}

function importSqlText(content, fileName) {
  setSqlInput(content);
  openSchemaModal();
  setParseStatus(`${fileName} を読み込みました (${content.length.toLocaleString()} 文字)`, 'info');
  handleParseAndRender();
  // パース成功時はモーダルが閉じるので、結果をトーストで知らせる
  if (!isSchemaModalOpen()) {
    showToast(`${fileName} を読み込みました (${appState.get().schema.tables.length} テーブル)`, 'success');
  }
}

/** File オブジェクトを読み込んで種別に応じて処理 */
async function importFile(file) {
  if (!file) return;

  const { maxFileBytes } = APP_CONFIG.fileImport;
  if (file.size > maxFileBytes) {
    openSchemaModal();
    setParseStatus(`${file.name} は大きすぎます (上限 ${Math.round(maxFileBytes / 1024 / 1024)} MB)`, 'error');
    return;
  }

  try {
    const content = await file.text();
    if (detectImportKind(file.name, content) === 'json') {
      importDiagramJson(content, file.name);
    } else {
      importSqlText(content, file.name);
    }
  } catch (error) {
    console.error('File import failed:', error);
    openSchemaModal();
    setParseStatus(`${file.name} の読み込みに失敗しました: ${error.message}`, 'error');
  }
}

const hasFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');

/** 画面全体へのドラッグ&ドロップ (オーバーレイ表示付き) */
function setupDropZone() {
  let depth = 0;

  window.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    depth += 1;
    dom.dropOverlay.hidden = false;
  });

  window.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault(); // ドロップを許可
  });

  window.addEventListener('dragleave', (event) => {
    if (!hasFiles(event)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) dom.dropOverlay.hidden = true;
  });

  window.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth = 0;
    dom.dropOverlay.hidden = true;
    importFile(event.dataTransfer.files[0]);
  });
}

function setupFileImport() {
  dom.fileInput.accept = SQL_IMPORT_ACCEPT;
  dom.btnOpenFile.addEventListener('click', () => dom.fileInput.click());
  dom.fileInput.addEventListener('change', () => {
    importFile(dom.fileInput.files[0]);
    dom.fileInput.value = ''; // 同じファイルを再選択しても change が発火するように
  });
  setupDropZone();
}
