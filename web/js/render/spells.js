// The Spells tab: slot pips per level, and the spell list grouped by
// level with a prepared toggle and a Cast button.

import { esc, clamp, cardTitle } from '../util.js';
import { slotPath, ITEM_PATH } from '../paths.js';

function levelLabel(level) {
  return level === 0 ? 'Cantrips' : `Level ${level}`;
}

// A pact slot and a normal slot can share a level, so a level is not a
// name. This key tells the two apart.
function slotKey(slot) {
  return slot.pact ? 'pact' : `spell${slot.level}`;
}

function slotLabel(slot) {
  return slot.pact ? `Pact (level ${slot.level})` : levelLabel(slot.level);
}

function slotPips(slot) {
  const pips = [];
  for (let i = 1; i <= slot.max; i += 1) {
    pips.push(
      `<button type="button" class="pip pip-slot ${i <= slot.value ? 'filled' : ''}"
        data-action="slot" data-slot="${slotKey(slot)}" data-index="${i}"
        aria-label="${slotLabel(slot)}, slot ${i}"></button>`
    );
  }
  return pips.join('');
}

function groupByLevel(list) {
  const groups = new Map();
  for (const spell of list) {
    if (!groups.has(spell.level)) groups.set(spell.level, []);
    groups.get(spell.level).push(spell);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

function template(sheet) {
  const slotsHtml = sheet.spells.slots
    .map(
      (slot) => `
      <div class="slot-row">
        <span class="slot-label">${slotLabel(slot)}</span>
        <div class="pip-row">${slotPips(slot)}</div>
      </div>`
    )
    .join('');

  const groups = groupByLevel(sheet.spells.list);
  const listHtml = groups
    .map(([level, spells]) => `
      <section class="card">
        ${cardTitle(levelLabel(level))}
        <div class="spell-list">
          ${spells
            .map(
              (sp) => `
            <div class="spell-row">
              <span class="spell-name">${esc(sp.name)}</span>
              <label class="spell-prepared">
                <input type="checkbox" data-action="prepared" data-item="${esc(sp.itemId)}" ${sp.prepared ? 'checked' : ''}>
                Prepared
              </label>
              <button type="button" class="btn btn-roll" data-action="cast" data-item="${esc(sp.itemId)}">Cast</button>
            </div>`
            )
            .join('')}
        </div>
      </section>`)
    .join('');

  return `
    ${sheet.spells.slots.length ? `
    <section class="card slots-card">
      ${cardTitle('Spell Slots')}
      ${slotsHtml}
    </section>` : ''}
    ${listHtml || '<p class="empty-note">No spells.</p>'}
  `;
}

export function renderSpells(container, sheet, ctx) {
  container.innerHTML = template(sheet);

  for (const pip of container.querySelectorAll('[data-action="slot"]')) {
    pip.addEventListener('click', () => {
      const index = Number(pip.dataset.index);
      setSlot(sheet, ctx, pip.dataset.slot, index);
    });
  }

  for (const box of container.querySelectorAll('[data-action="prepared"]')) {
    box.addEventListener('change', (e) => {
      const itemId = box.dataset.item;
      const prepared = e.target.checked;
      ctx.applyLocal((s) => {
        const spell = s.spells.list.find((sp) => sp.itemId === itemId);
        if (spell) spell.prepared = prepared;
      });
      ctx.patchItem(itemId, { [ITEM_PATH.prepared]: prepared });
    });
  }

  for (const btn of container.querySelectorAll('[data-action="cast"]')) {
    btn.addEventListener('click', () => ctx.use(btn.dataset.item));
  }
}

function setSlot(sheet, ctx, key, index) {
  const slot = sheet.spells.slots.find((s) => slotKey(s) === key);
  if (!slot) return;
  const value = clamp(index <= slot.value ? index - 1 : index, 0, slot.max);
  ctx.applyLocal((s) => {
    const target = s.spells.slots.find((x) => slotKey(x) === key);
    if (target) target.value = value;
  });
  ctx.patchActor({ [slotPath(slot)]: value });
}
