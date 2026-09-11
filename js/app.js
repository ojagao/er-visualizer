/**
 * エントリポイント: ツールバーのイベント配線と初期ロード
 */

const COLUMNS_MODE_LABEL = Object.freeze({
  all: '主要列のみ',
  keysOnly: '全カラム表示',
});

/** 検索語を適用してダイアグラムを再描画 */
function applySearch(rawValue) {
  const searchQuery = rawValue.toLowerCase().trim();
  appState.update({ searchQuery });
  dom.searchClear.classList.toggle('hidden', !searchQuery);
  renderSearchCount();
  renderDiagram();
}

function clearSearch() {
  dom.searchInput.value = '';
  applySearch('');
}

function setupSearch() {
  dom.searchInput.addEventListener('input', (event) => applySearch(event.target.value));
  dom.searchClear.addEventListener('click', clearSearch);
}

/** 列表示モードを状態とボタン表記に反映 (描画は呼び出し側で行う) */
function applyColumnsMode(showOnlyKeys) {
  appState.update({ showOnlyKeys });
  dom.columnsModeText.textContent = showOnlyKeys ? COLUMNS_MODE_LABEL.keysOnly : COLUMNS_MODE_LABEL.all;
  dom.toggleColumnsBtn.setAttribute('aria-pressed', String(showOnlyKeys));
}

/** 主要列のみ / 全カラム 表示を切り替える (ボタンとキーボードショートカットから呼ばれる) */
function toggleColumnsMode() {
  applyColumnsMode(!appState.get().showOnlyKeys);
  renderTables();
  window.setTimeout(renderConnections, APP_CONFIG.timing.toggleRenderMs);
}

function setupColumnsToggle() {
  dom.toggleColumnsBtn.addEventListener('click', toggleColumnsMode);
}

/** 現在のスキーマ・座標を JSON ファイルとしてダウンロード */
function exportSchemaJson() {
  const { schema, positions } = appState.get();
  if (!schema.tables.length) {
    showToast('エクスポートするテーブルがありません', 'error');
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    tables: schema.tables,
    relations: schema.relations,
    positions,
  };

  downloadTextFile(JSON.stringify(payload, null, 2), `schema-er-diagram-${Date.now()}.json`, 'application/json');
  showToast(`JSON をダウンロードしました (${schema.tables.length} テーブル)`, 'success');
}

function setupToolbar() {
  dom.btnAutoLayout.addEventListener('click', runAutoLayout);
  dom.btnExportJson.addEventListener('click', exportSchemaJson);
  dom.btnExportMermaid.addEventListener('click', copyMermaidToClipboard);
  setupSearch();
  setupColumnsToggle();
}

/** 初期ロード: ブログ / CMS サンプルを自動読み込み */
function loadDefaultSchema() {
  const sql = SCHEMA_PRESETS.blog;
  setSqlInput(sql);
  dom.optInferFk.checked = true;
  const parsed = UniversalDDLParser.parse(sql, { inferFk: true });
  applyParsedSchema(parsed, APP_CONFIG.timing.initialRenderMs, { source: { sql, inferFk: true } });
}

/** 前回の作業状態があれば復元する (復元できた場合 true) */
function restoreWorkspace() {
  const snapshot = loadWorkspaceSnapshot();
  if (!snapshot) return false;

  const parsed = UniversalDDLParser.parse(snapshot.sql, { inferFk: snapshot.inferFk });
  if (!parsed.tables.length) return false;

  setSqlInput(snapshot.sql);
  dom.optInferFk.checked = snapshot.inferFk;
  applyColumnsMode(snapshot.showOnlyKeys);
  applyParsedSchema(parsed, APP_CONFIG.timing.initialRenderMs, {
    source: { sql: snapshot.sql, inferFk: snapshot.inferFk },
    positions: snapshot.positions,
    view: snapshot.view,
  });
  return true;
}

function init() {
  setupZoomSettings();
  setupViewportInteractions();
  setupSchemaModal();
  setupToolbar();
  setupKeyboardShortcuts();
  setupSearchNavigation();
  setupFileImport();
  setupDetailPanel();
  window.addEventListener('resize', renderConnections);

  if (!restoreWorkspace()) loadDefaultSchema();
  setupWorkspaceAutosave();
}

window.addEventListener('load', init);
