const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./load-scripts');

const { toMermaidErDiagram, toMermaidType, toMermaidIdentifier, UniversalDDLParser, SCHEMA_PRESETS } = loadScripts(
  ['config.js', 'presets.js', 'cardinality.js', 'ddl-parser.js', 'mermaid-export.js'],
  ['toMermaidErDiagram', 'toMermaidType', 'toMermaidIdentifier', 'UniversalDDLParser', 'SCHEMA_PRESETS'],
);

const lines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);

describe('toMermaidType / toMermaidIdentifier', () => {
  test('型の空白と括弧内カンマを _ に置き換える', () => {
    assert.equal(toMermaidType('character varying(255)'), 'character_varying(255)');
    assert.equal(toMermaidType('timestamp with time zone'), 'timestamp_with_time_zone');
    assert.equal(toMermaidType('numeric(10, 2)'), 'numeric(10_2)');
    assert.equal(toMermaidType('integer'), 'integer');
  });

  test('識別子は英数字と _ - のみにし、先頭が数字なら _ を付ける', () => {
    assert.equal(toMermaidIdentifier('user profiles'), 'user_profiles');
    assert.equal(toMermaidIdentifier('order.items'), 'order_items');
    assert.equal(toMermaidIdentifier('2fa_codes'), '_2fa_codes');
  });
});

describe('toMermaidErDiagram: EC プリセット', () => {
  const schema = UniversalDDLParser.parse(SCHEMA_PRESETS.ecommerce);
  const text = toMermaidErDiagram(schema);
  const out = lines(text);

  test('erDiagram ヘッダーと全エンティティを出力する', () => {
    assert.equal(out[0], 'erDiagram');
    schema.tables.forEach((t) => assert.ok(out.includes(`${t.name} {`), `${t.name} entity`));
  });

  test('属性は「型 名前 キー」の形式で、PK / FK / UK を付ける', () => {
    assert.ok(out.includes('serial id PK'));
    assert.ok(out.includes('varchar(255) email UK'));
    assert.ok(out.includes('integer user_id PK, FK'));
    assert.ok(out.includes('numeric(10_2) price'));
  });

  test('NOT NULL の FK は 1 対多 (||--o{)、NULL 許容は 0or1 (|o--o{)', () => {
    assert.ok(out.includes('users ||--o{ orders : "user_id"'));
    assert.ok(out.includes('categories |o--o{ categories : "parent_id"'));
  });

  test('単独 PK が FK のテーブルは 1 対 1 (||--o|)', () => {
    assert.ok(out.includes('users ||--o| user_profiles : "user_id"'));
  });
});

describe('toMermaidErDiagram: 推測リレーションと参照先不明', () => {
  test('推測リレーションは点線 (..) と (inferred) ラベルで出力する', () => {
    const schema = UniversalDDLParser.parse(SCHEMA_PRESETS.blog);
    const out = lines(toMermaidErDiagram(schema));
    assert.ok(out.includes('users |o..o{ comments : "user_id (inferred)"'));
    assert.ok(out.includes('users ||..o| profiles : "user_id (inferred)"'));
    assert.ok(out.includes('users ||--o{ posts : "author_id"'));
  });

  test('参照先テーブルが存在しないリレーションは出力しない', () => {
    const schema = {
      tables: [{ id: 'a', name: 'a', columns: [{ name: 'id', type: 'int', pk: true, notNull: true }, { name: 'ghost_id', type: 'int', fk: 'ghosts.id', notNull: false }] }],
      relations: [{ from: 'a', fromCol: 'ghost_id', to: 'ghosts', toCol: 'id', inferred: false }],
    };
    const out = lines(toMermaidErDiagram(schema));
    assert.ok(!out.some((l) => l.includes('ghosts ')));
    assert.ok(out.includes('int ghost_id FK'));
  });

  test('テーブルが無くても erDiagram ヘッダーだけ返す', () => {
    assert.equal(toMermaidErDiagram({ tables: [], relations: [] }), 'erDiagram\n');
  });
});
