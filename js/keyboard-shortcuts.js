/**
 * キーボードショートカット
 *
 * - 入力欄 (input / textarea / contentEditable) にフォーカスがある間は Escape 以外無効
 * - Ctrl / Cmd / Alt 付きのキーはブラウザ既定の動作を優先して無視
 * - モーダル表示中は Escape (モーダル側で処理) 以外無効
 */

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

// run は呼び出し時に解決させるため、必ずアロー関数で包む (読み込み順に依存しない)
const KEYBOARD_SHORTCUTS = Object.freeze([
  { id: 'zoom-in', keys: ['+', '='], hint: '+', description: 'ズームイン', run: () => zoomByFactor(APP_CONFIG.zoom.buttonStep) },
  { id: 'zoom-out', keys: ['-', '_'], hint: '−', description: 'ズームアウト', run: () => zoomByFactor(1 / APP_CONFIG.zoom.buttonStep) },
  { id: 'fit', keys: ['0'], hint: '0', description: '全体表示', run: () => fitToScreen() },
  { id: 'auto-layout', keys: ['a', 'A'], hint: 'A', description: '自動整列', run: () => runAutoLayout() },
  { id: 'toggle-columns', keys: ['k', 'K'], hint: 'K', description: '主要列のみ / 全カラム', run: () => toggleColumnsMode() },
  { id: 'focus-search', keys: ['/'], hint: '/', description: '検索', run: () => focusSearchInput() },
  { id: 'open-sql', keys: ['i', 'I'], hint: 'I', description: 'SQL 入力', run: () => openSchemaModal() },
  { id: 'escape', keys: ['Escape'], hint: 'Esc', description: '選択解除 / 閉じる', allowInEditable: true, run: () => handleEscapeKey() },
]);

// ツールバーのボタンとショートカットの対応 (title にキーを追記する)
const SHORTCUT_BUTTONS = Object.freeze({
  'zoom-in': 'btnZoomIn',
  'zoom-out': 'btnZoomOut',
  fit: 'btnFit',
  'auto-layout': 'btnAutoLayout',
  'toggle-columns': 'toggleColumnsBtn',
  'open-sql': 'btnOpenSchemaModal',
});

function isEditableTarget(target) {
  if (!target) return false;
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable === true;
}

/** キーイベントに対応するショートカット定義を返す (該当なしは null) */
function resolveShortcut(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;

  const editable = isEditableTarget(event.target);
  return (
    KEYBOARD_SHORTCUTS.find(
      (shortcut) => shortcut.keys.includes(event.key) && (!editable || shortcut.allowInEditable),
    ) || null
  );
}

function focusSearchInput() {
  dom.searchInput.focus();
  dom.searchInput.select();
}

/** Escape: 検索欄にいればクリアして離れる、それ以外は選択解除 */
function handleEscapeKey() {
  if (isSchemaModalOpen()) return; // モーダル側の Escape 処理に任せる

  if (document.activeElement === dom.searchInput) {
    if (dom.searchInput.value) clearSearch();
    dom.searchInput.blur();
    return;
  }

  if (appState.get().selectedTableId) {
    clearSelectedTable();
    renderDiagram();
  }
}

/** ボタンの title にキーを追記し、凡例にヒント一覧を表示 */
function renderShortcutHints() {
  KEYBOARD_SHORTCUTS.forEach((shortcut) => {
    const button = dom[SHORTCUT_BUTTONS[shortcut.id]];
    if (!button) return;
    const base = button.title || shortcut.description;
    button.title = `${base} (${shortcut.hint})`;
  });

  dom.shortcutHints.textContent = KEYBOARD_SHORTCUTS.map((s) => `${s.hint} ${s.description}`).join('  ·  ');
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (event) => {
    const shortcut = resolveShortcut(event);
    if (!shortcut) return;
    if (shortcut.id !== 'escape' && isSchemaModalOpen()) return;

    event.preventDefault();
    shortcut.run();
  });

  renderShortcutHints();
}
