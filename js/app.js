/**
 * エントリポイント: ツールバーのイベント配線と初期ロード
 */

const COLUMNS_MODE_LABEL = Object.freeze({
  all: '主要列のみ',
  keysOnly: '全カラム表示',
});

function setupSearch() {
  const applySearch = (rawValue) => {
    const searchQuery = rawValue.toLowerCase().trim();
    appState.update({ searchQuery });
    dom.searchClear.classList.toggle('hidden', !searchQuery);
    renderDiagram();
  };

  dom.searchInput.addEventListener('input', (event) => applySearch(event.target.value));
  dom.searchClear.addEventListener('click', () => {
    dom.searchInput.value = '';
    applySearch('');
  });
}

function setupColumnsToggle() {
  dom.toggleColumnsBtn.addEventListener('click', () => {
    const { showOnlyKeys } = appState.update((state) => ({ showOnlyKeys: !state.showOnlyKeys }));
    dom.columnsModeText.textContent = showOnlyKeys ? COLUMNS_MODE_LABEL.keysOnly : COLUMNS_MODE_LABEL.all;
    renderTables();
    window.setTimeout(renderConnections, APP_CONFIG.timing.toggleRenderMs);
  });
}

/** 現在のスキーマ・座標を JSON ファイルとしてダウンロード */
function exportSchemaJson() {
  const { schema, positions } = appState.get();
  const payload = {
    exportedAt: new Date().toISOString(),
    tables: schema.tables,
    relations: schema.relations,
    positions,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `schema-er-diagram-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function setupToolbar() {
  dom.btnAutoLayout.addEventListener('click', runAutoLayout);
  dom.btnExportJson.addEventListener('click', exportSchemaJson);
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
  window.addEventListener('resize', renderConnections);
  loadDefaultSchema();
}

window.addEventListener('load', init);
