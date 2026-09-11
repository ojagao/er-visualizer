/**
 * アプリケーション状態 (イミュータブル更新)
 *
 * 状態オブジェクトは直接変更せず、appState.update() で新しいオブジェクトに差し替える。
 */
const createInitialState = () => ({
  schema: { tables: [], relations: [] },
  // スキーマの出典 (自動保存・再パース用) { sql, inferFk }
  source: null,
  positions: {},
  view: { ...APP_CONFIG.view },
  selectedTableId: null,
  searchQuery: '',
  showOnlyKeys: false,
});

const appState = (() => {
  let current = createInitialState();
  const listeners = new Set();

  return Object.freeze({
    /** 現在の状態 (読み取り専用として扱う) */
    get: () => current,

    /**
     * 状態を部分更新して新しい状態を返す。更新後に購読者へ通知する
     * @param {object | ((state: object) => object)} patch
     */
    update(patch) {
      const next = typeof patch === 'function' ? patch(current) : patch;
      current = { ...current, ...next };
      listeners.forEach((listener) => listener(current));
      return current;
    },

    /** 状態更新の購読。戻り値を呼ぶと解除 */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
})();

/** テーブル 1 件の座標を更新 */
function setTablePosition(tableId, position) {
  return appState.update((state) => ({
    positions: { ...state.positions, [tableId]: { x: position.x, y: position.y } },
  }));
}

/** ビュー (ズーム・パン) を部分更新 */
function setView(viewPatch) {
  return appState.update((state) => ({ view: { ...state.view, ...viewPatch } }));
}

/** テーブル選択をトグル */
function toggleSelectedTable(tableId) {
  return appState.update((state) => ({
    selectedTableId: state.selectedTableId === tableId ? null : tableId,
  }));
}

function clearSelectedTable() {
  return appState.update({ selectedTableId: null });
}
