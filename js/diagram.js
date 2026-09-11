/**
 * ダイアグラム全体の描画オーケストレーション
 */

/** カードと接続線をまとめて再描画 */
function renderDiagram() {
  renderTables();
  renderConnections();
}

/** Tailwind CDN のスタイル適用を待ってから全体表示 + 接続線描画 */
function scheduleFitAndConnections(delayMs) {
  window.setTimeout(() => {
    fitToScreen();
    renderConnections();
  }, delayMs);
}

/** 現在の表示モードに合わせたカード高さ推定 */
function estimateCurrentCardHeight(table) {
  return estimateCardHeight(table, appState.get().showOnlyKeys);
}

/** 現在のスキーマに対して自動レイアウトを計算 */
function arrangeTables() {
  const { schema } = appState.get();
  return DiagramAutoLayout.arrange(schema.tables, schema.relations, estimateCurrentCardHeight);
}

/**
 * パース結果を状態へ反映して描画
 * @param {object} parsed パース結果 { tables, relations }
 * @param {number} delayMs 接続線描画 / 全体表示までの待ち時間
 * @param {{source?: {sql: string, inferFk: boolean}|null, positions?: object|null, view?: object|null}} [options]
 *   positions / view を渡すと自動レイアウト・全体表示の代わりにそれを復元する
 */
function applyParsedSchema(parsed, delayMs, options = {}) {
  const { source = null, positions = null, view = null } = options;

  appState.update({ schema: parsed, source, selectedTableId: null });
  appState.update((state) => ({
    positions: positions ? mergePositions(arrangeTables(), positions, state.schema.tables) : arrangeTables(),
  }));

  if (view) {
    setView(view);
    updateTransform();
  }

  renderTables();

  if (view) {
    window.setTimeout(renderConnections, delayMs);
  } else {
    scheduleFitAndConnections(delayMs);
  }
}

/** 自動整列ボタン */
function runAutoLayout() {
  appState.update({ positions: arrangeTables() });
  renderTables();
  fitToScreen();
  renderConnections();
}

// カードサイズの変化 (スタイル遅延適用・表示モード切替など) に追従して接続線を再描画
const cardResizeObserver =
  typeof ResizeObserver === 'function' ? new ResizeObserver(() => renderConnections()) : null;

function observeCardResizes(cards) {
  if (!cardResizeObserver) return;
  cardResizeObserver.disconnect();
  cards.forEach((card) => cardResizeObserver.observe(card));
}
