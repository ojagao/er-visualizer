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

function openSchemaModal() {
  dom.schemaModal.classList.remove('hidden');
  dom.sqlInput.focus();
}

function closeSchemaModal() {
  dom.schemaModal.classList.add('hidden');
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
