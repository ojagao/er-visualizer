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
  });

  setupCardDrag(card, table.id, renderConnections);

  card.addEventListener('click', () => {
    if (card.dataset.dragged === 'true') return;
    toggleSelectedTable(table.id);
    renderDiagram();
  });

  return card;
}

/** 全テーブルカードを再描画 */
function renderTables() {
  const state = appState.get();
  const { tables } = state.schema;

  dom.tableCountBadge.textContent = `${tables.length} Tables`;

  const cards = tables.map((table) => createTableCard(table, state));
  dom.tablesContainer.replaceChildren(...cards);
  observeCardResizes(cards);
}
