/**
 * 汎用 SQL DDL パーサー
 *
 * - CREATE TABLE 文 (インライン PK/FK、アウトオブライン CONSTRAINT、複合キー、CHECK、DEFAULT 等)
 * - ALTER TABLE 文 (ADD [CONSTRAINT name] PRIMARY KEY / FOREIGN KEY)
 * - コメント除去、スキーマ名除去 (public.users -> users)
 * - 命名規則に基づく FK 推測 (オプション)
 *
 * すべての関数は入力を変更せず、新しいオブジェクトを返す。
 */

// ---------------------------------------------------------------------------
// 正規表現・キーワード定義
// ---------------------------------------------------------------------------

const DDL_IDENT = '[a-zA-Z0-9_"`]+';
const DDL_QUALIFIED = `(?:(${DDL_IDENT})\\.)?(${DDL_IDENT})`;

const CREATE_TABLE_HEADER_RE = new RegExp(
  `CREATE\\s+(?:(?:GLOBAL\\s+|LOCAL\\s+)?TEMP(?:ORARY)?\\s+|UNLOGGED\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:ONLY\\s+)?${DDL_QUALIFIED}\\s*\\(`,
  'gi',
);

const ALTER_TABLE_RE = new RegExp(
  `ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?${DDL_QUALIFIED}\\s+(ADD\\s+[\\s\\S]*?);`,
  'gi',
);

const ADD_PREFIX_RE = new RegExp(`^ADD\\s+(?:CONSTRAINT\\s+${DDL_IDENT}\\s+)?`, 'i');

const PK_CONSTRAINT_RE = new RegExp(
  `^(?:CONSTRAINT\\s+${DDL_IDENT}\\s+)?PRIMARY\\s+KEY\\s*\\(([^)]+)\\)`,
  'i',
);

const FK_CONSTRAINT_RE = new RegExp(
  `^(?:CONSTRAINT\\s+${DDL_IDENT}\\s+)?FOREIGN\\s+KEY\\s*\\(([^)]+)\\)\\s*REFERENCES\\s+${DDL_QUALIFIED}\\s*(?:\\(([^)]+)\\))?`,
  'i',
);

// 「KEY / INDEX 名 (列...)」形式のインデックス定義。`key varchar(64)` のような列定義と区別するため、
// KEY の直後が型名の場合は列として扱う
const SQL_TYPE_WORDS =
  'varchar|character|char|nchar|nvarchar|text|tinytext|mediumtext|longtext|' +
  'int|integer|bigint|smallint|tinyint|mediumint|serial|bigserial|boolean|bool|' +
  'numeric|decimal|float|double|real|money|date|datetime|timestamp|timestamptz|time|timetz|interval|year|' +
  'uuid|json|jsonb|xml|bytea|blob|binary|varbinary|bit|enum|set|inet|cidr|macaddr|geometry|geography|point';

const INDEX_DEFINITION = `(?:FULLTEXT\\s+|SPATIAL\\s+)?(?:KEY|INDEX)\\s+(?!(?:${SQL_TYPE_WORDS})\\b)(?:${DDL_IDENT}\\s*)?\\(`;

const SKIP_CONSTRAINT_RE = new RegExp(
  `^(?:CONSTRAINT\\s+${DDL_IDENT}\\s+)?(?:CHECK\\s*\\(|UNIQUE\\b|EXCLUDE\\b|LIKE\\s|(?:FULLTEXT|SPATIAL)\\s*\\(|${INDEX_DEFINITION})`,
  'i',
);

const INLINE_REFERENCES_RE = new RegExp(
  `\\bREFERENCES\\s+${DDL_QUALIFIED}\\s*(?:\\(([^)]+)\\))?`,
  'i',
);

// 型定義の終端とみなすキーワード
const COLUMN_STOP_KEYWORDS = new Set([
  'NOT', 'NULL', 'DEFAULT', 'PRIMARY', 'REFERENCES', 'UNIQUE', 'CHECK',
  'CONSTRAINT', 'GENERATED', 'COLLATE', 'AUTO_INCREMENT', 'AUTOINCREMENT',
  'COMMENT', 'ON', 'IDENTITY', 'ENCODE',
]);

// DEFAULT 値の終端とみなすキーワード (NULL は値として許可)
const DEFAULT_STOP_KEYWORDS = new Set([
  'NOT', 'PRIMARY', 'REFERENCES', 'UNIQUE', 'CHECK', 'CONSTRAINT',
  'GENERATED', 'COLLATE', 'COMMENT', 'ON', 'AUTO_INCREMENT',
]);

// テーブル名からカテゴリー (配色) を決めるキーワード
const CATEGORY_KEYWORDS = Object.freeze({
  auth: ['user', 'member', 'auth', 'account', 'role', 'team', 'session', 'permission'],
  dev: ['issue', 'pull', 'commit', 'repo', 'git', 'review', 'branch', 'deploy', 'pipeline'],
  content: ['post', 'article', 'comment', 'tag', 'categor', 'media', 'page', 'blog'],
  commerce: ['order', 'item', 'product', 'cart', 'payment', 'invoice', 'stock', 'customer'],
  metrics: ['metric', 'log', 'stat', 'audit', 'time', 'threshold', 'history', 'event'],
});

const FALLBACK_CATEGORIES = Object.freeze(['emerald', 'cyan', 'indigo', 'amber', 'purple', 'teal']);

// ---------------------------------------------------------------------------
// 文字列ユーティリティ
// ---------------------------------------------------------------------------

const stripIdent = (raw) => (raw || '').replace(/["`]/g, '').trim();
const isComma = (ch) => ch === ',';
const isWhitespace = (ch) => /\s/.test(ch);
const isQuoteChar = (ch) => ch === "'" || ch === '"' || ch === '`';

/** 行コメント (--) とブロックコメントを除去 */
function removeComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
}

/** 括弧の入れ子と引用符を考慮しつつ、深さ 0 の区切り文字で分割する */
function splitAtDepthZero(text, isSeparator) {
  const pieces = [];
  let current = '';
  let depth = 0;
  let quote = null;

  for (const ch of text) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (isQuoteChar(ch)) {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;

    if (depth === 0 && isSeparator(ch)) {
      if (current.trim()) pieces.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) pieces.push(current);
  return pieces;
}

/** openIndex にある '(' に対応する ')' の位置を返す (見つからなければ -1) */
function findClosingParen(text, openIndex) {
  let depth = 0;
  let quote = null;

  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (isQuoteChar(ch)) {
      quote = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const splitColumnList = (raw) => raw.split(',').map(stripIdent).filter(Boolean);

/** 複数形テーブル名を単数形に (repositories -> repository, users -> user) */
function singularize(name) {
  if (/ies$/.test(name)) return name.replace(/ies$/, 'y');
  if (/(ss|us|is)$/.test(name)) return name;
  if (/(x|ch|sh)es$/.test(name)) return name.replace(/es$/, '');
  return name.replace(/s$/, '');
}

// ---------------------------------------------------------------------------
// 定義行の分類
// ---------------------------------------------------------------------------

/** FOREIGN KEY (a, b) REFERENCES t (x, y) を列ごとの参照に展開 */
function pairReferences(fromCols, targetTable, targetColsRaw) {
  const targetCols = targetColsRaw ? splitColumnList(targetColsRaw) : [];
  return fromCols.map((fromCol, index) => ({
    fromCol,
    targetTable,
    targetCol: targetCols[index] || 'id',
  }));
}

/** 型トークン列を抽出 (例: character varying(256), timestamp with time zone) */
function extractType(tokens) {
  const stopIndex = tokens.findIndex((t) => COLUMN_STOP_KEYWORDS.has(t.toUpperCase()));
  const typeTokens = stopIndex === -1 ? tokens : tokens.slice(0, stopIndex);
  const type = typeTokens.join(' ').replace(/\s+/g, ' ').trim();
  return (type || 'text').toLowerCase();
}

/** DEFAULT 句の値を抽出 */
function extractDefault(tokens) {
  const defaultIndex = tokens.findIndex((t) => t.toUpperCase() === 'DEFAULT');
  if (defaultIndex === -1) return null;

  const after = tokens.slice(defaultIndex + 1);
  const stopIndex = after.findIndex((t) => DEFAULT_STOP_KEYWORDS.has(t.toUpperCase()));
  const valueTokens = stopIndex === -1 ? after : after.slice(0, stopIndex);
  return valueTokens.join(' ') || null;
}

/** カラム定義 1 行をパース。カラムでなければ null */
function parseColumnDefinition(def) {
  const tokens = splitAtDepthZero(def, isWhitespace);
  if (tokens.length < 2) return null;

  const [rawName, ...rest] = tokens;
  const name = stripIdent(rawName);
  if (!name) return null;

  const restText = rest.join(' ');
  const refMatch = restText.match(INLINE_REFERENCES_RE);
  const reference = refMatch
    ? { fromCol: name, targetTable: stripIdent(refMatch[2]), targetCol: stripIdent(refMatch[3] || 'id') }
    : null;

  return {
    column: {
      name,
      type: extractType(rest),
      pk: /\bPRIMARY\s+KEY\b/i.test(restText),
      fk: reference ? `${reference.targetTable}.${reference.targetCol}` : null,
      notNull: /\bNOT\s+NULL\b/i.test(restText),
      unique: /\bUNIQUE\b/i.test(restText),
      default: extractDefault(rest),
    },
    references: reference ? [reference] : [],
  };
}

/**
 * CREATE TABLE 本体の 1 定義 (または ALTER TABLE の ADD 句) を分類
 * @returns {{kind:'pk',columns:string[]}|{kind:'fk',references:object[]}|{kind:'column',column:object,references:object[]}|{kind:'skip'}}
 */
function classifyDefinition(def) {
  const pkMatch = def.match(PK_CONSTRAINT_RE);
  if (pkMatch) {
    return { kind: 'pk', columns: splitColumnList(pkMatch[1]).map((c) => c.toLowerCase()) };
  }

  const fkMatch = def.match(FK_CONSTRAINT_RE);
  if (fkMatch) {
    return {
      kind: 'fk',
      references: pairReferences(splitColumnList(fkMatch[1]), stripIdent(fkMatch[3]), fkMatch[4]),
    };
  }

  if (SKIP_CONSTRAINT_RE.test(def)) return { kind: 'skip' };

  const parsed = parseColumnDefinition(def);
  return parsed ? { kind: 'column', ...parsed } : { kind: 'skip' };
}

// ---------------------------------------------------------------------------
// テーブル・リレーション構築
// ---------------------------------------------------------------------------

function buildRelation(fromTableId, reference, inferred) {
  return {
    from: fromTableId,
    fromCol: reference.fromCol,
    to: reference.targetTable.toLowerCase(),
    toCol: reference.targetCol,
    label: `${reference.fromCol} → ${reference.targetCol}`,
    type: '1:N',
    inferred,
  };
}

/** PK / FK 制約をテーブルのカラムへ反映した新しいテーブル配列を返す */
function applyConstraints(tables, constraints) {
  return tables.map((table) => {
    const own = constraints.filter((c) => c.tableId === table.id);
    if (!own.length) return table;

    const pkColumns = new Set(own.filter((c) => c.kind === 'pk').flatMap((c) => c.columns));
    const fkByColumn = new Map(
      own
        .filter((c) => c.kind === 'fk')
        .flatMap((c) => c.references)
        .map((ref) => [ref.fromCol.toLowerCase(), `${ref.targetTable}.${ref.targetCol}`]),
    );

    return {
      ...table,
      columns: table.columns.map((col) => {
        const key = col.name.toLowerCase();
        return {
          ...col,
          pk: col.pk || pkColumns.has(key),
          fk: col.fk || fkByColumn.get(key) || null,
        };
      }),
    };
  });
}

/** CREATE TABLE 文の一覧 ({ name, body }) を抽出 */
function extractCreateStatements(sql) {
  return Array.from(sql.matchAll(CREATE_TABLE_HEADER_RE))
    .map((match) => {
      const openIndex = match.index + match[0].length - 1;
      const closeIndex = findClosingParen(sql, openIndex);
      if (closeIndex === -1) return null;
      return { name: stripIdent(match[2]), body: sql.slice(openIndex + 1, closeIndex) };
    })
    .filter(Boolean);
}

/** 1 つの CREATE TABLE 文からテーブルとリレーションを構築 */
function parseCreateStatement({ name, body }) {
  const tableId = name.toLowerCase();
  const classified = splitAtDepthZero(body, isComma)
    .map((def) => def.trim())
    .filter(Boolean)
    .map(classifyDefinition);

  const columnDefs = classified.filter((c) => c.kind === 'column');
  const constraints = classified
    .filter((c) => c.kind === 'pk' || c.kind === 'fk')
    .map((c) => ({ ...c, tableId }));

  const baseTable = { id: tableId, name, columns: columnDefs.map((c) => c.column) };
  const [table] = applyConstraints([baseTable], constraints);

  const references = [
    ...columnDefs.flatMap((c) => c.references),
    ...constraints.filter((c) => c.kind === 'fk').flatMap((c) => c.references),
  ];

  return { table, relations: references.map((ref) => buildRelation(tableId, ref, false)) };
}

/** ALTER TABLE ... ADD [CONSTRAINT] PRIMARY KEY / FOREIGN KEY を抽出 */
function extractAlterConstraints(sql) {
  return Array.from(sql.matchAll(ALTER_TABLE_RE)).flatMap((match) => {
    const tableId = stripIdent(match[2]).toLowerCase();
    return splitAtDepthZero(match[3], isComma)
      .map((piece) => piece.trim().replace(ADD_PREFIX_RE, ''))
      .map(classifyDefinition)
      .filter((c) => c.kind === 'pk' || c.kind === 'fk')
      .map((c) => ({ ...c, tableId }));
  });
}

// ---------------------------------------------------------------------------
// 命名規則による FK 推測
// ---------------------------------------------------------------------------

/**
 * カラムが参照していそうなテーブルを探す
 * - パターンA: カラム名が他テーブルの単一 PK 名と完全一致 (repo_id -> repositories.repo_id)
 * - パターンB: {単数形テーブル名}_id / {テーブル名}_id (member_id -> members.*)
 */
function findInferredReference(table, col, tables) {
  const colName = col.name.toLowerCase();

  for (const target of tables) {
    if (target.id === table.id) continue;

    const targetPks = target.columns.filter((c) => c.pk);
    if (!targetPks.length) continue;

    const exactPk = targetPks.length === 1 && targetPks[0].name.toLowerCase() === colName
      ? targetPks[0]
      : null;
    if (exactPk && colName !== 'id') {
      return { fromCol: col.name, targetTable: target.name, targetCol: exactPk.name };
    }

    const singular = singularize(target.id);
    if (colName === `${singular}_id` || colName === `${target.id}_id`) {
      const pk = targetPks.find((p) => ['id', colName].includes(p.name.toLowerCase())) || targetPks[0];
      return { fromCol: col.name, targetTable: target.name, targetCol: pk.name };
    }
  }
  return null;
}

/** target の方が source より「親らしい」か (参照数 → カラム数 → 定義順 で判定) */
function isMoreParentLike(targetId, sourceId, tables, referenceCounts) {
  const countDiff = (referenceCounts[targetId] || 0) - (referenceCounts[sourceId] || 0);
  if (countDiff !== 0) return countDiff > 0;

  const columnsOf = (id) => tables.find((t) => t.id === id)?.columns.length || 0;
  const columnDiff = columnsOf(targetId) - columnsOf(sourceId);
  if (columnDiff !== 0) return columnDiff > 0;

  const indexOf = (id) => tables.findIndex((t) => t.id === id);
  return indexOf(targetId) < indexOf(sourceId);
}

/**
 * 同名の単一 PK 同士 (A.pr_id <-> B.pr_id) は双方向に推測されてしまうため、
 * より多く参照されている側を親とみなし、子 -> 親 の一方向だけを残す
 */
function removeMutualInferences(candidates, tables, explicitRelations) {
  const targetIdOf = (candidate) => candidate.ref.targetTable.toLowerCase();

  const referenceCounts = [...explicitRelations.map((r) => r.to), ...candidates.map(targetIdOf)].reduce(
    (acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }),
    {},
  );

  const isReverse = (a, b) =>
    a.tableId === targetIdOf(b) &&
    b.tableId === targetIdOf(a) &&
    a.ref.fromCol.toLowerCase() === b.ref.targetCol.toLowerCase() &&
    a.ref.targetCol.toLowerCase() === b.ref.fromCol.toLowerCase();

  return candidates.filter((candidate) => {
    const hasReverse = candidates.some((other) => other !== candidate && isReverse(candidate, other));
    return !hasReverse || isMoreParentLike(targetIdOf(candidate), candidate.tableId, tables, referenceCounts);
  });
}

/** 明示的 FK を持たないカラムから推測リレーションを生成し、カラムの fk も更新 */
function inferRelations(tables, explicitRelations) {
  const explicitKeys = new Set(explicitRelations.map((r) => `${r.from}.${r.fromCol.toLowerCase()}`));

  const candidates = tables.flatMap((table) =>
    table.columns
      .filter((col) => !explicitKeys.has(`${table.id}.${col.name.toLowerCase()}`))
      .map((col) => findInferredReference(table, col, tables))
      .filter(Boolean)
      .map((ref) => ({ tableId: table.id, ref })),
  );

  const inferred = removeMutualInferences(candidates, tables, explicitRelations);

  const fkByKey = new Map(
    inferred.map(({ tableId, ref }) => [
      `${tableId}.${ref.fromCol.toLowerCase()}`,
      `${ref.targetTable}.${ref.targetCol}`,
    ]),
  );

  const updatedTables = tables.map((table) => ({
    ...table,
    columns: table.columns.map((col) => {
      const fk = fkByKey.get(`${table.id}.${col.name.toLowerCase()}`);
      return fk ? { ...col, fk } : col;
    }),
  }));

  return {
    tables: updatedTables,
    relations: inferred.map(({ tableId, ref }) => buildRelation(tableId, ref, true)),
  };
}

// ---------------------------------------------------------------------------
// カテゴリー (配色) 割り当て
// ---------------------------------------------------------------------------

function assignCategories(tables) {
  const keys = Object.keys(CATEGORY_KEYWORDS);
  return tables.map((table, index) => {
    const lowerName = table.name.toLowerCase();
    const matched = keys.find((key) => CATEGORY_KEYWORDS[key].some((kw) => lowerName.includes(kw)));
    return { ...table, category: matched || FALLBACK_CATEGORIES[index % FALLBACK_CATEGORIES.length] };
  });
}

// ---------------------------------------------------------------------------
// 公開 API
// ---------------------------------------------------------------------------

class UniversalDDLParser {
  /**
   * @param {string} sql
   * @param {{inferFk?: boolean}} options
   * @returns {{tables: object[], relations: object[]}}
   */
  static parse(sql, options = {}) {
    const { inferFk = true } = options;
    const cleanSql = removeComments(sql);

    // 1. CREATE TABLE
    const created = extractCreateStatements(cleanSql).map(parseCreateStatement);
    const baseTables = created.map((c) => c.table);
    const createRelations = created.flatMap((c) => c.relations);

    // 2. ALTER TABLE ... ADD CONSTRAINT
    const alterConstraints = extractAlterConstraints(cleanSql);
    const alteredTables = applyConstraints(baseTables, alterConstraints);
    const alterRelations = alterConstraints
      .filter((c) => c.kind === 'fk')
      .flatMap((c) => c.references.map((ref) => buildRelation(c.tableId, ref, false)));

    const explicitRelations = [...createRelations, ...alterRelations];

    // 3. 命名規則による推測 (オプション)
    const inferred = inferFk
      ? inferRelations(alteredTables, explicitRelations)
      : { tables: alteredTables, relations: [] };

    return {
      tables: assignCategories(inferred.tables),
      relations: [...explicitRelations, ...inferred.relations],
    };
  }
}
