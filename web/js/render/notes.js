// The Notes tab: the sanitized biography, and the trait, ideal, bond, and
// flaw fields as editable text areas.

import { esc, debounce, cardTitle } from '../util.js';
import { sanitizeHtml } from '../sanitize.js';
import { ACTOR_PATH } from '../paths.js';

const FIELDS = [
  { key: 'trait', label: 'Trait', path: ACTOR_PATH.trait },
  { key: 'ideal', label: 'Ideal', path: ACTOR_PATH.ideal },
  { key: 'bond', label: 'Bond', path: ACTOR_PATH.bond },
  { key: 'flaw', label: 'Flaw', path: ACTOR_PATH.flaw },
];

function template(sheet) {
  const fieldRows = FIELDS.map(
    (f) => `
      <section class="card">
        ${cardTitle(f.label)}
        <textarea class="note-textarea" data-field="${f.key}" rows="3">${esc(sheet.notes[f.key])}</textarea>
      </section>`
  ).join('');

  return `
    <section class="card">
      ${cardTitle('Biography')}
      <div class="biography-content">${sanitizeHtml(sheet.notes.biography)}</div>
    </section>
    ${fieldRows}
  `;
}

export function renderNotes(container, sheet, ctx) {
  container.innerHTML = template(sheet);

  for (const f of FIELDS) {
    const textarea = container.querySelector(`[data-field="${f.key}"]`);
    const commit = debounce((value) => {
      ctx.applyLocal((s) => (s.notes[f.key] = value));
      ctx.patchActor({ [f.path]: value });
    }, 600);
    textarea.addEventListener('input', () => commit(textarea.value));
  }
}
