const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain } = require('./load-scripts');

const { UniversalDDLParser, SCHEMA_PRESETS } = loadScripts(
  ['config.js', 'presets.js', 'cardinality.js', 'ddl-parser.js'],
  ['UniversalDDLParser', 'SCHEMA_PRESETS'],
);

const findTable = (result, id) => result.tables.find((t) => t.id === id);
const findColumn = (table, name) => table.columns.find((c) => c.name === name);
const columnNames = (table) => plain(table.columns.map((c) => c.name));
const hasRelation = (result, from, fromCol, to, toCol) =>
  result.relations.some(
    (r) => r.from === from && r.fromCol === fromCol && r.to === to && r.toCol === toCol,
  );

describe('UniversalDDLParser: ブログ / CMS プリセット (pg_dump 形式)', () => {
  const result = UniversalDDLParser.parse(SCHEMA_PRESETS.blog, { inferFk: true });

  test('11 テーブルを抽出し、スキーマ名 (public.) を除去する', () => {
    assert.equal(result.tables.length, 11);
    assert.equal(findTable(result, 'users').name, 'users');
  });

  test('ALTER TABLE の PRIMARY KEY を反映する (単一・複合)', () => {
    assert.equal(findColumn(findTable(result, 'users'), 'id').pk, true);
    const postTags = findTable(result, 'post_tags');
    assert.equal(findColumn(postTags, 'post_id').pk, true);
    assert.equal(findColumn(postTags, 'tag_id').pk, true);
    assert.equal(findColumn(postTags, 'created_at').pk, false);
  });

  test('ALTER TABLE の FOREIGN KEY を明示リレーションとして取り込み、カラムに FK を付ける', () => {
    assert.ok(hasRelation(result, 'posts', 'author_id', 'users', 'id'));
    assert.ok(hasRelation(result, 'post_tags', 'tag_id', 'tags', 'id'));
    assert.equal(findColumn(findTable(result, 'posts'), 'author_id').fk, 'users.id');
    assert.equal(result.relations.filter((r) => !r.inferred).length, 7);
  });

  test('ALTER TABLE の UNIQUE 制約は無視する (カラム化しない)', () => {
    assert.deepEqual(columnNames(findTable(result, 'users')), [
      'id', 'email', 'display_name', 'password_hash', 'role', 'is_active', 'created_at', 'updated_at',
    ]);
  });

  test('自己参照 FK (comments.parent_id -> comments.id) を扱える', () => {
    assert.ok(hasRelation(result, 'comments', 'parent_id', 'comments', 'id'));
  });

  test('複数語の型を保持する', () => {
    const users = findTable(result, 'users');
    assert.equal(findColumn(users, 'email').type, 'character varying(255)');
    assert.equal(findColumn(users, 'created_at').type, 'timestamp with time zone');
    assert.equal(findColumn(findTable(result, 'audit_logs'), 'payload').type, 'jsonb');
  });

  test('NOT NULL / DEFAULT を解釈する', () => {
    const users = findTable(result, 'users');
    assert.equal(findColumn(users, 'is_active').notNull, true);
    assert.equal(findColumn(users, 'is_active').default, 'true');
    assert.equal(findColumn(findTable(result, 'profiles'), 'bio').notNull, false);
    assert.equal(findColumn(users, 'created_at').default, 'now()');
    assert.equal(findColumn(users, 'role').default, "'member'::character varying");
  });

  test('単数形 + _id から FK を推測する (user_id -> users.id)', () => {
    ['profiles', 'comments', 'sessions'].forEach((tableId) => {
      assert.ok(hasRelation(result, tableId, 'user_id', 'users', 'id'), `${tableId}.user_id`);
      assert.equal(findColumn(findTable(result, tableId), 'user_id').fk, 'users.id');
    });
    const rel = result.relations.find((r) => r.from === 'sessions' && r.fromCol === 'user_id');
    assert.equal(rel.inferred, true);
    assert.equal(result.relations.filter((r) => r.inferred).length, 3);
  });

  test('対応するテーブルが無い列 (actor_id, target_id) は推測しない', () => {
    assert.ok(!result.relations.some((r) => r.from === 'audit_logs'));
  });

  test('カテゴリーを割り当てる', () => {
    assert.equal(findTable(result, 'users').category, 'auth');
    assert.equal(findTable(result, 'posts').category, 'content');
    assert.equal(findTable(result, 'audit_logs').category, 'metrics');
    assert.notEqual(findTable(result, 'profiles').category, 'dev', "'pr' の部分一致で dev 扱いしない");
    assert.ok(findTable(result, 'schema_migrations').category);
  });
});

describe('UniversalDDLParser: EC プリセット (インライン REFERENCES)', () => {
  const result = UniversalDDLParser.parse(SCHEMA_PRESETS.ecommerce, { inferFk: true });

  test('7 テーブル・8 明示リレーションを抽出する', () => {
    assert.equal(result.tables.length, 7);
    assert.equal(result.relations.filter((r) => !r.inferred).length, 8);
    assert.equal(result.relations.filter((r) => r.inferred).length, 0);
  });

  test('インライン PRIMARY KEY と REFERENCES を同時に解釈する', () => {
    const col = findColumn(findTable(result, 'user_profiles'), 'user_id');
    assert.equal(col.pk, true);
    assert.equal(col.fk, 'users.id');
    assert.ok(hasRelation(result, 'user_profiles', 'user_id', 'users', 'id'));
  });

  test('自己参照 (parent_id -> categories.id) を扱える', () => {
    assert.ok(hasRelation(result, 'categories', 'parent_id', 'categories', 'id'));
  });

  test('括弧内にスペースを含む型を 1 つの型として扱う', () => {
    assert.equal(findColumn(findTable(result, 'products'), 'price').type, 'numeric(10, 2)');
  });

  test('UNIQUE フラグを解釈する', () => {
    assert.equal(findColumn(findTable(result, 'users'), 'email').unique, true);
    assert.equal(findColumn(findTable(result, 'users'), 'password_hash').unique, false);
  });
});

describe('UniversalDDLParser: 構文バリエーション', () => {
  test('コメントを除去し、IF NOT EXISTS と MySQL バッククォート・INDEX 定義を扱える', () => {
    const sql = `
      -- 行コメント
      /* ブロック
         コメント */
      CREATE TABLE IF NOT EXISTS \`orders\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        INDEX idx_user (user_id),
        KEY (user_id),
        UNIQUE KEY uq (id),
        FOREIGN KEY (user_id) REFERENCES \`users\` (id)
      );
      CREATE TABLE users (id INT PRIMARY KEY);
    `;
    const result = UniversalDDLParser.parse(sql, { inferFk: false });
    const orders = findTable(result, 'orders');
    assert.equal(result.tables.length, 2);
    assert.deepEqual(columnNames(orders), ['id', 'user_id']);
    assert.equal(findColumn(orders, 'id').pk, true);
    assert.equal(findColumn(orders, 'user_id').fk, 'users.id');
    assert.ok(hasRelation(result, 'orders', 'user_id', 'users', 'id'));
  });

  test('key / index という名前の列はインデックス定義と誤認しない', () => {
    const sql = `
      CREATE TABLE settings (
        tenant_id INT,
        key VARCHAR(64) NOT NULL,
        index INTEGER DEFAULT 0,
        value TEXT,
        PRIMARY KEY (tenant_id, key)
      );
    `;
    const result = UniversalDDLParser.parse(sql, { inferFk: false });
    const settings = findTable(result, 'settings');
    assert.deepEqual(columnNames(settings), ['tenant_id', 'key', 'index', 'value']);
    assert.equal(findColumn(settings, 'key').pk, true);
    assert.equal(findColumn(settings, 'key').type, 'varchar(64)');
  });

  test('CHECK 制約の括弧内に ); があってもテーブル本体を正しく切り出す', () => {
    const sql = `
      CREATE TABLE t (
        id INT PRIMARY KEY,
        amount NUMERIC(10,2) CHECK (amount > 0 AND (amount < 100)),
        note TEXT DEFAULT 'a);b'
      );
      CREATE TABLE u (id INT PRIMARY KEY);
    `;
    const result = UniversalDDLParser.parse(sql, { inferFk: false });
    assert.equal(result.tables.length, 2);
    assert.deepEqual(columnNames(findTable(result, 't')), ['id', 'amount', 'note']);
  });

  test('複合 FOREIGN KEY を列ごとのリレーションに展開する', () => {
    const sql = `
      CREATE TABLE parent (a INT, b INT, PRIMARY KEY (a, b));
      CREATE TABLE child (
        id INT PRIMARY KEY,
        pa INT, pb INT,
        CONSTRAINT fk_parent FOREIGN KEY (pa, pb) REFERENCES parent (a, b)
      );
    `;
    const result = UniversalDDLParser.parse(sql, { inferFk: false });
    assert.ok(hasRelation(result, 'child', 'pa', 'parent', 'a'));
    assert.ok(hasRelation(result, 'child', 'pb', 'parent', 'b'));
    const parent = findTable(result, 'parent');
    assert.equal(findColumn(parent, 'a').pk, true);
    assert.equal(findColumn(parent, 'b').pk, true);
  });

  test('ALTER TABLE に複数の ADD CONSTRAINT がカンマ区切りで並んでいても解釈する', () => {
    const sql = `
      CREATE TABLE a (id INT);
      CREATE TABLE b (id INT, a_id INT);
      ALTER TABLE b ADD CONSTRAINT b_pk PRIMARY KEY (id), ADD CONSTRAINT b_fk FOREIGN KEY (a_id) REFERENCES a (id);
    `;
    const result = UniversalDDLParser.parse(sql, { inferFk: false });
    assert.equal(findColumn(findTable(result, 'b'), 'id').pk, true);
    assert.ok(hasRelation(result, 'b', 'a_id', 'a', 'id'));
  });

  test('inferFk: false では推測リレーションを生成しない', () => {
    const sql = `
      CREATE TABLE users (id INT PRIMARY KEY);
      CREATE TABLE posts (id INT PRIMARY KEY, user_id INT);
    `;
    const withInfer = UniversalDDLParser.parse(sql, { inferFk: true });
    const withoutInfer = UniversalDDLParser.parse(sql, { inferFk: false });
    assert.ok(hasRelation(withInfer, 'posts', 'user_id', 'users', 'id'));
    assert.equal(withoutInfer.relations.length, 0);
    assert.equal(findColumn(findTable(withoutInfer, 'posts'), 'user_id').fk, null);
  });

  test('ies で終わる複数形を単数化して推測する (category_id -> categories)', () => {
    const sql = `
      CREATE TABLE categories (id INT PRIMARY KEY);
      CREATE TABLE products (id INT PRIMARY KEY, category_id INT);
    `;
    const result = UniversalDDLParser.parse(sql);
    assert.ok(hasRelation(result, 'products', 'category_id', 'categories', 'id'));
  });

  test('PK 名の完全一致から FK を推測する (project_id -> projects.project_id)', () => {
    const sql = `
      CREATE TABLE projects (project_id VARCHAR(64) PRIMARY KEY, name TEXT);
      CREATE TABLE tasks (task_id VARCHAR(64) PRIMARY KEY, project_id VARCHAR(64));
    `;
    const result = UniversalDDLParser.parse(sql);
    const rel = result.relations.find((r) => r.from === 'tasks' && r.fromCol === 'project_id');
    assert.ok(rel);
    assert.equal(rel.to, 'projects');
    assert.equal(rel.toCol, 'project_id');
    assert.equal(rel.inferred, true);
    assert.equal(findColumn(findTable(result, 'tasks'), 'project_id').fk, 'projects.project_id');
  });

  test('複合 PK の一部にしか一致しない列 (tenant_id) は推測しない', () => {
    const sql = `
      CREATE TABLE settings (tenant_id INT, key VARCHAR(64), value TEXT, PRIMARY KEY (tenant_id, key));
      CREATE TABLE projects (id INT PRIMARY KEY, tenant_id INT);
    `;
    const result = UniversalDDLParser.parse(sql);
    assert.equal(result.relations.length, 0);
  });

  test('同名の単一 PK 同士は、より参照されている側を親として一方向だけ推測する', () => {
    const sql = `
      CREATE TABLE orders (order_id INT PRIMARY KEY, total NUMERIC(10,2), customer_name TEXT);
      CREATE TABLE order_stats (order_id INT PRIMARY KEY, item_count INT);
      CREATE TABLE shipments (id INT PRIMARY KEY, order_id INT);
    `;
    const result = UniversalDDLParser.parse(sql);
    assert.ok(hasRelation(result, 'order_stats', 'order_id', 'orders', 'order_id'));
    assert.ok(!hasRelation(result, 'orders', 'order_id', 'order_stats', 'order_id'));
    assert.equal(findColumn(findTable(result, 'orders'), 'order_id').fk, null);
    assert.ok(hasRelation(result, 'shipments', 'order_id', 'orders', 'order_id'));
    assert.equal(result.relations.length, 2);
  });

  test('CREATE TABLE が無い場合は空の結果を返す', () => {
    const result = UniversalDDLParser.parse('SELECT 1;');
    assert.deepEqual(plain(result), { tables: [], relations: [] });
  });

  test('パース結果は毎回新しいオブジェクトで、内容は決定的', () => {
    const first = UniversalDDLParser.parse(SCHEMA_PRESETS.ecommerce);
    const second = UniversalDDLParser.parse(SCHEMA_PRESETS.ecommerce);
    assert.notEqual(first.tables[0], second.tables[0]);
    assert.deepEqual(first, second);
  });
});
