/**
 * トースト通知 (画面右下に数秒表示して自動で消える)
 */

const TOAST_TONE_CLASS = Object.freeze({
  info: 'border-slate-600 text-slate-100',
  success: 'border-emerald-500/60 text-emerald-100',
  error: 'border-rose-500/60 text-rose-100',
});

/**
 * @param {string} message
 * @param {'info'|'success'|'error'} tone
 */
function showToast(message, tone = 'info') {
  const toast = document.createElement('div');
  toast.className =
    'toast pointer-events-auto px-3.5 py-2 rounded-lg bg-slate-900/95 backdrop-blur border shadow-xl ' +
    `text-xs font-medium max-w-xs ${TOAST_TONE_CLASS[tone] || TOAST_TONE_CLASS.info}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, APP_CONFIG.timing.toastMs);
}
