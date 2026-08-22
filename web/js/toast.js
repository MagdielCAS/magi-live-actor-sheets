// A short message at the bottom of the screen. It confirms a roll or
// reports an error, then it fades away on its own.

let hideTimer = null;

export function showToast(message, kind = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.dataset.kind = kind;
  el.classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 2600);
}
