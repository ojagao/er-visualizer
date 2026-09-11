/**
 * スキーマ入力 (SQL DDL) モーダル
 */

const PARSE_STATUS_CLASS = Object.freeze({
  info: 'text-xs text-slate-400 font-mono',
  success: 'text-xs text-emerald-400 font-mono',
  warn: 'text-xs text-amber-400 font-mono',
  error: 'text-xs text-rose-400 font-mono',
});

function setParseStatus(message, tone = 'info') {
  dom.parseStatusMsg.textContent = message;
  dom.parseStatusMsg.className = PARSE_STATUS_CLASS[tone] || PARSE_STATUS_CLASS.info;
}

function updateSqlStats() {
  dom.sqlStats.textContent = `${dom.sqlInput.value.length.toLocaleString()} 文字`;
}

function setSqlInput(value) {
  dom.sqlInput.value = value;
  updateSqlStats();
}

function isSchemaModalOpen() {
  return !dom.schemaModal.classList.contains('hidden');
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// モーダルを開いたときにフォーカスがあった要素 (閉じたら戻す)
let modalOpener = null;

/** Tab 巡回先のインデックス (末尾の次は先頭、先頭の前は末尾) */
function cycleIndex(currentIndex, length, backwards) {
  if (length === 0) return -1;
  if (currentIndex === -1) return backwards ? length - 1 : 0;
  return (currentIndex + (backwards ? -1 : 1) + length) % length;
}

/** Tab / Shift+Tab がモーダルの外へ出ないように巡回させる */
function trapModalFocus(event) {
  if (event.key !== 'Tab' || !isSchemaModalOpen()) return;

  const focusable = Array.from(dom.schemaModal.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null,
  );
  if (!focusable.length) return;

  const currentIndex = focusable.indexOf(document.activeElement);
  const atEdge = event.shiftKey ? currentIndex <= 0 : currentIndex === -1 || currentIndex === focusable.length - 1;
  if (!atEdge) return;

  event.preventDefault();
  focusable[cycleIndex(currentIndex, focusable.length, event.shiftKey)].focus();
}

function openSchemaModal() {
  modalOpener = document.activeElement;
  dom.schemaModal.classList.remove('hidden');
  dom.sqlInput.focus();
}

function closeSchemaModal() {
  dom.schemaModal.classList.add('hidden');
  if (modalOpener && typeof modalOpener.focus === 'function' && !dom.schemaModal.contains(modalOpener)) {
    modalOpener.focus();
  }
  modalOpener = null;
}

/** 入力 SQL をパースしてダイアグラムを生成 */
function handleParseAndRender() {
  const rawSql = dom.sqlInput.value.trim();
  if (!rawSql) {
    setParseStatus('SQLを入力してください。', 'error');
    return;
  }

  try {
    const inferFk = dom.optInferFk.checked;
    const parsed = UniversalDDLParser.parse(rawSql, { inferFk });

    if (!parsed.tables.length) {
      setParseStatus('CREATE TABLE 文が見つかりませんでした。', 'warn');
      return;
    }

    setParseStatus(`${parsed.tables.length} テーブル / ${parsed.relations.length} リレーションを検出`, 'success');
    applyParsedSchema(parsed, APP_CONFIG.timing.parseRenderMs, { source: { sql: rawSql, inferFk } });
    closeSchemaModal();
  } catch (error) {
    console.error('DDL parse failed:', error);
    setParseStatus(`パースエラー: ${error.message}`, 'error');
  }
}

function setupSchemaModal() {
  dom.btnOpenSchemaModal.addEventListener('click', openSchemaModal);
  dom.btnCloseModal.addEventListener('click', closeSchemaModal);
  dom.btnCancelModal.addEventListener('click', closeSchemaModal);
  dom.schemaModal.addEventListener('click', (event) => {
    if (event.target === dom.schemaModal) closeSchemaModal();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isSchemaModalOpen()) closeSchemaModal();
  });
  window.addEventListener('keydown', trapModalFocus);

  dom.presetBlog.addEventListener('click', () => setSqlInput(SCHEMA_PRESETS.blog));
  dom.presetEcommerce.addEventListener('click', () => setSqlInput(SCHEMA_PRESETS.ecommerce));
  dom.presetClear.addEventListener('click', () => setSqlInput(''));
  dom.presetReset.addEventListener('click', () => {
    clearWorkspace();
    loadDefaultSchema();
    closeSchemaModal();
  });

  dom.sqlInput.addEventListener('input', updateSqlStats);
  dom.btnParseAndRender.addEventListener('click', handleParseAndRender);
}
