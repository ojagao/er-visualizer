const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain } = require('./load-scripts');

const { detectImportKind, validateExportedDiagram } = loadScripts(
  ['config.js', 'file-import.js'],
  ['detectImportKind', 'validateExportedDiagram'],
);

describe('detectImportKind', () => {
  test('拡張子 .json は JSON、それ以外の拡張子は SQL', () => {
    assert.equal(detectImportKind('schema.json', ''), 'json');
    assert.equal(detectImportKind('schema.sql', 'CREATE TABLE a (id INT);'), 'sql');
    assert.equal(detectImportKind('dump.ddl', 'CREATE TABLE a (id INT);'), 'sql');
  });

  test('拡張子が無くても中身が tables を持つ JSON なら JSON と判定', () => {
    assert.equal(detectImportKind('export', '  {"tables": [], "relations": []}'), 'json');
    assert.equal(detectImportKind('export', '{"foo": 1}'), 'sql');
  });
});

describe('validateExportedDiagram', () => {
  const validExport = {
    exportedAt: '2026-09-11T00:00:00.000Z',
    tables: [
      { id: 'users', name: 'users', category: 'auth', columns: [{ name: 'id', type: 'integer', pk: true }] },
      { id: 'posts', name: 'posts', columns: [{ name: 'id', pk: true }, { name: 'user_id', fk: 'users.id' }] },
    ],
    relations: [
      { from: 'posts', fromCol: 'user_id', to: 'users', toCol: 'id', inferred: false },
      { from: 'posts', fromCol: 'user_id' },
    ],
    positions: { users: { x: 10, y: 20 }, posts: { x: 'bad', y: 0 } },
  };

  test('本アプリのエクスポート形式を受け付け、欠けた列属性を補う', () => {
    const result = validateExportedDiagram(validExport);
    assert.equal(result.ok, true);
    assert.equal(result.diagram.tables.length, 2);
    const postsId = result.diagram.tables[1].columns[0];
    assert.equal(postsId.type, 'text');
    assert.equal(postsId.pk, true);
    assert.equal(postsId.fk, null);
    assert.equal(result.diagram.tables[0].category, 'auth', 'カテゴリーなど既知以外の属性も保持');
  });

  test('不完全なリレーションと不正な座標は捨てる', () => {
    const { diagram } = validateExportedDiagram(validExport);
    assert.equal(diagram.relations.length, 1);
    assert.deepEqual(plain(diagram.positions), { users: { x: 10, y: 20 } });
  });

  test('形式が違う JSON はエラーメッセージ付きで拒否する', () => {
    assert.equal(validateExportedDiagram(null).ok, false);
    assert.equal(validateExportedDiagram({ tables: [] }).ok, false);
    assert.equal(validateExportedDiagram({ tables: [{ id: 'a' }] }).ok, false);
    assert.equal(validateExportedDiagram({ tables: [{ id: 'a', name: 'a', columns: [{}] }] }).ok, false);
    assert.match(validateExportedDiagram({ tables: 'x' }).error, /tables/);
  });
});
