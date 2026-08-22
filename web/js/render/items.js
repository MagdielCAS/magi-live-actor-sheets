// The Items tab: inventory with quantity steppers, an equipped toggle, a
// use button when the item has uses, and the currency row.

import { esc, clamp, commitOnBlurOrEnter } from '../util.js';
import { ITEM_PATH, currencyPath } from '../paths.js';

const CURRENCY_KEYS = ['pp', 'gp', 'ep', 'sp', 'cp'];

function itemRow(item) {
  const useButton = item.uses
    ? `<button type="button" class="btn" data-action="use" data-item="${esc(item.itemId)}">
        Use (${item.uses.value}/${item.uses.max})
      </button>`
    : '';
  return `
    <div class="card item-row">
      <div class="item-info">
        <span class="item-name">${esc(item.name)}</span>
        <span class="item-weight">${item.weight ?? 0} lb</span>
      </div>
      <div class="item-controls">
        <div class="stepper">
          <button type="button" class="stepper-btn" data-action="qty-dec" data-item="${esc(item.itemId)}" aria-label="Decrease quantity">−</button>
          <span class="stepper-value">${item.qty}</span>
          <button type="button" class="stepper-btn" data-action="qty-inc" data-item="${esc(item.itemId)}" aria-label="Increase quantity">+</button>
        </div>
        <label class="item-equipped">
          <input type="checkbox" data-action="equipped" data-item="${esc(item.itemId)}" ${item.equipped ? 'checked' : ''}>
          Equipped
        </label>
        ${useButton}
      </div>
    </div>`;
}

function template(sheet) {
  const rows = sheet.inventory.map(itemRow).join('') || '<p class="empty-note">No items.</p>';
  const currencyInputs = CURRENCY_KEYS.map(
    (key) => `
      <div class="currency-field">
        <label for="currency-${key}">${key}</label>
        <input type="number" id="currency-${key}" class="currency-input" data-field="currency-${key}" min="0"
          value="${sheet.currency[key] ?? 0}">
      </div>`
  ).join('');

  return `
    <section class="card currency-card">
      <h2 class="card-title">Currency</h2>
      <div class="currency-row">${currencyInputs}</div>
    </section>
    <section class="item-list">${rows}</section>
  `;
}

export function renderItems(container, sheet, ctx) {
  container.innerHTML = template(sheet);

  for (const key of CURRENCY_KEYS) {
    const input = container.querySelector(`[data-field="currency-${key}"]`);
    commitOnBlurOrEnter(input, (raw) => {
      const value = Math.max(0, Number(raw) || 0);
      ctx.applyLocal((s) => (s.currency[key] = value));
      ctx.patchActor({ [currencyPath(key)]: value });
    });
  }

  for (const btn of container.querySelectorAll('[data-action="qty-dec"], [data-action="qty-inc"]')) {
    btn.addEventListener('click', () => {
      const delta = btn.dataset.action === 'qty-inc' ? 1 : -1;
      setQty(sheet, ctx, btn.dataset.item, delta);
    });
  }

  for (const box of container.querySelectorAll('[data-action="equipped"]')) {
    box.addEventListener('change', (e) => {
      const itemId = box.dataset.item;
      const equipped = e.target.checked;
      ctx.applyLocal((s) => {
        const item = s.inventory.find((i) => i.itemId === itemId);
        if (item) item.equipped = equipped;
      });
      ctx.patchItem(itemId, { [ITEM_PATH.equipped]: equipped });
    });
  }

  for (const btn of container.querySelectorAll('[data-action="use"]')) {
    btn.addEventListener('click', () => ctx.use(btn.dataset.item));
  }
}


function setQty(sheet, ctx, itemId, delta) {
  const item = sheet.inventory.find((i) => i.itemId === itemId);
  if (!item) return;
  const value = clamp(item.qty + delta, 0, 999);
  ctx.applyLocal((s) => {
    const target = s.inventory.find((i) => i.itemId === itemId);
    if (target) target.qty = value;
  });
  ctx.patchItem(itemId, { [ITEM_PATH.quantity]: value });
}
