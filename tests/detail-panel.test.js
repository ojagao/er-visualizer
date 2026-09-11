const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain } = require('./load-scripts');

const { buildTableDetail, renderDetailPanelHtml, UniversalDDLParser, SCHEMA_PRESETS } = loadScripts(
  ['config.js', 'presets.js', 'ddl-parser.js', 'utils.js', 'card-template.js', 'detail-panel.js'],
  ['buildTableDetail', 'renderDetailPanelHtml', 'UniversalDDLParser', 'SCHEMA_PRESETS'],
);

const schema = UniversalDDLParser.parse(SCHEMA_PRESETS.blog);
const tableOf = (id) => schema.tables.find((t) => t.id === id);

describe('buildTableDetail', () => {
  test('参照している (親) と参照されている (子) を分けて集計する', () => {
    const detail = buildTableDetail(tableOf('posts'), schema);
    assert.deepEqual(plain(detail.outgoing.map((r) => `${r.column}->${r.tableId}.${r.targetColumn}`)), [
      'author_id->users.id',
      'category_id->categories.id',
    ]);
    assert.deepEqual(plain(detail.incoming.map((r) => `${r.tableId}.${r.column}`)).sort(), ['comments.post_id', 'post_tags.post_id']);
  });

  test('自己参照は「参照している」にだけ載せ、「参照されている」には重複させない', () => {
    const detail = buildTableDetail(tableOf('comments'), schema);
    assert.ok(detail.outgoing.some((r) => r.tableId === 'comments' && r.column === 'parent_id'));
    assert.ok(!detail.incoming.some((r) => r.tableId === 'comments'));
  });

  test('カラムごとに NOT NULL / DEFAULT / UNIQUE / FK 参照先を持つ (PK は常に NOT NULL)', () => {
    const detail = buildTableDetail(tableOf('posts'), schema);
    const byName = Object.fromEntries(detail.columns.map((c) => [c.name, c]));
    assert.equal(byName.id.pk, true);
    assert.equal(byName.id.notNull, true);
    assert.equal(byName.status.default, "'draft'::character varying");
    assert.equal(byName.published_at.notNull, false);
    assert.deepEqual(plain(byName.author_id.fkTarget), { tableId: 'users', column: 'id', inferred: false, exists: true });
  });

  test('推測リレーションは inferred フラグ付き', () => {
    const detail = buildTableDetail(tableOf('sessions'), schema);
    assert.equal(detail.columns.find((c) => c.name === 'user_id').fkTarget.inferred, true);
    assert.equal(detail.outgoing[0].inferred, true);
  });

  test('参照先テーブルが存在しない場合は exists: false', () => {
    const ghostSchema = {
      tables: [{ id: 'a', name: 'a', columns: [{ name: 'g_id', type: 'int', fk: 'ghosts.id' }] }],
      relations: [{ from: 'a', fromCol: 'g_id', to: 'ghosts', toCol: 'id', inferred: false }],
    };
    const detail = buildTableDetail(ghostSchema.tables[0], ghostSchema);
    assert.equal(detail.outgoing[0].exists, false);
    assert.equal(detail.columns[0].fkTarget.exists, false);
  });

  test('統計 (列数 / PK / FK / NOT NULL) を返す', () => {
    const detail = buildTableDetail(tableOf('post_tags'), schema);
    assert.deepEqual(plain(detail.stats), { columns: 3, primaryKeys: 2, foreignKeys: 2, notNull: 3 });
  });
});

describe('renderDetailPanelHtml', () => {
  test('テーブル名・カラム・関連テーブルへのジャンプボタンを含む', () => {
    const html = renderDetailPanelHtml(buildTableDetail(tableOf('posts'), schema));
    assert.match(html, /<h2[^>]*>posts<\/h2>/);
    assert.match(html, /data-reveal-table="users"/);
    assert.match(html, /data-reveal-table="comments"/);
    assert.match(html, /data-close-panel/);
    assert.match(html, /NOT NULL/);
    assert.match(html, /DEFAULT &#39;draft&#39;::character varying/);
  });

  test('参照先が無いテーブルはボタンではなく取り消し線で表示する', () => {
    const ghostSchema = {
      tables: [{ id: 'a', name: 'a', columns: [{ name: 'g_id', type: 'int', fk: 'ghosts.id' }] }],
      relations: [{ from: 'a', fromCol: 'g_id', to: 'ghosts', toCol: 'id', inferred: false }],
    };
    const html = renderDetailPanelHtml(buildTableDetail(ghostSchema.tables[0], ghostSchema));
    assert.ok(!/data-reveal-table="ghosts"/.test(html));
    assert.match(html, /line-through/);
  });

  test('テーブル名・型・DEFAULT 値を HTML エスケープする', () => {
    const evil = {
      id: 'x', name: '<img src=x onerror=alert(1)>', category: 'system',
      columns: [{ name: 'a<b', type: 'text<script>', pk: false, fk: null, notNull: false, unique: false, default: '"><svg>' }],
    };
    const html = renderDetailPanelHtml(buildTableDetail(evil, { tables: [evil], relations: [] }));
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<svg>'));
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  });
});
