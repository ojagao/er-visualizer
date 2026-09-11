/**
 * テーブルカードの HTML テンプレート
 */

// カテゴリー別のアクセントカラー (Tailwind クラス)
const CATEGORY_STYLES = Object.freeze({
  auth: { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', bar: 'from-emerald-500 to-teal-600' },
  dev: { badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', bar: 'from-indigo-500 to-violet-600' },
  content: { badge: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30', bar: 'from-fuchsia-500 to-pink-600' },
  commerce: { badge: 'bg-pink-500/20 text-pink-300 border-pink-500/30', bar: 'from-pink-500 to-rose-600' },
  metrics: { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', bar: 'from-amber-500 to-orange-600' },
  emerald: { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', bar: 'from-emerald-500 to-teal-600' },
  cyan: { badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', bar: 'from-cyan-500 to-blue-600' },
  indigo: { badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', bar: 'from-indigo-500 to-violet-600' },
  amber: { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', bar: 'from-amber-500 to-orange-600' },
  purple: { badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30', bar: 'from-purple-500 to-violet-600' },
  teal: { badge: 'bg-teal-500/20 text-teal-300 border-teal-500/30', bar: 'from-teal-500 to-emerald-600' },
  system: { badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30', bar: 'from-slate-600 to-slate-700' },
});

const KEY_BADGE_CLASS = Object.freeze({
  pk: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
  fk: 'bg-sky-400/20 text-sky-300 border-sky-400/40',
});

function resolveCategoryStyle(category) {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.system;
}

function renderKeyBadge(kind, title = '') {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<span class="px-1 py-px ${KEY_BADGE_CLASS[kind]} border rounded text-[9px] font-bold shrink-0"${titleAttr}>${kind.toUpperCase()}</span>`;
}

function resolveColumnNameClass(col) {
  if (col.pk) return 'font-semibold text-amber-200';
  if (col.fk) return 'text-sky-200';
  return 'text-slate-300';
}

function renderColumnRow(col, searchQuery) {
  const matched = searchQuery && col.name.toLowerCase().includes(searchQuery);
  const rowHighlight = matched ? 'bg-indigo-950/80 text-indigo-200 border border-indigo-500/50' : '';
  const name = escapeHtml(col.name);
  const type = escapeHtml(col.type);

  return `
    <div class="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-800/70 transition group ${rowHighlight}">
      <div class="flex items-center gap-1.5 min-w-0 pr-2">
        ${col.pk ? renderKeyBadge('pk') : ''}
        ${col.fk ? renderKeyBadge('fk', col.fk) : ''}
        <span class="truncate ${resolveColumnNameClass(col)}" title="${name}">${name}</span>
      </div>
      <span class="text-[11px] text-slate-500 shrink-0 group-hover:text-slate-400 truncate max-w-[110px]" title="${type}">${type}</span>
    </div>`;
}

function renderOmittedNotice(table, visibleColumns) {
  const omitted = table.columns.length - visibleColumns.length;
  if (omitted <= 0) return '';
  return `<div class="text-[10px] text-slate-500 text-center py-1 italic">+ 他 ${omitted} 列を省略中</div>`;
}

/**
 * カード内部の HTML を生成
 * @param {object} table
 * @param {{visibleColumns: object[], searchQuery: string}} options
 */
function renderJunctionBadge(junctionTargets) {
  if (!junctionTargets?.length) return '';
  const title = `中間テーブル: ${junctionTargets.join(' と ')} の多対多 (N:N) を表現`;
  return `<span class="px-1.5 py-0.5 text-[9px] font-bold rounded border bg-slate-700/60 text-slate-200 border-slate-500/50 shrink-0" title="${escapeHtml(title)}">N:N</span>`;
}

function renderCardHtml(table, { visibleColumns, searchQuery, junctionTargets = [] }) {
  const style = resolveCategoryStyle(table.category);
  const name = escapeHtml(table.name);

  return `
    <div class="h-1 bg-gradient-to-r ${style.bar}"></div>
    <div class="px-3.5 py-2.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 overflow-hidden">
        <span class="w-2 h-2 rounded-full bg-slate-400"></span>
        <span class="font-mono font-bold text-sm text-white tracking-wide truncate" title="${name}">${name}</span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        ${renderJunctionBadge(junctionTargets)}
        <span class="px-2 py-0.5 text-[10px] font-semibold rounded border uppercase tracking-wider ${style.badge}">
          ${table.columns.length} cols
        </span>
      </div>
    </div>
    <div data-scroll-area class="p-2 space-y-1 max-h-[380px] overflow-y-auto font-mono text-xs">
      ${visibleColumns.map((col) => renderColumnRow(col, searchQuery)).join('')}
      ${renderOmittedNotice(table, visibleColumns)}
    </div>`;
}
