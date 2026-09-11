/**
 * リレーション接続線 (SVG ベジェ曲線) の描画
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const RELATION_COLORS = Object.freeze({
  explicit: '#64748b',
  inferred: '#a855f7',
  highlight: '#38bdf8',
});

const RELATION_STYLE = Object.freeze({
  highlight: { strokeWidth: '3', dash: '6 4', opacity: '1', marker: 'url(#marker-arrow-highlight)' },
  normal: { strokeWidth: '1.8', dash: '5 3', opacity: '0.8', marker: 'url(#marker-arrow)' },
  dimmedOpacity: '0.12',
});

/** カードの実寸 (DOM) と論理座標からボックスを得る */
function getCardBox(tableId, positions) {
  const card = document.getElementById(`table-card-${tableId}`);
  const position = positions[tableId];
  if (!card || !position) return null;

  return {
    x: position.x,
    y: position.y,
    width: card.offsetWidth || APP_CONFIG.card.width,
    height: card.offsetHeight || APP_CONFIG.card.fallbackHeight,
  };
}

const boxCenter = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/** 2 つのカードの相対位置から線の始点・終点を決める */
function computeAnchors(boxA, boxB) {
  const centerA = boxCenter(boxA);
  const centerB = boxCenter(boxB);
  const threshold = APP_CONFIG.connection.sideThresholdPx;

  if (centerA.x < centerB.x - threshold) {
    return { start: { x: boxA.x + boxA.width, y: centerA.y }, end: { x: boxB.x, y: centerB.y } };
  }
  if (centerA.x > centerB.x + threshold) {
    return { start: { x: boxA.x, y: centerA.y }, end: { x: boxB.x + boxB.width, y: centerB.y } };
  }

  const aIsAbove = centerA.y < centerB.y;
  return {
    start: { x: centerA.x, y: aIsAbove ? boxA.y + boxA.height : boxA.y },
    end: { x: centerB.x, y: aIsAbove ? boxB.y : boxB.y + boxB.height },
  };
}

function buildCurvePath(start, end) {
  const { curveX, curveY } = APP_CONFIG.connection;
  const dx = Math.abs(end.x - start.x) * curveX;
  const dy = Math.abs(end.y - start.y) * curveY;
  const signX = end.x > start.x ? 1 : -1;
  const signY = end.y > start.y ? 1 : -1;

  return [
    `M ${start.x} ${start.y}`,
    `C ${start.x + signX * dx} ${start.y + signY * dy},`,
    `${end.x - signX * dx} ${end.y - signY * dy},`,
    `${end.x} ${end.y}`,
  ].join(' ');
}

/** 選択状態に応じた線のスタイル属性を決める */
function resolveRelationAttributes(rel, selectedTableId) {
  const connected = Boolean(selectedTableId) && (rel.from === selectedTableId || rel.to === selectedTableId);

  if (connected) {
    const style = RELATION_STYLE.highlight;
    return {
      stroke: RELATION_COLORS.highlight,
      'stroke-width': style.strokeWidth,
      'stroke-dasharray': rel.inferred ? style.dash : 'none',
      opacity: style.opacity,
      'marker-end': style.marker,
    };
  }

  const style = RELATION_STYLE.normal;
  return {
    stroke: rel.inferred ? RELATION_COLORS.inferred : RELATION_COLORS.explicit,
    'stroke-width': style.strokeWidth,
    'stroke-dasharray': rel.inferred ? style.dash : 'none',
    opacity: selectedTableId ? RELATION_STYLE.dimmedOpacity : style.opacity,
    'marker-end': style.marker,
  };
}

/** ツールチップ用の説明文 (例: posts.author_id → users.id) */
function describeRelation(rel) {
  const suffix = rel.inferred ? ' (命名規則から推測)' : '';
  return `${rel.from}.${rel.fromCol} → ${rel.to}.${rel.toCol}${suffix}`;
}

function createSvgElement(tagName, attributes) {
  const element = document.createElementNS(SVG_NS, tagName);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

/**
 * 1 本のリレーションを <g class="relation"> として生成
 * - .relation-hit: 太い透明パス (ホバー判定用)
 * - .relation-path: 実際に描画される線
 * - <title>: ネイティブツールチップ
 */
function createRelationGroup(rel, state) {
  const boxA = getCardBox(rel.from, state.positions);
  const boxB = getCardBox(rel.to, state.positions);
  if (!boxA || !boxB) return null;

  const { start, end } = computeAnchors(boxA, boxB);
  const d = buildCurvePath(start, end);

  const group = createSvgElement('g', {
    class: 'relation',
    'data-from': rel.from,
    'data-to': rel.to,
    'data-inferred': String(Boolean(rel.inferred)),
  });

  const title = document.createElementNS(SVG_NS, 'title');
  title.textContent = describeRelation(rel);

  const hitPath = createSvgElement('path', { d, fill: 'none', class: 'relation-hit' });
  const visiblePath = createSvgElement('path', {
    d,
    fill: 'none',
    class: 'relation-path',
    ...resolveRelationAttributes(rel, state.selectedTableId),
  });

  group.append(title, hitPath, visiblePath);
  return group;
}

/** 全リレーション線を再描画 */
function renderConnections() {
  const state = appState.get();
  const groups = state.schema.relations
    .map((rel) => createRelationGroup(rel, state))
    .filter(Boolean);

  dom.relationsGroup.replaceChildren(...groups);
  applyHoverHighlight();
}
