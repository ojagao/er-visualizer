/**
 * 作業状態の自動保存・復元 (localStorage)
 *
 * 保存対象: SQL 本文、FK 推測オプション、カード座標、ビュー (ズーム / パン)、列表示モード
 * スキーマは保存せず、復元時に SQL を再パースする (パーサー改善が自動的に反映される)
 */

const WORKSPACE_STORAGE_KEY = 'er-studio:workspace:v1';
const WORKSPACE_SNAPSHOT_VERSION = 1;

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isPoint = (point) => Boolean(point) && isFiniteNumber(point.x) && isFiniteNumber(point.y);
const isView = (view) =>
  Boolean(view) && isFiniteNumber(view.scale) && isFiniteNumber(view.translateX) && isFiniteNumber(view.translateY);

/** 現在の状態から保存用スナップショットを作る (SQL の出典が無ければ null) */
function createSnapshot(state) {
  if (!state.source || typeof state.source.sql !== 'string' || !state.source.sql.trim()) return null;

  return {
    version: WORKSPACE_SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    sql: state.source.sql,
    inferFk: Boolean(state.source.inferFk),
    positions: state.positions,
    view: state.view,
    showOnlyKeys: Boolean(state.showOnlyKeys),
  };
}

/** 保存文字列を検証しつつ復元用オブジェクトに変換 (壊れていれば null) */
function parseSnapshot(raw) {
  if (typeof raw !== 'string' || !raw) return null;

  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== WORKSPACE_SNAPSHOT_VERSION) return null;
    if (typeof data.sql !== 'string' || !data.sql.trim()) return null;

    const positions = Object.fromEntries(
      Object.entries(data.positions || {}).filter(([, point]) => isPoint(point)),
    );

    return {
      sql: data.sql,
      inferFk: data.inferFk !== false,
      positions,
      view: isView(data.view) ? { ...data.view } : null,
      showOnlyKeys: Boolean(data.showOnlyKeys),
      savedAt: typeof data.savedAt === 'string' ? data.savedAt : null,
    };
  } catch (error) {
    console.error('Failed to parse saved workspace:', error);
    return null;
  }
}

/** 保存座標を優先し、無いテーブルは自動レイアウトの座標で補う */
function mergePositions(layoutPositions, savedPositions, tables) {
  return Object.fromEntries(
    tables.map((table) => {
      const saved = savedPositions[table.id];
      return [table.id, isPoint(saved) ? { x: saved.x, y: saved.y } : layoutPositions[table.id]];
    }),
  );
}

function getStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

// 上限超過の通知はセッション中 1 回だけ
let oversizeNotified = false;

function notifyOversize(bytes) {
  if (oversizeNotified) return;
  oversizeNotified = true;
  const limitMb = Math.round(APP_CONFIG.persistence.maxSnapshotBytes / 1024 / 1024);
  const sizeMb = (bytes / 1024 / 1024).toFixed(1);
  if (typeof showToast === 'function') {
    showToast(`SQL が大きいため自動保存をスキップしました (${sizeMb} MB / 上限 ${limitMb} MB)`, 'info');
  }
}

/**
 * 保存文字列を作る。上限を超える場合は null
 * 保存先は常に同じ 1 キーを上書きするため履歴は溜まらず、サイズは SQL 本文 + 座標に比例する
 */
function serializeSnapshot(snapshot) {
  const json = JSON.stringify(snapshot);
  const bytes = new TextEncoder().encode(json).length;
  if (bytes > APP_CONFIG.persistence.maxSnapshotBytes) {
    notifyOversize(bytes);
    return null;
  }
  return json;
}

function saveWorkspace() {
  const snapshot = createSnapshot(appState.get());
  const storage = getStorage();
  if (!snapshot || !storage) return false;

  const json = serializeSnapshot(snapshot);
  if (json === null) return false;

  try {
    storage.setItem(WORKSPACE_STORAGE_KEY, json);
    return true;
  } catch (error) {
    console.error('Failed to save workspace:', error);
    return false;
  }
}

function loadWorkspaceSnapshot() {
  const storage = getStorage();
  if (!storage) return null;

  try {
    return parseSnapshot(storage.getItem(WORKSPACE_STORAGE_KEY));
  } catch (error) {
    console.error('Failed to load saved workspace:', error);
    return null;
  }
}

function clearWorkspace() {
  try {
    getStorage()?.removeItem(WORKSPACE_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear saved workspace:', error);
  }
}

/** 状態更新をデバウンスして保存。ページ離脱時は即時保存 */
function setupWorkspaceAutosave() {
  let timer = null;

  const flush = () => {
    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }
    saveWorkspace();
  };

  appState.subscribe(() => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(flush, APP_CONFIG.timing.autosaveDebounceMs);
  });
  window.addEventListener('pagehide', flush);
}
