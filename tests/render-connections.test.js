const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain } = require('./load-scripts');

// render-connections.js はトップレベルで DOM に触れないため、そのまま読み込める
const { computeAnchors, computeSelfLoopAnchors, buildCurvePath, buildEndDecoration, CARDINALITY_END, APP_CONFIG } = loadScripts(
  ['config.js', 'cardinality.js', 'render-connections.js'],
  ['computeAnchors', 'computeSelfLoopAnchors', 'buildCurvePath', 'buildEndDecoration', 'CARDINALITY_END', 'APP_CONFIG'],
);

const box = (x, y) => ({ x, y, width: 300, height: 200 });

describe('computeAnchors (端点と外向き法線)', () => {
  test('横に離れたカードは左右の辺を結び、法線は水平', () => {
    const a = computeAnchors(box(0, 0), box(1000, 0));
    assert.deepEqual(plain(a.start), { x: 300, y: 100 });
    assert.deepEqual(plain(a.end), { x: 1000, y: 100 });
    assert.deepEqual(plain(a.startNormal), { x: 1, y: 0 });
    assert.deepEqual(plain(a.endNormal), { x: -1, y: 0 });
  });

  test('縦に並んだカードは上下の辺を結び、法線は垂直', () => {
    const a = computeAnchors(box(0, 0), box(0, 600));
    assert.deepEqual(plain(a.start), { x: 150, y: 200 });
    assert.deepEqual(plain(a.end), { x: 150, y: 600 });
    assert.deepEqual(plain(a.startNormal), { x: 0, y: 1 });
    assert.deepEqual(plain(a.endNormal), { x: 0, y: -1 });
  });

  test('自己参照はカード右辺の 2 点を結び、法線は共に右向き', () => {
    const a = computeSelfLoopAnchors(box(0, 0));
    assert.equal(a.start.x, 300);
    assert.equal(a.end.x, 300);
    assert.ok(a.start.y < a.end.y);
    assert.deepEqual(plain(a.startNormal), { x: 1, y: 0 });
    assert.deepEqual(plain(a.endNormal), { x: 1, y: 0 });
  });
});

describe('buildCurvePath', () => {
  test('制御点が法線方向に伸び、カード辺に垂直に出入りする', () => {
    const d = buildCurvePath({ start: { x: 300, y: 100 }, end: { x: 1000, y: 400 }, startNormal: { x: 1, y: 0 }, endNormal: { x: -1, y: 0 } });
    const m = d.match(/^M 300 100 C ([\d.]+) 100, ([\d.]+) 400, 1000 400$/);
    assert.ok(m, d);
    assert.ok(Number(m[1]) > 300, '始点側の制御点は右へ');
    assert.ok(Number(m[2]) < 1000, '終点側の制御点は左へ');
  });

  test('ハンドル長は距離に比例し、最小値を下回らない', () => {
    const { handleMinPx } = APP_CONFIG.connection;
    const d = buildCurvePath({ start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, startNormal: { x: 1, y: 0 }, endNormal: { x: -1, y: 0 } });
    assert.match(d, new RegExp(`C ${handleMinPx} 0, ${10 - handleMinPx} 0`));
  });
});

describe('buildEndDecoration (クロウズフット記号)', () => {
  const point = { x: 300, y: 100 };
  const right = { x: 1, y: 0 };
  const { barOffset, barHalfLength, footLength, footHalfWidth, circleRadius, circleGap } = APP_CONFIG.connection.notation;

  test('1: 辺から少し離れた位置に線と直交する縦棒、丸なし', () => {
    const deco = buildEndDecoration(point, right, CARDINALITY_END.ONE);
    assert.equal(deco.lines, `M ${300 + barOffset} ${100 + barHalfLength} L ${300 + barOffset} ${100 - barHalfLength}`);
    assert.equal(deco.circle, null);
  });

  test('0..1: 縦棒に加えて、その外側に丸', () => {
    const deco = buildEndDecoration(point, right, CARDINALITY_END.ZERO_OR_ONE);
    assert.match(deco.lines, /^M .* L .*$/);
    assert.deepEqual(plain(deco.circle), { cx: 300 + barOffset + circleGap + circleRadius, cy: 100, r: circleRadius });
  });

  test('多: 辺に向かって開く三叉と、その外側に丸', () => {
    const deco = buildEndDecoration(point, right, CARDINALITY_END.ZERO_OR_MANY);
    const apexX = 300 + footLength;
    assert.equal(deco.lines, `M ${apexX} 100 L 300 ${100 + footHalfWidth} M ${apexX} 100 L 300 ${100 - footHalfWidth}`);
    assert.deepEqual(plain(deco.circle), { cx: apexX + circleGap + circleRadius, cy: 100, r: circleRadius });
  });

  test('法線が上向きなら記号も回転する', () => {
    const deco = buildEndDecoration({ x: 150, y: 200 }, { x: 0, y: 1 }, CARDINALITY_END.ONE);
    assert.equal(deco.lines, `M ${150 - barHalfLength} ${200 + barOffset} L ${150 + barHalfLength} ${200 + barOffset}`);
  });
});

describe('端点の分散 (同じ辺に複数の線が集まる場合)', () => {
  const { distributeOffsets, planAnchorOffsets } = loadScripts(
    ['config.js', 'cardinality.js', 'render-connections.js'],
    ['distributeOffsets', 'planAnchorOffsets'],
  );

  test('1 本なら中央 (0)、複数なら中央を基準に等間隔で対称にずらす', () => {
    assert.deepEqual(plain(distributeOffsets(1, 200)), [0]);
    const { anchorSpacingPx } = APP_CONFIG.connection;
    assert.deepEqual(plain(distributeOffsets(3, 400)), [-anchorSpacingPx, 0, anchorSpacingPx]);
  });

  test('辺が短いときは間隔を詰めて辺の内側に収める', () => {
    const { anchorEdgeMarginPx } = APP_CONFIG.connection;
    const offsets = distributeOffsets(5, 120);
    const usable = 120 - anchorEdgeMarginPx * 2;
    assert.ok(Math.max(...offsets) - Math.min(...offsets) <= usable + 0.01);
  });

  test('同じテーブルの同じ辺に集まる線は、相手の位置順に上から並ぶ', () => {
    const parent = box(0, 0);
    const relations = [
      { from: 'low', to: 'parent', fromCol: 'p', toCol: 'id' },
      { from: 'high', to: 'parent', fromCol: 'p', toCol: 'id' },
    ];
    const boxes = [
      { a: box(600, 800), b: parent }, // 下側から来る線
      { a: box(600, -600), b: parent }, // 上側から来る線
    ];
    const offsets = planAnchorOffsets(relations, boxes);
    assert.ok(offsets.get(1).end < offsets.get(0).end, '上から来る線ほど上の端点に付く');
    assert.equal(offsets.get(0).start, 0, '相手側 (1 本しかない辺) は中央');
  });

  test('自己参照の 2 端点は同じ右辺で隣り合い、他の線とも重ならない', () => {
    const self = box(0, 0);
    const relations = [
      { from: 'self', to: 'self', fromCol: 'parent_id', toCol: 'id' },
      { from: 'other', to: 'self', fromCol: 'self_id', toCol: 'id' },
    ];
    const boxes = [{ a: self, b: self }, { a: box(800, 0), b: self }]; // 右側から来る線 → self の右辺に入る
    const offsets = planAnchorOffsets(relations, boxes);
    const loop = offsets.get(0);
    assert.ok(loop.start < loop.end);
    const other = offsets.get(1).end;
    const all = [loop.start, loop.end, other];
    assert.equal(new Set(all).size, 3, '3 つの端点がすべて異なる位置');
    assert.ok(other < loop.start || other > loop.end, '他の線はループの 2 端点の間を通らない');
  });
});
