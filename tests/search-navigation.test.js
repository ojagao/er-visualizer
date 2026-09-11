const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, plain } = require('./load-scripts');

const { getSearchMatches, pickNextMatch } = loadScripts(
  ['config.js', 'utils.js', 'search-navigation.js'],
  ['getSearchMatches', 'pickNextMatch'],
);

const table = (id, columns = []) => ({ id, name: id, columns: columns.map((name) => ({ name })) });
const TABLES = [table('users', ['id', 'email']), table('posts', ['id', 'user_id']), table('tags', ['id'])];

describe('getSearchMatches', () => {
  test('テーブル名またはカラム名に一致するテーブルを返す', () => {
    assert.deepEqual(plain(getSearchMatches(TABLES, 'user').map((t) => t.id)), ['users', 'posts']);
    assert.deepEqual(plain(getSearchMatches(TABLES, 'tag').map((t) => t.id)), ['tags']);
  });

  test('検索語が空なら空配列 (全件ではない)', () => {
    assert.deepEqual(plain(getSearchMatches(TABLES, '')), []);
  });
});

describe('pickNextMatch', () => {
  const ids = ['users', 'posts', 'tags'];

  test('選択が一致に含まれていなければ先頭 (逆順なら末尾) を返す', () => {
    assert.equal(pickNextMatch(ids, null, 1), 'users');
    assert.equal(pickNextMatch(ids, 'other', 1), 'users');
    assert.equal(pickNextMatch(ids, null, -1), 'tags');
  });

  test('現在の選択から順に巡回し、末尾の次は先頭へ戻る', () => {
    assert.equal(pickNextMatch(ids, 'users', 1), 'posts');
    assert.equal(pickNextMatch(ids, 'tags', 1), 'users');
    assert.equal(pickNextMatch(ids, 'users', -1), 'tags');
  });

  test('一致が無ければ null', () => {
    assert.equal(pickNextMatch([], 'users', 1), null);
  });
});
