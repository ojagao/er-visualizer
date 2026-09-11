/**
 * 選択テーブルの詳細パネル (右側オーバーレイ)
 *
 * カード上では省略している NOT NULL / DEFAULT / UNIQUE、参照先・参照元のテーブル一覧を表示し、
 * 関連テーブルへワンクリックで移動できる。表示は selectedTableId に追従する。
 */

const DETAIL_BADGE_CLASS = Object.freeze({
  pk: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
  fk: 'bg-sky-400/20 text-sky-300 border-sky-400/40',
  uq: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40',
  inferred: 'bg-purple-400/20 text-purple-300 border-purple-400/40',
});

/** パネル表示用にテーブルの情報を整理する (純粋関数) */
function buildTableDetail(table, schema) {
  const tableIds = new Set(schema.tables.map((t) => t.id));
  const outgoingRelations = schema.relations.filter((rel) => rel.from === table.id);

  const columns = table.columns.map((col) => {
    const relation = outgoingRelations.find((rel) => rel.fromCol.toLowerCase() === col.name.toLowerCase());
    return {
      name: col.name,
      type: col.type,
      pk: Boolean(col.pk),
      fk: Boolean(col.fk),
      unique: Boolean(col.unique) && !col.pk,
      notNull: Boolean(col.notNull) || Boolean(col.pk),
      default: col.default ?? null,
      fkTarget: relation
        ? { tableId: relation.to, column: relation.toCol, inferred: Boolean(relation.inferred), exists: tableIds.has(relation.to) }
        : null,
    };
  });

  const outgoing = outgoingRelations.map((rel) => ({
    column: rel.fromCol,
    tableId: rel.to,
    targetColumn: rel.toCol,
    inferred: Boolean(rel.inferred),
    exists: tableIds.has(rel.to),
  }));

  const incoming = schema.relations
    .filter((rel) => rel.to === table.id && rel.from !== table.id)
    .map((rel) => ({
      tableId: rel.from,
      column: rel.fromCol,
      targetColumn: rel.toCol,
      inferred: Boolean(rel.inferred),
      exists: tableIds.has(rel.from),
    }));

  return {
    id: table.id,
    name: table.name,
    category: table.category || 'system',
    columns,
    outgoing,
    incoming,
    stats: {
      columns: columns.length,
      primaryKeys: columns.filter((c) => c.pk).length,
      foreignKeys: columns.filter((c) => c.fk).length,
      notNull: columns.filter((c) => c.notNull).length,
    },
  };
}

// ---------------------------------------------------------------------------
// HTML 生成
// ---------------------------------------------------------------------------

function renderDetailBadge(kind, label = kind.toUpperCase()) {
  return `<span class="px-1 py-px border rounded text-[9px] font-bold shrink-0 ${DETAIL_BADGE_CLASS[kind]}">${escapeHtml(label)}</span>`;
}

function renderRevealButton(tableId, label, exists) {
  const text = escapeHtml(label);
  if (!exists) {
    return `<span class="font-mono text-rose-300/80 line-through" title="参照先テーブルが定義にありません">${text}</span>`;
  }
  return `<button type="button" data-reveal-table="${escapeHtml(tableId)}" class="font-mono text-sky-300 hover:text-white hover:underline underline-offset-2 transition text-left">${text}</button>`;
}

function renderColumnDetail(col) {
  const nullability = col.notNull
    ? '<span class="text-amber-300/90">NOT NULL</span>'
    : '<span class="text-slate-500">NULL 可</span>';
  const defaultValue = col.default !== null
    ? `<span class="text-slate-400 truncate max-w-[180px]" title="${escapeHtml(col.default)}">DEFAULT ${escapeHtml(col.default)}</span>`
    : '';
  const fkTarget = col.fkTarget
    ? `<span class="flex items-center gap-1">→ ${renderRevealButton(col.fkTarget.tableId, `${col.fkTarget.tableId}.${col.fkTarget.column}`, col.fkTarget.exists)}${col.fkTarget.inferred ? renderDetailBadge('inferred', '推測') : ''}</span>`
    : '';

  return `
    <li class="py-1.5 border-b border-slate-800/80 last:border-b-0">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 min-w-0">
          ${col.pk ? renderDetailBadge('pk') : ''}
          ${col.fk ? renderDetailBadge('fk') : ''}
          ${col.unique ? renderDetailBadge('uq') : ''}
          <span class="font-mono text-xs text-slate-100 truncate" title="${escapeHtml(col.name)}">${escapeHtml(col.name)}</span>
        </div>
        <span class="font-mono text-[11px] text-slate-400 shrink-0 truncate max-w-[140px]" title="${escapeHtml(col.type)}">${escapeHtml(col.type)}</span>
      </div>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[10px] font-mono">
        ${nullability}
        ${defaultValue}
        ${fkTarget}
      </div>
    </li>`;
}

function renderRelationItem(rel, direction) {
  const label = direction === 'outgoing'
    ? `${rel.tableId}.${rel.targetColumn}`
    : `${rel.tableId}.${rel.column}`;
  const via = direction === 'outgoing'
    ? `<span class="text-slate-500">${escapeHtml(rel.column)} →</span>`
    : `<span class="text-slate-500">→ ${escapeHtml(rel.targetColumn)}</span>`;

  return `
    <li class="flex items-center justify-between gap-2 py-1 text-[11px]">
      <span class="flex items-center gap-1.5 min-w-0 flex-wrap">
        ${via}
        ${renderRevealButton(rel.tableId, label, rel.exists)}
      </span>
      ${rel.inferred ? renderDetailBadge('inferred', '推測') : ''}
    </li>`;
}

function renderRelationSection(title, items, direction, emptyText) {
  const body = items.length
    ? `<ul class="divide-y divide-slate-800/60">${items.map((rel) => renderRelationItem(rel, direction)).join('')}</ul>`
    : `<p class="text-[11px] text-slate-500 py-1">${emptyText}</p>`;
  return `
    <section class="px-4 py-3 border-t border-slate-800">
      <h3 class="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
        <span>${title}</span>
        <span class="text-slate-500 font-mono">${items.length}</span>
      </h3>
      ${body}
    </section>`;
}

function renderDetailPanelHtml(detail) {
  const style = resolveCategoryStyle(detail.category);
  const { stats } = detail;

  return `
    <div class="h-1 bg-gradient-to-r ${style.bar} shrink-0"></div>
    <header class="px-4 py-3 flex items-start justify-between gap-2 shrink-0">
      <div class="min-w-0">
        <h2 class="font-mono font-bold text-base text-white truncate" title="${escapeHtml(detail.name)}">${escapeHtml(detail.name)}</h2>
        <div class="flex items-center gap-2 mt-1 flex-wrap">
          <span class="px-2 py-0.5 text-[10px] font-semibold rounded border uppercase tracking-wider ${style.badge}">${escapeHtml(detail.category)}</span>
          <span class="text-[11px] text-slate-400 font-mono">${stats.columns} cols · PK ${stats.primaryKeys} · FK ${stats.foreignKeys} · NOT NULL ${stats.notNull}</span>
        </div>
      </div>
      <button type="button" data-close-panel title="閉じる (選択解除)" class="p-1.5 -mr-1.5 -mt-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition shrink-0">✕</button>
    </header>
    <div class="flex-1 min-h-0 overflow-y-auto">
      <section class="px-4 pb-2">
        <h3 class="text-[11px] font-semibold text-slate-300 mb-1">カラム</h3>
        <ul>${detail.columns.map(renderColumnDetail).join('')}</ul>
      </section>
      ${renderRelationSection('参照している (親テーブル)', detail.outgoing, 'outgoing', '外部キーはありません')}
      ${renderRelationSection('参照されている (子テーブル)', detail.incoming, 'incoming', 'このテーブルを参照するテーブルはありません')}
    </div>`;
}

// ---------------------------------------------------------------------------
// DOM 反映・操作
// ---------------------------------------------------------------------------

/** selectedTableId に応じてパネルを表示 / 非表示 */
function renderDetailPanel() {
  const { schema, selectedTableId } = appState.get();
  const table = schema.tables.find((t) => t.id === selectedTableId);

  dom.detailPanel.hidden = !table;
  dom.detailPanel.innerHTML = table ? renderDetailPanelHtml(buildTableDetail(table, schema)) : '';
}

/** 関連テーブルを選択して画面中央へ (中央寄せは viewport.centerOnTable がパネル幅を考慮する) */
function revealTable(tableId) {
  if (!appState.get().schema.tables.some((t) => t.id === tableId)) return;
  focusTable(tableId);
}

function setupDetailPanel() {
  dom.detailPanel.addEventListener('click', (event) => {
    const reveal = event.target.closest('[data-reveal-table]');
    if (reveal) {
      revealTable(reveal.dataset.revealTable);
      return;
    }
    if (event.target.closest('[data-close-panel]')) {
      clearSelectedTable();
      renderDiagram();
    }
  });
}
