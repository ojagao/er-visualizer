/**
 * 自動レイアウトエンジン (階層グリッド)
 *
 * - 参照される側 (親テーブル) を左、参照する側 (子テーブル) を右の列へ配置
 * - 同じ列内では接続数の多いテーブルを上に並べる
 * - どこにも繋がっていない孤立テーブルは最右列にまとめる
 * - カード高さの推定関数を受け取り、重なりを防ぐ
 */
class DiagramAutoLayout {
  /**
   * @param {object[]} tables
   * @param {object[]} relations
   * @param {(table: object) => number} estimateHeight カード高さ (px) の推定関数
   * @returns {Record<string, {x: number, y: number}>}
   */
  static arrange(tables, relations, estimateHeight = () => APP_CONFIG.card.fallbackHeight) {
    if (!tables.length) return {};

    const degrees = DiagramAutoLayout.countDegrees(tables, relations);
    const levels = DiagramAutoLayout.computeLevels(tables, relations, degrees);
    const columns = DiagramAutoLayout.groupByLevel(tables, levels, degrees);

    const { startX, startY, gapX, gapY } = APP_CONFIG.layout;
    const columnWidth = APP_CONFIG.card.width + gapX;

    return columns.reduce((positions, columnTables, columnIndex) => {
      const x = startX + columnIndex * columnWidth;
      const { positions: columnPositions } = columnTables.reduce(
        (acc, table) => ({
          nextY: acc.nextY + estimateHeight(table) + gapY,
          positions: { ...acc.positions, [table.id]: { x, y: acc.nextY } },
        }),
        { nextY: startY, positions: {} },
      );
      return { ...positions, ...columnPositions };
    }, {});
  }

  /** テーブルごとの接続数 (from / to 両方向) */
  static countDegrees(tables, relations) {
    const initial = Object.fromEntries(tables.map((t) => [t.id, 0]));
    return relations.reduce((acc, rel) => {
      if (!(rel.from in acc) || !(rel.to in acc)) return acc;
      if (rel.from === rel.to) return { ...acc, [rel.from]: acc[rel.from] + 1 };
      return { ...acc, [rel.from]: acc[rel.from] + 1, [rel.to]: acc[rel.to] + 1 };
    }, initial);
  }

  /**
   * 階層レベルを算出 (子 = 親 + 1 を収束するまで繰り返す。循環は反復回数で打ち切り)
   * 孤立テーブル (接続数 0) は最大レベル + 1 に配置
   */
  static computeLevels(tables, relations, degrees) {
    const ids = new Set(tables.map((t) => t.id));
    const edges = relations.filter((r) => r.from !== r.to && ids.has(r.from) && ids.has(r.to));
    const initial = Object.fromEntries(tables.map((t) => [t.id, 0]));

    const relax = (levels) =>
      edges.reduce((acc, edge) => {
        const candidate = acc[edge.to] + 1;
        return candidate > acc[edge.from] ? { ...acc, [edge.from]: candidate } : acc;
      }, levels);

    const connectedLevels = Array.from({ length: tables.length }).reduce(relax, initial);
    const maxLevel = Math.max(0, ...Object.values(connectedLevels));

    return Object.fromEntries(
      tables.map((t) => [t.id, degrees[t.id] === 0 ? maxLevel + 1 : connectedLevels[t.id]]),
    );
  }

  /** レベル順の列配列に分け、各列を接続数の降順に並べる */
  static groupByLevel(tables, levels, degrees) {
    const grouped = tables.reduce((acc, table) => {
      const level = levels[table.id] ?? 0;
      return { ...acc, [level]: [...(acc[level] || []), table] };
    }, {});

    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map((level) => [...grouped[level]].sort((a, b) => (degrees[b.id] || 0) - (degrees[a.id] || 0)));
  }
}
