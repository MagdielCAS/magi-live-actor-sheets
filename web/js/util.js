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

// Commit the value of a number input when the user leaves it or presses
// Enter.
//
// The commit runs only if the value is different from the value the input
// was drawn with. This is necessary, and not only an economy: a snapshot
// draws the tab again, which removes the input that has the focus, which
// sends a blur event. Without the comparison, that blur writes the same
// value again, the write makes a new snapshot, and the two steps repeat
// without end.
export function commitOnBlurOrEnter(input, commit) {
  const drawnWith = input.value;
  let done = false;

  const run = () => {
    if (done || input.value === drawnWith) return;
    done = true;
    commit(input.value);
  };

  input.addEventListener('blur', run);
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    run();
    input.blur();
  });
}

// Format a signed modifier, e.g. 3 -> "+3", -1 -> "-1", 0 -> "+0".
export function signed(n) {
  const num = Number(n) || 0;
  return num >= 0 ? `+${num}` : `${num}`;
}

// A card title: the words, then a gold hairline that runs from the end of
// the words to the edge of the card.
export function cardTitle(text) {
  return `<h2 class="card-title">${esc(text)}<span class="card-title-rule" aria-hidden="true"></span></h2>`;
}
