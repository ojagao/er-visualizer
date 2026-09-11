/**
 * Mermaid erDiagram エクスポート
 *
 * 解析結果を Mermaid の erDiagram 記法に変換する。GitHub / Notion / Markdown ドキュメントに
 * 貼り付けてそのまま図としてレンダリングできる。
 */

/** エンティティ名・属性名に使える文字へ正規化 (英数字・_・-) */
function toMermaidIdentifier(name) {
  const cleaned = String(name).trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '_');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

/** 型名を Mermaid が受け付ける形へ (空白は _、括弧内のカンマは _) 例: numeric(10, 2) -> numeric(10_2) */
function toMermaidType(type) {
  const cleaned = String(type || 'text')
    .trim()
    .replace(/\s*,\s*/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_\-()[\]]/g, '_');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

function toMermaidKeys(col) {
  return [col.pk && 'PK', col.fk && 'FK', col.unique && !col.pk && 'UK'].filter(Boolean).join(', ');
}

function toMermaidEntity(table) {
  const attributes = table.columns.map((col) => {
    const keys = toMermaidKeys(col);
    return `        ${toMermaidType(col.type)} ${toMermaidIdentifier(col.name)}${keys ? ` ${keys}` : ''}`;
  });
  return [`    ${toMermaidIdentifier(table.name)} {`, ...attributes, '    }'].join('\n');
}

// 親側 (左) と子側 (右) の記号。判定は cardinality.js と共通
const MERMAID_PARENT_END = Object.freeze({ [CARDINALITY_END.ONE]: '||', [CARDINALITY_END.ZERO_OR_ONE]: '|o' });
const MERMAID_CHILD_END = Object.freeze({ [CARDINALITY_END.ZERO_OR_ONE]: 'o|', [CARDINALITY_END.ZERO_OR_MANY]: 'o{' });

/**
 * リレーション行を生成 (参照先が存在しないものは省く)
 * - 推測リレーションは点線 (..) にし、ラベルに (inferred) を付ける
 */
function toMermaidRelation(rel, tablesById) {
  const child = tablesById.get(rel.from);
  const parent = tablesById.get(rel.to);
  if (!child || !parent) return null;

  const { parentEnd, childEnd } = resolveCardinality(rel, tablesById);
  const line = rel.inferred ? '..' : '--';
  const label = rel.inferred ? `${rel.fromCol} (inferred)` : rel.fromCol;

  return `    ${toMermaidIdentifier(parent.name)} ${MERMAID_PARENT_END[parentEnd]}${line}${MERMAID_CHILD_END[childEnd]} ${toMermaidIdentifier(child.name)} : "${label}"`;
}

/** スキーマ全体を Mermaid erDiagram テキストに変換 */
function toMermaidErDiagram(schema) {
  const tablesById = new Map(schema.tables.map((table) => [table.id, table]));
  const entities = schema.tables.map(toMermaidEntity);
  const relations = schema.relations.map((rel) => toMermaidRelation(rel, tablesById)).filter(Boolean);

  const lines = ['erDiagram', ...entities, ...(relations.length ? ['', ...relations] : [])];
  return `${lines.join('\n')}\n`;
}

/** クリップボードへコピー。使えない環境では .mmd ファイルとしてダウンロード */
async function copyMermaidToClipboard() {
  const { schema } = appState.get();
  if (!schema.tables.length) {
    showToast('エクスポートするテーブルがありません', 'error');
    return;
  }

  const text = toMermaidErDiagram(schema);
  try {
    await navigator.clipboard.writeText(text);
    showToast(`Mermaid erDiagram をコピーしました (${schema.tables.length} テーブル)`, 'success');
  } catch (error) {
    console.error('Clipboard write failed:', error);
    downloadTextFile(text, `schema-er-diagram-${Date.now()}.mmd`, 'text/plain');
    showToast('クリップボードを使えないため .mmd ファイルとしてダウンロードしました', 'info');
  }
}
