const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./load-scripts');

const { resolveZoomLevel, parseZoomPreferences, APP_CONFIG } = loadScripts(
  ['config.js', 'zoom-settings.js'],
  ['resolveZoomLevel', 'parseZoomPreferences', 'APP_CONFIG'],
);

describe('ズーム感度レベル定義', () => {
  const levels = APP_CONFIG.zoom.sensitivityLevels;

  test('5 段階あり、軽い順に感度・ボタン倍率が単調に下がる', () => {
    assert.equal(levels.length, 5);
    levels.slice(1).forEach((level, i) => {
      assert.ok(levels[i].wheelSensitivity > level.wheelSensitivity);
      assert.ok(levels[i].buttonStep > level.buttonStep);
    });
  });

  test('既定値 (標準) は config の既定の感度・倍率と一致する', () => {
    const normal = resolveZoomLevel(APP_CONFIG.zoom.defaultSensitivityId);
    assert.equal(normal.id, 'normal');
    assert.equal(normal.wheelSensitivity, APP_CONFIG.zoom.wheelSensitivity);
    assert.equal(normal.buttonStep, APP_CONFIG.zoom.buttonStep);
  });

  test('最も軽い設定でもマウス 1 ノッチが 1 イベント上限に達しない', () => {
    const lightest = levels[0];
    assert.ok(Math.exp(100 * lightest.wheelSensitivity) < APP_CONFIG.zoom.wheelMaxFactor);
  });
});

describe('resolveZoomLevel / parseZoomPreferences', () => {
  test('既知の ID はその定義、不明な ID は既定値を返す', () => {
    assert.equal(resolveZoomLevel('light').id, 'light');
    assert.equal(resolveZoomLevel('nope').id, 'normal');
    assert.equal(resolveZoomLevel(undefined).id, 'normal');
  });

  test('保存文字列を復元し、壊れていれば既定値にする', () => {
    assert.deepEqual({ ...parseZoomPreferences(JSON.stringify({ zoomSensitivity: 'heavy' })) }, { zoomSensitivity: 'heavy' });
    assert.deepEqual({ ...parseZoomPreferences(JSON.stringify({ zoomSensitivity: 'bogus' })) }, { zoomSensitivity: 'normal' });
    assert.deepEqual({ ...parseZoomPreferences('{broken') }, { zoomSensitivity: 'normal' });
    assert.deepEqual({ ...parseZoomPreferences(null) }, { zoomSensitivity: 'normal' });
  });
});
