/**
 * ビューポート操作 (パン・ズーム・全体表示)
 */

function clampScale(scale) {
  return Math.min(Math.max(APP_CONFIG.zoom.min, scale), APP_CONFIG.zoom.max);
}

/** 状態の view を DOM に反映 */
function updateTransform() {
  const { scale, translateX, translateY } = appState.get().view;
  dom.viewport.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  dom.zoomLabel.textContent = `${Math.round(scale * 100)}%`;
}

/** 画面上の点 (pivot) を固定したままズーム */
function zoomAt(nextScaleRaw, pivotX, pivotY) {
  const { view } = appState.get();
  const nextScale = clampScale(nextScaleRaw);
  const ratio = nextScale / view.scale;

  setView({
    scale: nextScale,
    translateX: pivotX - (pivotX - view.translateX) * ratio,
    translateY: pivotY - (pivotY - view.translateY) * ratio,
  });
  updateTransform();
}

/** ボタンズームは画面中央を基準にする */
function zoomByFactor(factor) {
  const rect = dom.workspace.getBoundingClientRect();
  zoomAt(appState.get().view.scale * factor, rect.width / 2, rect.height / 2);
}

/** 全テーブルカードを含む外接矩形 (論理座標) */
function getDiagramBounds() {
  const { schema, positions } = appState.get();
  const boxes = schema.tables.map((t) => getCardBox(t.id, positions)).filter(Boolean);
  if (!boxes.length) return null;

  return {
    minX: Math.min(...boxes.map((b) => b.x)),
    minY: Math.min(...boxes.map((b) => b.y)),
    maxX: Math.max(...boxes.map((b) => b.x + b.width)),
    maxY: Math.max(...boxes.map((b) => b.y + b.height)),
  };
}

/** ビューの変更をアニメーション付きで反映 (ホイール / ドラッグ操作では使わない) */
function animateViewTo(viewPatch) {
  const { viewAnimationMs } = APP_CONFIG.timing;
  dom.viewport.style.transition = `transform ${viewAnimationMs}ms ease`;
  setView(viewPatch);
  updateTransform();
  window.setTimeout(() => {
    dom.viewport.style.transition = '';
  }, viewAnimationMs);
}

/**
 * 指定テーブルが画面中央に来るよう移動 (小さすぎる倍率なら読みやすい倍率まで拡大)
 * 詳細パネルが開いている場合は、パネルに隠れない領域の中央へ寄せる
 */
function centerOnTable(tableId) {
  const { positions, view } = appState.get();
  const box = getCardBox(tableId, positions);
  if (!box) return;

  const scale = Math.max(view.scale, APP_CONFIG.zoom.focusMinScale);
  const panelWidth = dom.detailPanel && !dom.detailPanel.hidden ? APP_CONFIG.detailPanel.widthPx : 0;
  const visibleWidth = Math.max(dom.workspace.clientWidth - panelWidth, dom.workspace.clientWidth / 2);

  animateViewTo({
    scale,
    translateX: visibleWidth / 2 - (box.x + box.width / 2) * scale,
    translateY: dom.workspace.clientHeight / 2 - (box.y + box.height / 2) * scale,
  });
}

/** ダイアグラム全体が画面に収まるようズーム・パンを調整 */
function fitToScreen() {
  const bounds = getDiagramBounds();
  if (!bounds) return;

  const { fitMin, fitMax, fitPadding } = APP_CONFIG.zoom;
  const width = dom.workspace.clientWidth;
  const height = dom.workspace.clientHeight;
  const diagramWidth = Math.max(1, bounds.maxX - bounds.minX);
  const diagramHeight = Math.max(1, bounds.maxY - bounds.minY);

  const rawScale = Math.min((width - fitPadding) / diagramWidth, (height - fitPadding) / diagramHeight);
  const scale = Math.min(Math.max(fitMin, rawScale), fitMax);

  animateViewTo({
    scale,
    translateX: (width - diagramWidth * scale) / 2 - bounds.minX * scale,
    translateY: (height - diagramHeight * scale) / 2 - bounds.minY * scale,
  });
}

/** 背景ドラッグによるパン */
function setupPanning() {
  let panSession = null;

  dom.workspace.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.draggable-card') || event.target.closest('[data-no-pan]')) return;

    const { view, selectedTableId } = appState.get();
    panSession = {
      offsetX: event.clientX - view.translateX,
      offsetY: event.clientY - view.translateY,
    };
    dom.workspace.style.cursor = 'grabbing';

    if (selectedTableId) {
      clearSelectedTable();
      renderDiagram();
    }
  });

  window.addEventListener('pointermove', (event) => {
    if (!panSession) return;
    setView({
      translateX: event.clientX - panSession.offsetX,
      translateY: event.clientY - panSession.offsetY,
    });
    updateTransform();
  });

  const stopPanning = () => {
    if (!panSession) return;
    panSession = null;
    dom.workspace.style.cursor = 'default';
  };
  window.addEventListener('pointerup', stopPanning);
  window.addEventListener('pointercancel', stopPanning);
}

/** deltaMode (px / 行 / ページ) を px 相当の deltaY に正規化 */
function normalizeWheelDelta(event) {
  const { lineDeltaPx, pageDeltaPx } = APP_CONFIG.zoom;
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * lineDeltaPx;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * pageDeltaPx;
  return event.deltaY;
}

/**
 * ホイール 1 イベント分のズーム倍率
 * deltaY の大きさに比例させ (小刻みなトラックパッド入力でも滑らか)、
 * 1 イベントあたりの倍率は wheelMaxFactor で頭打ちにする
 */
function wheelZoomFactor(event, wheelSensitivity = APP_CONFIG.zoom.wheelSensitivity) {
  const { wheelMaxFactor } = APP_CONFIG.zoom;
  const raw = Math.exp(-normalizeWheelDelta(event) * wheelSensitivity);
  return Math.min(Math.max(1 / wheelMaxFactor, raw), wheelMaxFactor);
}

/** マウスホイールでカーソル位置を中心にズーム */
function setupWheelZoom() {
  dom.workspace.addEventListener(
    'wheel',
    (event) => {
      if (event.target.closest('[data-no-zoom]')) return; // 詳細パネル内のスクロールを優先
      event.preventDefault();
      const rect = dom.workspace.getBoundingClientRect();
      zoomAt(
        appState.get().view.scale * wheelZoomFactor(event, getZoomLevel().wheelSensitivity),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    },
    { passive: false },
  );
}

function setupZoomButtons() {
  dom.btnZoomIn.addEventListener('click', () => zoomByFactor(getZoomLevel().buttonStep));
  dom.btnZoomOut.addEventListener('click', () => zoomByFactor(1 / getZoomLevel().buttonStep));
  dom.btnFit.addEventListener('click', fitToScreen);
}

function setupViewportInteractions() {
  setupPanning();
  setupWheelZoom();
  setupZoomButtons();
  updateTransform();
}
