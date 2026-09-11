const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain } = require('./load-scripts');

const { createSnapshot, parseSnapshot, mergePositions, serializeSnapshot, WORKSPACE_SNAPSHOT_VERSION, APP_CONFIG } = loadScripts(
  ['config.js', 'persistence.js'],
  ['createSnapshot', 'parseSnapshot', 'mergePositions', 'serializeSnapshot', 'WORKSPACE_SNAPSHOT_VERSION', 'APP_CONFIG'],
  { TextEncoder },
);

const baseState = {
  source: { sql: 'CREATE TABLE users (id INT PRIMARY KEY);', inferFk: true },
  positions: { users: { x: 80, y: 100 } },
  view: { scale: 0.9, translateX: 10, translateY: 20 },
  showOnlyKeys: true,
};

describe('createSnapshot', () => {
  test('SQL 本文・オプション・座標・ビュー・列表示モードを保存対象にする', () => {
    const snapshot = createSnapshot(baseState);
    assert.equal(snapshot.version, WORKSPACE_SNAPSHOT_VERSION);
    assert.equal(snapshot.sql, baseState.source.sql);
    assert.equal(snapshot.inferFk, true);
    assert.deepEqual(plain(snapshot.positions), { users: { x: 80, y: 100 } });
    assert.deepEqual(plain(snapshot.view), baseState.view);
    assert.equal(snapshot.showOnlyKeys, true);
    assert.ok(typeof snapshot.savedAt === 'string');
  });

  test('SQL の出典が無い (初期状態) なら null', () => {
    assert.equal(createSnapshot({ ...baseState, source: null }), null);
    assert.equal(createSnapshot({ ...baseState, source: { sql: '   ', inferFk: true } }), null);
  });
});

describe('parseSnapshot', () => {
  test('保存した内容を往復できる', () => {
    const restored = parseSnapshot(JSON.stringify(createSnapshot(baseState)));
    assert.equal(restored.sql, baseState.source.sql);
    assert.equal(restored.inferFk, true);
    assert.deepEqual(plain(restored.positions), { users: { x: 80, y: 100 } });
    assert.deepEqual(plain(restored.view), baseState.view);
    assert.equal(restored.showOnlyKeys, true);
  });

  test('壊れた JSON・別バージョン・SQL 無しは null を返す', () => {
    assert.equal(parseSnapshot(null), null);
    assert.equal(parseSnapshot(''), null);
    assert.equal(parseSnapshot('{not json'), null);
    assert.equal(parseSnapshot(JSON.stringify({ version: 99, sql: 'CREATE TABLE a (id INT);' })), null);
    assert.equal(parseSnapshot(JSON.stringify({ version: WORKSPACE_SNAPSHOT_VERSION, sql: '' })), null);
  });

  test('不正な座標やビューは捨て、他は復元する', () => {
    const raw = JSON.stringify({
      version: WORKSPACE_SNAPSHOT_VERSION,
      sql: 'CREATE TABLE a (id INT);',
      positions: { a: { x: 1, y: 2 }, b: { x: 'NaN' }, c: null },
      view: { scale: 'big' },
    });
    const restored = parseSnapshot(raw);
    assert.deepEqual(plain(restored.positions), { a: { x: 1, y: 2 } });
    assert.equal(restored.view, null);
    assert.equal(restored.inferFk, true, 'inferFk 未指定は true');
    assert.equal(restored.showOnlyKeys, false);
  });
});

describe('mergePositions', () => {
  const tables = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const layout = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, c: { x: 200, y: 0 } };

  test('保存座標を優先し、無いテーブルは自動レイアウトの座標を使う', () => {
    const merged = mergePositions(layout, { a: { x: 500, y: 600 }, zombie: { x: 1, y: 1 } }, tables);
    assert.deepEqual(plain(merged), { a: { x: 500, y: 600 }, b: { x: 100, y: 0 }, c: { x: 200, y: 0 } });
  });

  test('入力オブジェクトを変更せず、新しい座標オブジェクトを返す', () => {
    const saved = { a: { x: 5, y: 6 } };
    const merged = mergePositions(layout, saved, tables);
    assert.notEqual(merged.a, saved.a);
    assert.deepEqual(plain(saved), { a: { x: 5, y: 6 } });
  });
});

describe('serializeSnapshot (保存サイズの上限)', () => {
  test('通常のスキーマは数 KB で、上限内なら文字列を返す', () => {
    const json = serializeSnapshot(createSnapshot(baseState));
    assert.ok(typeof json === 'string');
    assert.ok(json.length < 2048);
  });

  test('上限を超える SQL は保存しない (null)', () => {
    const hugeSql = 'x'.repeat(APP_CONFIG.persistence.maxSnapshotBytes + 1);
    const json = serializeSnapshot(createSnapshot({ ...baseState, source: { sql: hugeSql, inferFk: true } }));
    assert.equal(json, null);
  });
});
