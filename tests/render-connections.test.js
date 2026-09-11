const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain } = require('./load-scripts');

// render-connections.js はトップレベルで DOM に触れないため、そのまま読み込める
const { describeRelation, buildCurvePath, computeAnchors } = loadScripts(
  ['config.js', 'render-connections.js'],
  ['describeRelation', 'buildCurvePath', 'computeAnchors'],
);

describe('describeRelation (接続線ツールチップ)', () => {
  test('参照元.列 → 参照先.列 の形式で説明する', () => {
    const rel = { from: 'posts', fromCol: 'author_id', to: 'users', toCol: 'id', inferred: false };
    assert.equal(describeRelation(rel), 'posts.author_id → users.id');
  });

  test('推測リレーションには注記を付ける', () => {
    const rel = { from: 'comments', fromCol: 'user_id', to: 'users', toCol: 'id', inferred: true };
    assert.equal(describeRelation(rel), 'comments.user_id → users.id (命名規則から推測)');
  });
});

describe('computeAnchors / buildCurvePath', () => {
  const box = (x, y) => ({ x, y, width: 300, height: 200 });

  test('横に離れたカードは左右の辺を結ぶ', () => {
    const { start, end } = computeAnchors(box(0, 0), box(1000, 0));
    assert.deepEqual(plain(start), { x: 300, y: 100 });
    assert.deepEqual(plain(end), { x: 1000, y: 100 });
  });

  test('縦に並んだカードは上下の辺を結ぶ', () => {
    const { start, end } = computeAnchors(box(0, 0), box(0, 600));
    assert.deepEqual(plain(start), { x: 150, y: 200 });
    assert.deepEqual(plain(end), { x: 150, y: 600 });
  });

  test('パスは始点から終点へ向かう 3 次ベジェ曲線', () => {
    const d = buildCurvePath({ x: 0, y: 0 }, { x: 100, y: 50 });
    assert.match(d, /^M 0 0 C .* 100 50$/);
  });
});
