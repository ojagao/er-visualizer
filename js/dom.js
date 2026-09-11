/**
 * DOM 要素参照 (スクリプトは body 末尾で読み込まれるため、この時点で要素は存在する)
 */
const byId = (id) => document.getElementById(id);

const dom = Object.freeze({
  // キャンバス
  workspace: byId('workspace'),
  viewport: byId('viewport'),
  tablesContainer: byId('tables-container'),
  relationsGroup: byId('relations-group'),

  // ヘッダーツールバー
  tableCountBadge: byId('table-count-badge'),
  btnOpenSchemaModal: byId('btn-open-schema-modal'),
  btnAutoLayout: byId('btn-auto-layout'),
  searchInput: byId('search-input'),
  searchClear: byId('search-clear'),
  searchCount: byId('search-count'),
  toggleColumnsBtn: byId('toggle-columns-btn'),
  columnsModeText: byId('columns-mode-text'),
  btnZoomIn: byId('btn-zoom-in'),
  btnZoomOut: byId('btn-zoom-out'),
  btnFit: byId('btn-fit'),
  zoomLabel: byId('zoom-label'),
  btnExportJson: byId('btn-export-json'),
  btnExportMermaid: byId('btn-export-mermaid'),

  // 通知
  toastContainer: byId('toast-container'),

  // 凡例
  shortcutHints: byId('shortcut-hints'),

  // スキーマ入力モーダル
  schemaModal: byId('schema-modal'),
  btnCloseModal: byId('btn-close-modal'),
  btnCancelModal: byId('btn-cancel-modal'),
  btnParseAndRender: byId('btn-parse-and-render'),
  presetBlog: byId('preset-blog'),
  presetEcommerce: byId('preset-ecommerce'),
  presetClear: byId('preset-clear'),
  sqlInput: byId('sql-input'),
  sqlStats: byId('sql-stats'),
  optInferFk: byId('opt-infer-fk'),
  parseStatusMsg: byId('parse-status-msg'),
});
