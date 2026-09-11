const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./load-scripts');

const { resolveShortcut, KEYBOARD_SHORTCUTS } = loadScripts(
  ['config.js', 'keyboard-shortcuts.js'],
  ['resolveShortcut', 'KEYBOARD_SHORTCUTS'],
);

const keyEvent = (key, overrides = {}) => ({ key, target: { tagName: 'BODY' }, ...overrides });
const idOf = (event) => resolveShortcut(event)?.id ?? null;

describe('resolveShortcut', () => {
  test('主要な操作にキーが割り当てられている', () => {
    assert.equal(idOf(keyEvent('+')), 'zoom-in');
    assert.equal(idOf(keyEvent('=')), 'zoom-in');
    assert.equal(idOf(keyEvent('-')), 'zoom-out');
    assert.equal(idOf(keyEvent('0')), 'fit');
    assert.equal(idOf(keyEvent('a')), 'auto-layout');
    assert.equal(idOf(keyEvent('K')), 'toggle-columns');
    assert.equal(idOf(keyEvent('/')), 'focus-search');
    assert.equal(idOf(keyEvent('i')), 'open-sql');
    assert.equal(idOf(keyEvent('Escape')), 'escape');
  });

  test('割り当てのないキーは null', () => {
    assert.equal(idOf(keyEvent('x')), null);
    assert.equal(idOf(keyEvent('Enter')), null);
  });

  test('Ctrl / Cmd / Alt 付きはブラウザ既定動作を優先して無視する', () => {
    assert.equal(idOf(keyEvent('a', { ctrlKey: true })), null);
    assert.equal(idOf(keyEvent('a', { metaKey: true })), null);
    assert.equal(idOf(keyEvent('-', { altKey: true })), null);
  });

  test('入力欄にフォーカスがある間は Escape 以外を無視する', () => {
    const input = { tagName: 'INPUT' };
    const textarea = { tagName: 'TEXTAREA' };
    const editable = { tagName: 'DIV', isContentEditable: true };
    assert.equal(idOf(keyEvent('a', { target: input })), null);
    assert.equal(idOf(keyEvent('/', { target: textarea })), null);
    assert.equal(idOf(keyEvent('0', { target: editable })), null);
    assert.equal(idOf(keyEvent('Escape', { target: input })), 'escape');
  });

  test('キーの割り当てが重複していない', () => {
    const keys = KEYBOARD_SHORTCUTS.flatMap((s) => s.keys);
    assert.equal(new Set(keys).size, keys.length);
  });
});
