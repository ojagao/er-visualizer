/**
 * 汎用ユーティリティ (HTML エスケープ・スキーマ問い合わせ・寸法推定)
 */

const HTML_ESCAPES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

/** innerHTML に埋め込む前に必ず通す */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** 表示対象カラム (主要列のみモードなら PK / FK だけ) */
function getVisibleColumns(table, showOnlyKeys) {
  return showOnlyKeys ? table.columns.filter((col) => col.pk || col.fk) : table.columns;
}

/** レイアウト計算用にカードの高さ (px) を推定 */
function estimateCardHeight(table, showOnlyKeys) {
  const { headerHeight, bodyPadding, rowHeight, bodyMaxHeight } = APP_CONFIG.card;
  const rows = Math.max(1, getVisibleColumns(table, showOnlyKeys).length);
  return headerHeight + Math.min(bodyPadding + rows * rowHeight, bodyMaxHeight);
}

/** テーブル名またはカラム名が検索語を含むか */
function tableMatchesSearch(table, query) {
  if (!query) return true;
  return (
    table.name.toLowerCase().includes(query) ||
    table.columns.some((col) => col.name.toLowerCase().includes(query))
  );
}

/** 2 テーブルが直接リレーションで繋がっているか (同一テーブルは true) */
function isTableRelated(relations, tableIdA, tableIdB) {
  if (tableIdA === tableIdB) return true;
  return relations.some(
    (rel) =>
      (rel.from === tableIdA && rel.to === tableIdB) ||
      (rel.from === tableIdB && rel.to === tableIdA),
  );
}
