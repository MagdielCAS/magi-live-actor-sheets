// The Main tab: identity, HP, core stats, death saves, exhaustion,
// resources, and the chat composer.

import { esc, signed, clamp, commitOnBlurOrEnter } from '../util.js';
import { ACTOR_PATH, resourcePath } from '../paths.js';

// Exhaustion is read-only. The dnd5e system calculates it from the
// exhaustion condition every time it prepares the actor, so a write to
// system.attributes.exhaustion has no effect.
function getExhaustion(sheet) {
  return Number(sheet.header.exhaustion ?? 0);
}

function initials(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function template(sheet) {
  const { header, hp, deathSaves, resources } = sheet;

  const portrait = sheet.img
    ? `<img class="portrait" src="${esc(sheet.img)}" alt="">`
    : `<div class="portrait portrait-fallback">${esc(initials(sheet.name))}</div>`;

  const resourceRows = resources
    .map(
      (r) => `
      <div class="resource-row">
        <span class="resource-label">${esc(r.label)}</span>
        <div class="stepper">
          <button type="button" class="stepper-btn" data-action="resource-dec" data-key="${esc(r.key)}" aria-label="Decrease ${esc(r.label)}">−</button>
          <span class="stepper-value">${r.value} / ${r.max}</span>
          <button type="button" class="stepper-btn" data-action="resource-inc" data-key="${esc(r.key)}" aria-label="Increase ${esc(r.label)}">+</button>
        </div>
      </div>`
    )
    .join('');

  const deathPips = (count, group) =>
    [1, 2, 3]
      .map(
        (i) => `
      <button type="button" class="pip pip-${group} ${i <= count ? 'filled' : ''}"
        data-action="death-${group}" data-index="${i}" aria-label="${group} ${i}"></button>`
      )
      .join('');

  return `
    <div class="portrait-header">
      ${portrait}
      <div class="identity">
        <h1 class="char-name">${esc(sheet.name)}</h1>
        <p class="char-sub">${esc(header.classes)} · ${esc(header.race)}</p>
      </div>
    </div>

    <section class="card hp-card">
      <div class="hp-readout">
        <input type="number" class="hp-num hp-current" data-field="hp-value" value="${hp.value}" aria-label="Current hit points">
        <span class="hp-slash">/</span>
        <input type="number" class="hp-num hp-max" data-field="hp-max" value="${hp.max}" aria-label="Max hit points">
      </div>
      <div class="hp-temp-row">
        <label for="hp-temp-input">Temp HP</label>
        <input type="number" id="hp-temp-input" class="hp-num" data-field="hp-temp" min="0" value="${hp.temp}">
      </div>
      <div class="hp-action-row">
        <input type="number" id="hp-amount" class="hp-amount-input" min="0" inputmode="numeric" placeholder="0" aria-label="Amount">
        <button type="button" class="btn btn-big btn-damage" data-action="damage">− Damage</button>
        <button type="button" class="btn btn-big btn-heal" data-action="heal">+ Heal</button>
      </div>
    </section>

    <section class="stat-row">
      <div class="stat-chip"><span class="stat-label">AC</span><span class="stat-value">${header.ac}</span></div>
      <button type="button" class="stat-chip stat-chip-action" data-action="roll-initiative">
        <span class="stat-label">Init</span><span class="stat-value">${signed(header.initiative)}</span>
      </button>
      <div class="stat-chip"><span class="stat-label">Speed</span><span class="stat-value">${esc(header.speed)}</span></div>
      <div class="stat-chip"><span class="stat-label">Prof</span><span class="stat-value">${signed(header.prof)}</span></div>
      <label class="stat-chip stat-chip-toggle">
        <span class="stat-label">Inspiration</span>
        <input type="checkbox" data-field="inspiration" ${header.inspiration ? 'checked' : ''}>
      </label>
    </section>

    <section class="card death-card">
      <h2 class="card-title">Death Saves</h2>
      <div class="death-row">
        <span class="death-label">Success</span>
        <div class="pip-row">${deathPips(deathSaves.success, 'success')}</div>
      </div>
      <div class="death-row">
        <span class="death-label">Failure</span>
        <div class="pip-row">${deathPips(deathSaves.failure, 'failure')}</div>
      </div>
    </section>

    <section class="card exhaustion-card">
      <h2 class="card-title">Exhaustion</h2>
      <div class="readonly-row">
        <span class="stepper-value">${getExhaustion(sheet)}</span>
        <span class="readonly-note">Change this in Foundry</span>
      </div>
    </section>

    ${resources.length ? `
    <section class="card resources-card">
      <h2 class="card-title">Resources</h2>
      ${resourceRows}
    </section>` : ''}

    <section class="card chat-card">
      <h2 class="card-title">Chat</h2>
      <div class="chat-row">
        <input type="text" id="chat-text" class="chat-input" placeholder="Say something...">
        <button type="button" class="btn" data-action="chat-send">Send</button>
      </div>
    </section>
  `;
}

export function renderMain(container, sheet, ctx) {
  container.innerHTML = template(sheet);

  const hpValueInput = container.querySelector('[data-field="hp-value"]');
  const hpMaxInput = container.querySelector('[data-field="hp-max"]');
  const hpTempInput = container.querySelector('[data-field="hp-temp"]');

  commitOnBlurOrEnter(hpValueInput, (raw) => {
    const value = clamp(Number(raw) || 0, 0, sheet.hp.max);
    ctx.applyLocal((s) => (s.hp.value = value));
    ctx.patchActor({ [ACTOR_PATH.hpValue]: value });
  });
  commitOnBlurOrEnter(hpMaxInput, (raw) => {
    const value = Math.max(1, Number(raw) || 1);
    ctx.applyLocal((s) => (s.hp.max = value));
    ctx.patchActor({ [ACTOR_PATH.hpMax]: value });
  });
  commitOnBlurOrEnter(hpTempInput, (raw) => {
    const value = Math.max(0, Number(raw) || 0);
    ctx.applyLocal((s) => (s.hp.temp = value));
    ctx.patchActor({ [ACTOR_PATH.hpTemp]: value });
  });

  container.querySelector('[data-action="damage"]').addEventListener('click', () => {
    const amount = Math.max(0, Number(container.querySelector('#hp-amount').value) || 0);
    if (amount === 0) return;
    applyDamage(sheet, ctx, amount);
  });
  container.querySelector('[data-action="heal"]').addEventListener('click', () => {
    const amount = Math.max(0, Number(container.querySelector('#hp-amount').value) || 0);
    if (amount === 0) return;
    applyHeal(sheet, ctx, amount);
  });

  container.querySelector('[data-action="roll-initiative"]').addEventListener('click', () => {
    ctx.roll('initiative', {});
  });

  container.querySelector('[data-field="inspiration"]').addEventListener('change', (e) => {
    const value = e.target.checked;
    ctx.applyLocal((s) => (s.header.inspiration = value));
    ctx.patchActor({ [ACTOR_PATH.inspiration]: value });
  });

  for (const pip of container.querySelectorAll('[data-action="death-success"], [data-action="death-failure"]')) {
    pip.addEventListener('click', () => {
      const group = pip.dataset.action === 'death-success' ? 'success' : 'failure';
      const index = Number(pip.dataset.index);
      setDeathSave(sheet, ctx, group, index);
    });
  }

  for (const btn of container.querySelectorAll('[data-action="resource-dec"], [data-action="resource-inc"]')) {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const delta = btn.dataset.action === 'resource-inc' ? 1 : -1;
      setResource(sheet, ctx, key, delta);
    });
  }

  container.querySelector('[data-action="chat-send"]').addEventListener('click', () => sendChat(container, ctx));
  container.querySelector('#chat-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat(container, ctx);
  });
}


function applyDamage(sheet, ctx, amount) {
  const fromTemp = Math.min(sheet.hp.temp, amount);
  const remaining = amount - fromTemp;
  const newTemp = sheet.hp.temp - fromTemp;
  const newValue = clamp(sheet.hp.value - remaining, 0, sheet.hp.max);
  ctx.applyLocal((s) => {
    s.hp.temp = newTemp;
    s.hp.value = newValue;
  });
  const changes = { [ACTOR_PATH.hpValue]: newValue };
  if (fromTemp > 0) changes[ACTOR_PATH.hpTemp] = newTemp;
  ctx.patchActor(changes);
}

function applyHeal(sheet, ctx, amount) {
  const newValue = clamp(sheet.hp.value + amount, 0, sheet.hp.max);
  ctx.applyLocal((s) => (s.hp.value = newValue));
  ctx.patchActor({ [ACTOR_PATH.hpValue]: newValue });
}

function setDeathSave(sheet, ctx, group, index) {
  const current = sheet.deathSaves[group];
  const value = index <= current ? index - 1 : index;
  ctx.applyLocal((s) => (s.deathSaves[group] = value));
  const path = group === 'success' ? ACTOR_PATH.deathSuccess : ACTOR_PATH.deathFailure;
  ctx.patchActor({ [path]: value });
}


function setResource(sheet, ctx, key, delta) {
  const resource = sheet.resources.find((r) => r.key === key);
  if (!resource) return;
  const value = clamp(resource.value + delta, 0, resource.max);
  ctx.applyLocal((s) => {
    const r = s.resources.find((x) => x.key === key);
    if (r) r.value = value;
  });
  ctx.patchActor({ [resourcePath(key)]: value });
}

function sendChat(container, ctx) {
  const input = container.querySelector('#chat-text');
  const text = input.value.trim();
  if (!text) return;
  ctx.chat(text, false);
  input.value = '';
}
