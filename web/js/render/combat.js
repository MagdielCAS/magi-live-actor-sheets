// The Combat tab: the attacks list. Each row rolls an attack or damage,
// or uses the item.

import { esc } from '../util.js';

function template(sheet) {
  if (!sheet.attacks.length) {
    return `<p class="empty-note">No attacks.</p>`;
  }
  return sheet.attacks
    .map(
      (a) => `
      <div class="card attack-row">
        <div class="attack-info">
          <span class="attack-name">${esc(a.name)}</span>
          <span class="attack-stats">${esc(a.toHit)} to hit · ${esc(a.damage)}</span>
        </div>
        <div class="attack-buttons">
          <button type="button" class="btn" data-action="attack" data-item="${esc(a.itemId)}">Attack</button>
          <button type="button" class="btn" data-action="damage" data-item="${esc(a.itemId)}">Damage</button>
          <button type="button" class="btn" data-action="use" data-item="${esc(a.itemId)}">Use</button>
        </div>
      </div>`
    )
    .join('');
}

export function renderCombat(container, sheet, ctx) {
  container.innerHTML = template(sheet);

  for (const btn of container.querySelectorAll('[data-action="attack"]')) {
    btn.addEventListener('click', () => ctx.roll('attack', { itemId: btn.dataset.item }));
  }
  for (const btn of container.querySelectorAll('[data-action="damage"]')) {
    btn.addEventListener('click', () => ctx.roll('damage', { itemId: btn.dataset.item }));
  }
  for (const btn of container.querySelectorAll('[data-action="use"]')) {
    btn.addEventListener('click', () => ctx.use(btn.dataset.item));
  }
}
