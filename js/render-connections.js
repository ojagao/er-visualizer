/**
 * リレーション接続線 (SVG ベジェ曲線 + クロウズフット記法) の描画
 *
 * 子 (FK を持つ側) → 親 (参照される側) へ線を引き、両端にカーディナリティを形で示す:
 *   |   … 1 (必須)        o|  … 0 または 1        o<  … 多 (0 以上)
 * 推測リレーションは点線。色は種類で変えず、選択に関係する線だけを強調する (配色は CSS 側)。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const round1 = (value) => Math.round(value * 10) / 10;

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

const SIDE_NORMAL = Object.freeze({
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
});

const isHorizontalSide = (side) => side === 'left' || side === 'right';

/** 2 つのカードの相対位置から、線を出す辺と入る辺を決める */
function resolveSides(boxA, boxB) {
  const centerA = boxCenter(boxA);
  const centerB = boxCenter(boxB);
  const threshold = APP_CONFIG.connection.sideThresholdPx;

  if (centerA.x < centerB.x - threshold) return { startSide: 'right', endSide: 'left' };
  if (centerA.x > centerB.x + threshold) return { startSide: 'left', endSide: 'right' };
  return centerA.y < centerB.y ? { startSide: 'bottom', endSide: 'top' } : { startSide: 'top', endSide: 'bottom' };
}

/** 辺上の端点。offset は辺に沿ったずらし量 (左右の辺なら上下方向、上下の辺なら左右方向) */
function anchorOnSide(box, side, offset = 0) {
  const center = boxCenter(box);
  switch (side) {
    case 'right':
      return { x: box.x + box.width, y: center.y + offset };
    case 'left':
      return { x: box.x, y: center.y + offset };
    case 'top':
      return { x: center.x + offset, y: box.y };
    default:
      return { x: center.x + offset, y: box.y + box.height };
  }
}

/**
 * 2 つのカードの相対位置から線の始点・終点と、カード辺の外向き法線 (線が辺に垂直に出入りする向き) を決める
 * @param {{start?: number, end?: number}} [offsets] 辺に沿った端点のずらし量
 * @returns {{start, end, startNormal, endNormal}}
 */
function computeAnchors(boxA, boxB, offsets = {}) {
  const { startSide, endSide } = resolveSides(boxA, boxB);
  return {
    start: anchorOnSide(boxA, startSide, offsets.start || 0),
    end: anchorOnSide(boxB, endSide, offsets.end || 0),
    startNormal: SIDE_NORMAL[startSide],
    endNormal: SIDE_NORMAL[endSide],
  };
}

/** 自己参照: カード右辺の 2 点を右側に膨らむループで結ぶ (offsets で他の線と重ならない位置へ) */
function computeSelfLoopAnchors(box, offsets = {}) {
  const { selfLoopSpan } = APP_CONFIG.connection;
  const half = (box.height * selfLoopSpan) / 2;
  return {
    start: anchorOnSide(box, 'right', offsets.start ?? -half),
    end: anchorOnSide(box, 'right', offsets.end ?? half),
    startNormal: SIDE_NORMAL.right,
    endNormal: SIDE_NORMAL.right,
  };
}

/** 同じ辺に count 本の線が集まるとき、中央を基準に等間隔にずらす量の配列 (辺の長さに収める) */
function distributeOffsets(count, edgeLength) {
  const { anchorSpacingPx, anchorEdgeMarginPx } = APP_CONFIG.connection;
  if (count <= 1) return [0];
  const usable = Math.max(edgeLength - anchorEdgeMarginPx * 2, 0);
  const spacing = Math.min(anchorSpacingPx, usable / (count - 1));
  return Array.from({ length: count }, (_, index) => round1((index - (count - 1) / 2) * spacing));
}

/**
 * 全リレーションの端点を「テーブル × 辺」ごとにまとめ、相手側の位置順に並べてずらし量を割り当てる
 * @returns {Map<number, {start: number, end: number}>} リレーションのインデックス → ずらし量
 */
function planAnchorOffsets(relations, boxes) {
  const ends = relations.flatMap((rel, index) => {
    const boxA = boxes[index]?.a;
    const boxB = boxes[index]?.b;
    if (!boxA || !boxB) return [];

    if (rel.from === rel.to) {
      // ループの 2 端点は必ず隣り合わせる (他の線がループの間を通らないよう、同じ整数キーの直後に並べる)
      const cy = boxCenter(boxA).y;
      return [
        { index, end: 'start', tableId: rel.from, side: 'right', sortKey: cy + 0.25, selfLoop: true },
        { index, end: 'end', tableId: rel.from, side: 'right', sortKey: cy + 0.3, selfLoop: true },
      ];
    }

    const { startSide, endSide } = resolveSides(boxA, boxB);
    const centerA = boxCenter(boxA);
    const centerB = boxCenter(boxB);
    return [
      { index, end: 'start', tableId: rel.from, side: startSide, sortKey: isHorizontalSide(startSide) ? centerB.y : centerB.x },
      { index, end: 'end', tableId: rel.to, side: endSide, sortKey: isHorizontalSide(endSide) ? centerA.y : centerA.x },
    ];
  });

  const groups = ends.reduce((acc, entry) => {
    const key = `${entry.tableId}:${entry.side}`;
    return { ...acc, [key]: [...(acc[key] || []), entry] };
  }, {});

  const offsets = new Map();
  Object.values(groups).forEach((group) => {
    const sample = group[0];
    const box = boxes[sample.index][sample.end === 'start' || sample.selfLoop ? 'a' : 'b'];
    const edgeLength = isHorizontalSide(sample.side) ? box.height : box.width;
    const sorted = [...group].sort((p, q) => p.sortKey - q.sortKey);
    const values = distributeOffsets(sorted.length, edgeLength);
    sorted.forEach((entry, i) => {
      const current = offsets.get(entry.index) || {};
      offsets.set(entry.index, { ...current, [entry.end]: values[i] });
    });
  });
  return offsets;
}

/** 両端から法線方向にハンドルを伸ばした 3 次ベジェ (カード辺に対して垂直に出入りする) */
function buildCurvePath({ start, end, startNormal, endNormal }, handleOverride) {
  const { handleRatio, handleMinPx } = APP_CONFIG.connection;
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const handle = handleOverride ?? Math.max(distance * handleRatio, handleMinPx);

  const c1 = { x: start.x + startNormal.x * handle, y: start.y + startNormal.y * handle };
  const c2 = { x: end.x + endNormal.x * handle, y: end.y + endNormal.y * handle };

  return `M ${round1(start.x)} ${round1(start.y)} C ${round1(c1.x)} ${round1(c1.y)}, ${round1(c2.x)} ${round1(c2.y)}, ${round1(end.x)} ${round1(end.y)}`;
}

/**
 * 線の端に描くカーディナリティ記号
 * @param {{x,y}} point カード辺上の端点
 * @param {{x,y}} normal 辺の外向き単位法線
 * @param {string} kind CARDINALITY_END のいずれか
 * @returns {{lines: string, circle: {cx,cy,r}|null}} lines は SVG パス (M/L のみ)
 */
function buildEndDecoration(point, normal, kind) {
  const { barOffset, barHalfLength, footLength, footHalfWidth, circleRadius, circleGap } = APP_CONFIG.connection.notation;
  const tangent = { x: -normal.y, y: normal.x };
  const along = (d) => ({ x: point.x + normal.x * d, y: point.y + normal.y * d });
  const across = (base, d) => ({ x: base.x + tangent.x * d, y: base.y + tangent.y * d });
  const segment = (a, b) => `M ${round1(a.x)} ${round1(a.y)} L ${round1(b.x)} ${round1(b.y)}`;
  const circleAt = (d) => {
    const c = along(d);
    return { cx: round1(c.x), cy: round1(c.y), r: circleRadius };
  };

  if (kind === CARDINALITY_END.ZERO_OR_MANY) {
    const apex = along(footLength);
    return {
      lines: [segment(apex, across(point, footHalfWidth)), segment(apex, across(point, -footHalfWidth))].join(' '),
      circle: circleAt(footLength + circleGap + circleRadius),
    };
  }

  const bar = along(barOffset);
  const lines = segment(across(bar, barHalfLength), across(bar, -barHalfLength));
  if (kind === CARDINALITY_END.ONE) return { lines, circle: null };
  return { lines, circle: circleAt(barOffset + circleGap + circleRadius) };
}

function createSvgElement(tagName, attributes) {
  const element = document.createElementNS(SVG_NS, tagName);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function createEndElements(point, normal, kind) {
  const { lines, circle } = buildEndDecoration(point, normal, kind);
  const elements = [createSvgElement('path', { class: 'relation-end', d: lines })];
  if (circle) elements.push(createSvgElement('circle', { class: 'relation-end-circle', ...circle }));
  return elements;
}

/** 選択状態に応じたグループのクラス */
function relationClassName(rel, selectedTableId) {
  const connected = Boolean(selectedTableId) && (rel.from === selectedTableId || rel.to === selectedTableId);
  return [
    'relation',
    rel.inferred && 'is-inferred',
    connected && 'is-highlight',
    Boolean(selectedTableId) && !connected && 'is-dimmed',
  ]
    .filter(Boolean)
    .join(' ');
}

/** 1 本のリレーションを <g class="relation"> (線 + 両端の記号) として生成 */
function createRelationGroup(rel, state, tablesById, boxes, offsets) {
  const { a: boxA, b: boxB } = boxes;
  if (!boxA || !boxB) return null;

  const isSelfReference = rel.from === rel.to;
  const anchors = isSelfReference ? computeSelfLoopAnchors(boxA, offsets) : computeAnchors(boxA, boxB, offsets);
  const handle = isSelfReference ? APP_CONFIG.connection.selfLoopHandlePx : undefined;
  const cardinality = resolveCardinality(rel, tablesById);

  const group = createSvgElement('g', {
    class: relationClassName(rel, state.selectedTableId),
    'data-from': rel.from,
    'data-to': rel.to,
    'data-cardinality': cardinality.type,
  });
  group.append(
    createSvgElement('path', { class: 'relation-path', d: buildCurvePath(anchors, handle) }),
    ...createEndElements(anchors.start, anchors.startNormal, cardinality.childEnd),
    ...createEndElements(anchors.end, anchors.endNormal, cardinality.parentEnd),
  );
  return group;
}

/** 全リレーション線を再描画 */
function renderConnections() {
  const state = appState.get();
  const { relations, tables } = state.schema;
  const tablesById = new Map(tables.map((table) => [table.id, table]));

  const boxes = relations.map((rel) => ({
    a: getCardBox(rel.from, state.positions),
    b: getCardBox(rel.to, state.positions),
  }));
  const offsets = planAnchorOffsets(relations, boxes);

  const groups = relations
    .map((rel, index) => createRelationGroup(rel, state, tablesById, boxes[index], offsets.get(index) || {}))
    .filter(Boolean);

  dom.relationsGroup.replaceChildren(...groups);
}
