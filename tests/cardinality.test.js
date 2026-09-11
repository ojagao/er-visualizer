const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain } = require('./load-scripts');

const { resolveCardinality, getJunctionTargets, isJunctionTable, CARDINALITY_END, UniversalDDLParser, SCHEMA_PRESETS } = loadScripts(
  ['config.js', 'presets.js', 'cardinality.js', 'ddl-parser.js'],
  ['resolveCardinality', 'getJunctionTargets', 'isJunctionTable', 'CARDINALITY_END', 'UniversalDDLParser', 'SCHEMA_PRESETS'],
);

const byId = (schema) => new Map(schema.tables.map((t) => [t.id, t]));
const relation = (schema, from, fromCol) => schema.relations.find((r) => r.from === from && r.fromCol === fromCol);

describe('resolveCardinality', () => {
  const ec = UniversalDDLParser.parse(SCHEMA_PRESETS.ecommerce);
  const blog = UniversalDDLParser.parse(SCHEMA_PRESETS.blog);

  test('NOT NULL の FK: 親は 1、子は多 (1:N)', () => {
    const c = resolveCardinality(relation(ec, 'orders', 'user_id'), byId(ec));
    assert.equal(c.type, '1:N');
    assert.equal(c.parentEnd, CARDINALITY_END.ONE);
    assert.equal(c.childEnd, CARDINALITY_END.ZERO_OR_MANY);
  });

  test('NULL 許容の FK: 親は 0..1', () => {
    const c = resolveCardinality(relation(ec, 'categories', 'parent_id'), byId(ec));
    assert.equal(c.parentEnd, CARDINALITY_END.ZERO_OR_ONE);
    assert.equal(c.childEnd, CARDINALITY_END.ZERO_OR_MANY);
  });

  test('FK が単独 PK: 1:1 で子は 0..1', () => {
    const c = resolveCardinality(relation(ec, 'user_profiles', 'user_id'), byId(ec));
    assert.equal(c.type, '1:1');
    assert.equal(c.childEnd, CARDINALITY_END.ZERO_OR_ONE);
    assert.equal(c.parentEnd, CARDINALITY_END.ONE);
  });

  test('FK が UNIQUE: 1:1', () => {
    const sql = `
      CREATE TABLE users (id INT PRIMARY KEY);
      CREATE TABLE passports (id INT PRIMARY KEY, user_id INT UNIQUE REFERENCES users(id));
    `;
    const schema = UniversalDDLParser.parse(sql);
    assert.equal(resolveCardinality(relation(schema, 'passports', 'user_id'), byId(schema)).type, '1:1');
  });

  test('複合 PK の一部が FK (中間テーブル) は 1:N', () => {
    const c = resolveCardinality(relation(blog, 'post_tags', 'post_id'), byId(blog));
    assert.equal(c.type, '1:N');
    assert.equal(c.childEnd, CARDINALITY_END.ZERO_OR_MANY);
  });

  test('パーサーがリレーションの type を判定結果で埋める', () => {
    assert.equal(relation(ec, 'user_profiles', 'user_id').type, '1:1');
    assert.equal(relation(ec, 'orders', 'user_id').type, '1:N');
  });

  test('参照元テーブルや列が見つからなくても既定 (1:N, 親 1, 子 多) を返す', () => {
    const c = resolveCardinality({ from: 'ghost', fromCol: 'x', to: 'users', toCol: 'id' }, byId(ec));
    assert.deepEqual(plain(c), { type: '1:N', childEnd: 'zero-or-many', parentEnd: 'one' });
  });
});

describe('getJunctionTargets / isJunctionTable', () => {
  const blog = UniversalDDLParser.parse(SCHEMA_PRESETS.blog);
  const tableOf = (id) => blog.tables.find((t) => t.id === id);

  test('PK がすべて FK で 2 テーブルを結ぶ post_tags は中間テーブル', () => {
    assert.deepEqual(plain(getJunctionTargets(tableOf('post_tags'), blog.relations)), ['posts', 'tags']);
    assert.equal(isJunctionTable(tableOf('post_tags'), blog.relations), true);
  });

  test('単独 PK のテーブルや、PK に FK でない列を含むテーブルは中間テーブルではない', () => {
    assert.equal(isJunctionTable(tableOf('users'), blog.relations), false);
    assert.equal(isJunctionTable(tableOf('comments'), blog.relations), false);
    const settings = UniversalDDLParser.parse(`
      CREATE TABLE tenants (id INT PRIMARY KEY);
      CREATE TABLE settings (tenant_id INT REFERENCES tenants(id), key VARCHAR(64), value TEXT, PRIMARY KEY (tenant_id, key));
    `);
    assert.equal(isJunctionTable(settings.tables.find((t) => t.id === 'settings'), settings.relations), false);
  });

  test('PK の FK がすべて同じテーブルを指す場合は中間テーブルではない', () => {
    const schema = UniversalDDLParser.parse(`
      CREATE TABLE nodes (id INT PRIMARY KEY);
      CREATE TABLE edges (src INT REFERENCES nodes(id), dst INT REFERENCES nodes(id), PRIMARY KEY (src, dst));
    `);
    assert.equal(isJunctionTable(schema.tables.find((t) => t.id === 'edges'), schema.relations), false);
  });
});
