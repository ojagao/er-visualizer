/**
 * テスト用ヘルパー: ブラウザ向けクラシックスクリプトを vm コンテキストへ順に読み込み、
 * トップレベルの const / class / function を取り出す。
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const JS_DIR = path.resolve(__dirname, '..', 'js');

/**
 * @param {string[]} files js/ 配下のファイル名 (依存順)
 * @param {string[]} exportNames コンテキストから取り出す識別子
 * @param {object} [globals] コンテキストに追加するグローバル (ブラウザ API のスタブなど)
 */
function loadScripts(files, exportNames, globals = {}) {
  const context = vm.createContext({ console, ...globals });

  files.forEach((file) => {
    const code = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
    vm.runInContext(code, context, { filename: file });
  });

  return vm.runInContext(`({ ${exportNames.join(', ')} })`, context);
}

/** vm コンテキスト由来の値を Node 側の素の配列・オブジェクトに変換 (deepStrictEqual 用) */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { loadScripts, plain };
