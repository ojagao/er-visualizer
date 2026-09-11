/**
 * テーブルカードの描画
 */

const CARD_BASE_CLASS =
  'draggable-card absolute rounded-xl bg-slate-900/95 border-2 shadow-2xl ' +
  'transition-[border-color,box-shadow,opacity] duration-150 overflow-hidden flex flex-col';

const CARD_STATE_CLASS = Object.freeze({
  selected: 'border-indigo-400 ring-4 ring-indigo-500/30 shadow-indigo-500/20 z-30',
  active: 'border-slate-700 hover:border-slate-500 z-10',
  match: 'border-indigo-500/70 hover:border-indigo-400 shadow-indigo-500/10 z-20',
  dimmed: 'border-slate-800 opacity-20 z-0',
});

/** 選択・検索状態に応じたカードの見た目クラスを決定 */
function resolveCardStateClass(table, state) {
  if (state.selectedTableId === table.id) return CARD_STATE_CLASS.selected;

  const related =
    !state.selectedTableId || isTableRelated(state.schema.relations, table.id, state.selectedTableId);
  const matched = tableMatchesSearch(table, state.searchQuery);

  if (!related || !matched) return CARD_STATE_CLASS.dimmed;
  return state.searchQuery ? CARD_STATE_CLASS.match : CARD_STATE_CLASS.active;
}

function createTableCard(table, state) {
  const position = state.positions[table.id] || {
    x: APP_CONFIG.layout.startX,
    y: APP_CONFIG.layout.startY,
  };

  const card = document.createElement('div');
  card.id = `table-card-${table.id}`;
  card.dataset.tableId = table.id;
  card.className = `${CARD_BASE_CLASS} ${resolveCardStateClass(table, state)}`;
  card.style.left = `${position.x}px`;
  card.style.top = `${position.y}px`;
  card.style.width = `${APP_CONFIG.card.width}px`;
  card.innerHTML = renderCardHtml(table, {
    visibleColumns: getVisibleColumns(table, state.showOnlyKeys),
    searchQuery: state.searchQuery,
    junctionTargets: getJunctionTargets(table, state.schema.relations),
  });

  // キーボード操作: Tab で移動、Enter / Space で選択トグル
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-pressed', String(state.selectedTableId === table.id));
  card.setAttribute('aria-label', `テーブル ${table.name} (${table.columns.length} 列)`);

  setupCardDrag(card, table.id, renderConnections);

  card.addEventListener('click', () => {
    if (card.dataset.dragged === 'true') return;
    toggleTableSelection(table.id);
  });

  card.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleTableSelection(table.id, { restoreFocus: true });
  });

  return card;
}

/** 選択をトグルして再描画。キーボード操作時は再生成されたカードへフォーカスを戻す */
function toggleTableSelection(tableId, { restoreFocus = false } = {}) {
  toggleSelectedTable(tableId);
  renderDiagram();
  if (restoreFocus) document.getElementById(`table-card-${tableId}`)?.focus();
}

/** 全テーブルカードを再描画 */
function renderTables() {
  const state = appState.get();
  const { tables } = state.schema;

  dom.tableCountBadge.textContent = `${tables.length} Tables`;

  const cards = tables.map((table) => createTableCard(table, state));
  dom.tablesContainer.replaceChildren(...cards);
  observeCardResizes(cards);
  renderDetailPanel();
}
