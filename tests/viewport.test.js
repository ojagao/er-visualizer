const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./load-scripts');

// viewport.js はトップレベルで DOM に触れないため、WheelEvent 定数だけスタブして読み込める
const WHEEL_EVENT_STUB = { DOM_DELTA_PIXEL: 0, DOM_DELTA_LINE: 1, DOM_DELTA_PAGE: 2 };

const { wheelZoomFactor, clampScale, APP_CONFIG } = loadScripts(
  ['config.js', 'viewport.js'],
  ['wheelZoomFactor', 'clampScale', 'APP_CONFIG'],
  { WheelEvent: WHEEL_EVENT_STUB },
);

const wheel = (deltaY, deltaMode = WHEEL_EVENT_STUB.DOM_DELTA_PIXEL) => ({ deltaY, deltaMode });
const nearlyEqual = (a, b) => Math.abs(a - b) < 1e-9;

describe('wheelZoomFactor (ホイールズーム感度)', () => {
  test('マウス 1 ノッチ (deltaY=100) の縮小率は 10% 未満に抑える', () => {
    const factor = wheelZoomFactor(wheel(100));
    assert.ok(factor < 1, '下方向スクロールは縮小');
    assert.ok(factor > 0.9, `1 ノッチで ${(1 - factor) * 100}% は大きすぎる`);
  });

  test('上方向は拡大・下方向は縮小で、互いに逆数になる', () => {
    const zoomIn = wheelZoomFactor(wheel(-100));
    const zoomOut = wheelZoomFactor(wheel(100));
    assert.ok(zoomIn > 1);
    assert.ok(nearlyEqual(zoomIn * zoomOut, 1));
  });

  test('deltaY の大きさに比例する (小さな入力ほど小さな倍率)', () => {
    assert.ok(wheelZoomFactor(wheel(10)) > wheelZoomFactor(wheel(100)));
    assert.ok(nearlyEqual(wheelZoomFactor(wheel(0)), 1));
  });

  test('大きな deltaY でも 1 イベントの倍率は wheelMaxFactor に収まる', () => {
    const { wheelMaxFactor } = APP_CONFIG.zoom;
    assert.ok(nearlyEqual(wheelZoomFactor(wheel(100000)), 1 / wheelMaxFactor));
    assert.ok(nearlyEqual(wheelZoomFactor(wheel(-100000)), wheelMaxFactor));
  });

  test('deltaMode が行単位のときは px 換算してから計算する', () => {
    const { lineDeltaPx } = APP_CONFIG.zoom;
    const byLine = wheelZoomFactor(wheel(3, WHEEL_EVENT_STUB.DOM_DELTA_LINE));
    const byPixel = wheelZoomFactor(wheel(3 * lineDeltaPx));
    assert.ok(nearlyEqual(byLine, byPixel));
  });
});

describe('clampScale', () => {
  test('ズーム範囲の下限・上限に丸める', () => {
    const { min, max } = APP_CONFIG.zoom;
    assert.equal(clampScale(min / 2), min);
    assert.equal(clampScale(max * 2), max);
    assert.equal(clampScale(1), 1);
  });
});
