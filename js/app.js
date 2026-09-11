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

/** 主要列のみ / 全カラム 表示を切り替える */
function toggleColumnsMode() {
  const { showOnlyKeys } = appState.update((state) => ({ showOnlyKeys: !state.showOnlyKeys }));
  dom.columnsModeText.textContent = showOnlyKeys ? COLUMNS_MODE_LABEL.keysOnly : COLUMNS_MODE_LABEL.all;
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
  setSqlInput(SCHEMA_PRESETS.blog);
  const parsed = UniversalDDLParser.parse(SCHEMA_PRESETS.blog, { inferFk: true });
  applyParsedSchema(parsed, APP_CONFIG.timing.initialRenderMs);
}

function init() {
  setupViewportInteractions();
  setupSchemaModal();
  setupToolbar();
  setupKeyboardShortcuts();
  setupSearchNavigation();
  window.addEventListener('resize', renderConnections);
  loadDefaultSchema();
}

window.addEventListener('load', init);
