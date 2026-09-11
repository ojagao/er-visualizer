const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain } = require('./load-scripts');

const { DiagramAutoLayout, UniversalDDLParser, SCHEMA_PRESETS, APP_CONFIG } = loadScripts(
  ['config.js', 'presets.js', 'cardinality.js', 'ddl-parser.js', 'auto-layout.js'],
  ['DiagramAutoLayout', 'UniversalDDLParser', 'SCHEMA_PRESETS', 'APP_CONFIG'],
);

const FIXED_HEIGHT = 200;
const fixedHeight = () => FIXED_HEIGHT;
const parseBlog = () => UniversalDDLParser.parse(SCHEMA_PRESETS.blog);

describe('DiagramAutoLayout.arrange', () => {
  test('空のテーブル配列では空オブジェクトを返す', () => {
    assert.deepEqual(plain(DiagramAutoLayout.arrange([], [])), {});
  });

  test('全テーブルに座標を割り当てる', () => {
    const { tables, relations } = parseBlog();
    const positions = DiagramAutoLayout.arrange(tables, relations, fixedHeight);
    tables.forEach((t) => {
      assert.ok(positions[t.id], `${t.id} に座標が無い`);
      assert.equal(typeof positions[t.id].x, 'number');
      assert.equal(typeof positions[t.id].y, 'number');
    });
  });

  test('参照される側 (親) を左、参照する側 (子) を右の列に置く', () => {
    const { tables, relations } = parseBlog();
    const positions = DiagramAutoLayout.arrange(tables, relations, fixedHeight);
    assert.ok(positions.users.x < positions.posts.x);
    assert.ok(positions.posts.x < positions.comments.x);
    assert.ok(positions.tags.x < positions.post_tags.x);
    assert.ok(positions.users.x < positions.sessions.x);
  });

  test('孤立テーブルは最右列にまとめる', () => {
    const { tables, relations } = parseBlog();
    const positions = DiagramAutoLayout.arrange(tables, relations, fixedHeight);
    const maxX = Math.max(...Object.values(positions).map((p) => p.x));
    assert.equal(positions.schema_migrations.x, maxX);
    assert.equal(positions.audit_logs.x, maxX);
    assert.ok(positions.comments.x < maxX);
  });

  test('同じ列内でカードが重ならない (推定高さ + 間隔を空ける)', () => {
    const { tables, relations } = parseBlog();
    const positions = DiagramAutoLayout.arrange(tables, relations, fixedHeight);
    const byColumn = Object.values(positions).reduce(
      (acc, p) => ({ ...acc, [p.x]: [...(acc[p.x] || []), p.y].sort((a, b) => a - b) }),
      {},
    );
    Object.values(byColumn).forEach((ys) => {
      ys.slice(1).forEach((y, i) => {
        assert.ok(y - ys[i] >= FIXED_HEIGHT + APP_CONFIG.layout.gapY);
      });
    });
  });

  test('カードごとの推定高さを反映して縦位置を決める', () => {
    const tables = [
      { id: 'a', name: 'a', columns: [] },
      { id: 'b', name: 'b', columns: [] },
    ];
    const heights = { a: 500, b: 100 };
    const positions = DiagramAutoLayout.arrange(tables, [], (t) => heights[t.id]);
    // 両方孤立なので同じ列。次数が同じなので入力順 (a, b)
    assert.equal(positions.a.x, positions.b.x);
    assert.equal(positions.b.y - positions.a.y, 500 + APP_CONFIG.layout.gapY);
  });

  test('循環参照や自己参照があっても終了する', () => {
    const tables = ['a', 'b', 'c'].map((id) => ({ id, name: id, columns: [] }));
    const relations = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
      { from: 'c', to: 'c' },
    ];
    const positions = DiagramAutoLayout.arrange(tables, relations, fixedHeight);
    assert.equal(Object.keys(positions).length, 3);
  });

  test('入力配列を変更しない', () => {
    const { tables, relations } = UniversalDDLParser.parse(SCHEMA_PRESETS.ecommerce);
    const tableOrder = tables.map((t) => t.id);
    DiagramAutoLayout.arrange(tables, relations, fixedHeight);
    assert.deepEqual(tables.map((t) => t.id), tableOrder);
  });
});
