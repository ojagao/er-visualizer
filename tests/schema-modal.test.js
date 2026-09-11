const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./load-scripts');

// schema-modal.js はトップレベルで DOM に触れないため、そのまま読み込める
const { cycleIndex } = loadScripts(['config.js', 'schema-modal.js'], ['cycleIndex']);

describe('cycleIndex (モーダル内の Tab 巡回)', () => {
  test('末尾で Tab → 先頭、先頭で Shift+Tab → 末尾', () => {
    assert.equal(cycleIndex(4, 5, false), 0);
    assert.equal(cycleIndex(0, 5, true), 4);
  });

  test('途中では隣へ移動する', () => {
    assert.equal(cycleIndex(1, 5, false), 2);
    assert.equal(cycleIndex(3, 5, true), 2);
  });

  test('フォーカスがモーダル外 (-1) なら先頭 (逆順は末尾) へ', () => {
    assert.equal(cycleIndex(-1, 5, false), 0);
    assert.equal(cycleIndex(-1, 5, true), 4);
  });

  test('フォーカス可能要素が無ければ -1', () => {
    assert.equal(cycleIndex(0, 0, false), -1);
  });
});
