/**
 * ホバー時のリレーション強調
 *
 * - カードにポインタを乗せると、そのテーブルに繋がる接続線を強調表示 (選択とは独立)
 * - 接続線自体もホバーで強調され、<title> によるツールチップで参照元 / 参照先を表示
 * - 状態は再描画せず DOM のクラス切替だけで反映するため、ドラッグ中でもちらつかない
 */

let hoveredTableId = null;

/** 現在ホバー中のテーブルに繋がる接続線へ is-hover クラスを付与 */
function applyHoverHighlight() {
  dom.relationsGroup.querySelectorAll('.relation').forEach((group) => {
    const related =
      hoveredTableId !== null &&
      (group.dataset.from === hoveredTableId || group.dataset.to === hoveredTableId);
    group.classList.toggle('is-hover', related);
  });
}

function setHoveredTable(tableId) {
  if (hoveredTableId === tableId) return;
  hoveredTableId = tableId;
  applyHoverHighlight();
}

/** カードにホバー用リスナーを登録 */
function setupCardHover(card, tableId) {
  card.addEventListener('pointerenter', () => setHoveredTable(tableId));
  card.addEventListener('pointerleave', () => setHoveredTable(null));
}
