// Small helpers shared by the render modules.
// Keep this file free of protocol knowledge. It only helps build the DOM.

// Escape text for safe use inside an HTML template string.
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

// Clamp a number between a low and a high bound.
export function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

// Run fn a short time after the last call. Use for text input writes.
export function debounce(fn, waitMs) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

// Format a signed modifier, e.g. 3 -> "+3", -1 -> "-1", 0 -> "+0".
export function signed(n) {
  const num = Number(n) || 0;
  return num >= 0 ? `+${num}` : `${num}`;
}
