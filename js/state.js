/**
 * アプリケーション状態 (イミュータブル更新)
 *
 * 状態オブジェクトは直接変更せず、appState.update() で新しいオブジェクトに差し替える。
 */
const createInitialState = () => ({
  schema: { tables: [], relations: [] },
  positions: {},
  view: { ...APP_CONFIG.view },
  selectedTableId: null,
  searchQuery: '',
  showOnlyKeys: false,
});

const appState = (() => {
  let current = createInitialState();

  return Object.freeze({
    /** 現在の状態 (読み取り専用として扱う) */
    get: () => current,

    /**
     * 状態を部分更新して新しい状態を返す
     * @param {object | ((state: object) => object)} patch
     */
    update(patch) {
      const next = typeof patch === 'function' ? patch(current) : patch;
      current = { ...current, ...next };
      return current;
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
