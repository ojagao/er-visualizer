/**
 * ズーム感度の設定 (5 段階)
 *
 * - ホイールの感度と +/- ボタンの倍率をまとめて切り替える
 * - 選択はブラウザ (localStorage) に保存し、作業状態の「初期状態に戻す」では消えない
 */

const ZOOM_PREFERENCES_KEY = 'er-studio:preferences:v1';

/** レベル ID から定義を返す (不明な ID はデフォルト) */
function resolveZoomLevel(levelId) {
  const { sensitivityLevels, defaultSensitivityId } = APP_CONFIG.zoom;
  return (
    sensitivityLevels.find((level) => level.id === levelId) ||
    sensitivityLevels.find((level) => level.id === defaultSensitivityId)
  );
}

/** 現在の状態に対応するレベル定義 */
function getZoomLevel() {
  return resolveZoomLevel(appState.get().preferences.zoomSensitivity);
}

/** 保存文字列から設定を復元 (壊れていればデフォルト) */
function parseZoomPreferences(raw) {
  const fallback = { zoomSensitivity: APP_CONFIG.zoom.defaultSensitivityId };
  if (typeof raw !== 'string' || !raw) return fallback;

  try {
    const data = JSON.parse(raw);
    return { zoomSensitivity: resolveZoomLevel(data?.zoomSensitivity).id };
  } catch {
    return fallback;
  }
}

function loadZoomPreferences() {
  try {
    return parseZoomPreferences(globalThis.localStorage?.getItem(ZOOM_PREFERENCES_KEY));
  } catch (error) {
    console.error('Failed to load zoom preferences:', error);
    return parseZoomPreferences(null);
  }
}

function saveZoomPreferences(preferences) {
  try {
    globalThis.localStorage?.setItem(ZOOM_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('Failed to save zoom preferences:', error);
  }
}

/** セレクトの選択肢をレベル定義から生成し、現在値を反映 */
function renderZoomSensitivitySelect() {
  const current = getZoomLevel().id;
  dom.zoomSensitivity.replaceChildren(
    ...APP_CONFIG.zoom.sensitivityLevels.map((level) => {
      const option = document.createElement('option');
      option.value = level.id;
      option.textContent = `感度: ${level.label}`;
      option.selected = level.id === current;
      return option;
    }),
  );
}

function setZoomSensitivity(levelId) {
  const level = resolveZoomLevel(levelId);
  const { preferences } = appState.update((state) => ({
    preferences: { ...state.preferences, zoomSensitivity: level.id },
  }));
  saveZoomPreferences(preferences);
  renderZoomSensitivitySelect();
}

function setupZoomSettings() {
  appState.update((state) => ({ preferences: { ...state.preferences, ...loadZoomPreferences() } }));
  renderZoomSensitivitySelect();
  dom.zoomSensitivity.addEventListener('change', (event) => setZoomSensitivity(event.target.value));
}
