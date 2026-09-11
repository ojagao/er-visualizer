/**
 * リレーションのカーディナリティ判定 (クロウズフット記法・Mermaid 出力・詳細パネルで共用)
 *
 * DDL から分かる範囲で判定する:
 * - 子 (FK を持つ側) の端: FK 列が UNIQUE または単独 PK なら 0..1 (1 対 1)、それ以外は 0..N
 * - 親 (参照される側) の端: FK 列が NULL 許容なら 0..1、NOT NULL なら 1
 * - 中間テーブル: PK が 2 列以上で、そのすべてが FK として 2 つ以上の別テーブルを参照 (N:N を表現)
 */

const CARDINALITY_END = Object.freeze({
  ONE: 'one',
  ZERO_OR_ONE: 'zero-or-one',
  ZERO_OR_MANY: 'zero-or-many',
});

const findColumn = (table, columnName) =>
  table?.columns.find((col) => col.name.toLowerCase() === String(columnName).toLowerCase()) || null;

/**
 * @param {object} rel リレーション { from, fromCol, to, toCol }
 * @param {Map<string, object>} tablesById
 * @returns {{type: '1:1'|'1:N', childEnd: string, parentEnd: string}}
 */
function resolveCardinality(rel, tablesById) {
  const child = tablesById.get(rel.from);
  const fkColumn = findColumn(child, rel.fromCol);
  const childPkCount = child ? child.columns.filter((col) => col.pk).length : 0;

  const oneToOne = Boolean(fkColumn) && (Boolean(fkColumn.unique) || (Boolean(fkColumn.pk) && childPkCount === 1));
  const parentOptional = Boolean(fkColumn) && !fkColumn.notNull && !fkColumn.pk;

  return {
    type: oneToOne ? '1:1' : '1:N',
    childEnd: oneToOne ? CARDINALITY_END.ZERO_OR_ONE : CARDINALITY_END.ZERO_OR_MANY,
    parentEnd: parentOptional ? CARDINALITY_END.ZERO_OR_ONE : CARDINALITY_END.ONE,
  };
}

/** 中間テーブルが結んでいるテーブル ID (重複除去・定義順)。中間テーブルでなければ空配列 */
function getJunctionTargets(table, relations) {
  const pkColumns = table.columns.filter((col) => col.pk);
  if (pkColumns.length < 2) return [];

  const targets = pkColumns.map(
    (col) =>
      relations.find((rel) => rel.from === table.id && rel.fromCol.toLowerCase() === col.name.toLowerCase())?.to ??
      null,
  );
  if (targets.some((target) => target === null || target === table.id)) return [];

  const unique = [...new Set(targets)];
  return unique.length >= 2 ? unique : [];
}

function isJunctionTable(table, relations) {
  return getJunctionTargets(table, relations).length >= 2;
}
