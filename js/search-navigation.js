/**
 * 検索ナビゲーション
 *
 * - 検索欄の横に一致件数を表示 (0 件は警告色)
 * - Enter で一致テーブルへ順にジャンプ (Shift+Enter で逆順)。選択して画面中央へ移動する
 */

/** 検索語に一致するテーブル一覧 (検索語が空なら空配列) */
function getSearchMatches(tables, query) {
  return query ? tables.filter((table) => tableMatchesSearch(table, query)) : [];
}

/**
 * 次 (direction=1) / 前 (direction=-1) の一致テーブル ID を返す
 * 現在の選択が一致に含まれていればそこから巡回、含まれていなければ先頭 (逆順なら末尾)
 */
function pickNextMatch(matchIds, currentId, direction = 1) {
  if (!matchIds.length) return null;

  const index = matchIds.indexOf(currentId);
  if (index === -1) return direction > 0 ? matchIds[0] : matchIds[matchIds.length - 1];

  return matchIds[(index + direction + matchIds.length) % matchIds.length];
}

function renderSearchCount() {
  const { schema, searchQuery } = appState.get();
  const count = getSearchMatches(schema.tables, searchQuery).length;

  dom.searchCount.hidden = !searchQuery;
  dom.searchCount.textContent = `${count} 件`;
  dom.searchCount.classList.toggle('text-rose-400', count === 0);
  dom.searchCount.classList.toggle('text-indigo-300', count > 0);
}

/** テーブルを選択して画面中央へ移動 */
function focusTable(tableId) {
  appState.update({ selectedTableId: tableId });
  renderDiagram();
  centerOnTable(tableId);
}

function jumpToSearchMatch(direction) {
  const { schema, searchQuery, selectedTableId } = appState.get();
  const matchIds = getSearchMatches(schema.tables, searchQuery).map((table) => table.id);
  const nextId = pickNextMatch(matchIds, selectedTableId, direction);
  if (nextId) focusTable(nextId);
}

function setupSearchNavigation() {
  // 件数の更新は app.js の applySearch (input / クリア / Esc の全経路) から呼ばれる
  dom.searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    jumpToSearchMatch(event.shiftKey ? -1 : 1);
  });
}
