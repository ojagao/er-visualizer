/**
 * テーブルカードのドラッグ移動
 *
 * - カラム一覧 (data-scroll-area) 上ではスクロールを優先しドラッグしない
 * - しきい値以上動いた場合のみ「ドラッグ」とみなし、click による選択トグルを抑止する
 */
function setupCardDrag(card, tableId, onMove) {
  let session = null;

  card.addEventListener('pointerdown', (event) => {
    if (event.target.closest('[data-scroll-area]')) return;
    event.stopPropagation();

    const origin = appState.get().positions[tableId] || { x: 0, y: 0 };
    session = {
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    };
    card.dataset.dragged = 'false';
    card.setPointerCapture(event.pointerId);
  });

  card.addEventListener('pointermove', (event) => {
    if (!session) return;

    const { scale } = appState.get().view;
    const dx = (event.clientX - session.startX) / scale;
    const dy = (event.clientY - session.startY) / scale;
    const threshold = APP_CONFIG.drag.thresholdPx;
    const moved = session.moved || Math.abs(dx) > threshold || Math.abs(dy) > threshold;

    session = { ...session, moved };
    if (!moved) return;

    card.dataset.dragged = 'true';
    const next = {
      x: Math.round(session.originX + dx),
      y: Math.round(session.originY + dy),
    };
    setTablePosition(tableId, next);
    card.style.left = `${next.x}px`;
    card.style.top = `${next.y}px`;
    onMove();
  });

  const endDrag = () => {
    session = null;
  };
  card.addEventListener('pointerup', endDrag);
  card.addEventListener('pointercancel', endDrag);
}
