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

/** パース結果を状態へ反映し、自動レイアウトして描画 */
function applyParsedSchema(parsed, delayMs) {
  appState.update({ schema: parsed, selectedTableId: null });
  appState.update({ positions: arrangeTables() });
  renderTables();
  scheduleFitAndConnections(delayMs);
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
