// The Skills tab: six abilities (check and save), all skills, tools, and
// an advantage/disadvantage selector for the next roll.

import { esc, signed } from '../util.js';

// This selector applies to the next roll only. It lives here, not in the
// sheet, and it resets to "normal" once a roll is sent.
let advantageMode = 'normal';

function proficiencyClass(value) {
  if (value >= 2) return 'prof-expert';
  if (value >= 1) return 'prof-full';
  if (value > 0) return 'prof-half';
  return 'prof-none';
}

function template(sheet) {
  const abilityRows = sheet.abilities
    .map(
      (a) => `
      <div class="ability-card">
        <div class="ability-head">
          <span class="ability-label">${esc(a.label)}</span>
          <span class="ability-score">${a.value}</span>
        </div>
        <div class="ability-buttons">
          <button type="button" class="btn btn-roll" data-action="roll-ability" data-key="${a.key}">
            Check ${signed(a.mod)}
          </button>
          <button type="button" class="btn btn-roll ${a.proficient ? 'is-proficient' : ''}" data-action="roll-save" data-key="${a.key}">
            Save ${signed(a.save)}
          </button>
        </div>
      </div>`
    )
    .join('');

  const skillRows = sheet.skills
    .map(
      (s) => `
      <button type="button" class="skill-row" data-action="roll-skill" data-key="${s.key}">
        <span class="prof-dot ${proficiencyClass(s.proficiency)}" aria-hidden="true"></span>
        <span class="skill-label">${esc(s.label)}</span>
        <span class="skill-ability">${s.ability}</span>
        <span class="skill-mod">${signed(s.mod)}</span>
      </button>`
    )
    .join('');

  const toolRows = sheet.tools
    .map(
      (t) => `
      <button type="button" class="skill-row" data-action="roll-tool" data-key="${t.key}">
        <span class="skill-label">${esc(t.label)}</span>
        <span class="skill-mod">${signed(t.mod)}</span>
      </button>`
    )
    .join('');

  return `
    <div class="card advantage-card">
      <h2 class="card-title">Next Roll</h2>
      <div class="segmented" role="group" aria-label="Advantage for the next roll">
        <button type="button" class="segmented-btn" data-mode="disadvantage">Disadvantage</button>
        <button type="button" class="segmented-btn" data-mode="normal">Normal</button>
        <button type="button" class="segmented-btn" data-mode="advantage">Advantage</button>
      </div>
    </div>

    <section class="card">
      <h2 class="card-title">Abilities</h2>
      <div class="ability-grid">${abilityRows}</div>
    </section>

    <section class="card">
      <h2 class="card-title">Skills</h2>
      <div class="skill-list">${skillRows}</div>
    </section>

    ${sheet.tools.length ? `
    <section class="card">
      <h2 class="card-title">Tools</h2>
      <div class="skill-list">${toolRows}</div>
    </section>` : ''}
  `;
}

function applyAdvantageUI(container) {
  for (const btn of container.querySelectorAll('.segmented-btn')) {
    btn.classList.toggle('active', btn.dataset.mode === advantageMode);
  }
}

export function renderSkills(container, sheet, ctx) {
  container.innerHTML = template(sheet);
  applyAdvantageUI(container);

  for (const btn of container.querySelectorAll('.segmented-btn')) {
    btn.addEventListener('click', () => {
      advantageMode = btn.dataset.mode;
      applyAdvantageUI(container);
    });
  }

  const rollAndReset = (kind, key) => {
    ctx.roll(kind, { key, advantage: advantageMode });
    advantageMode = 'normal';
    applyAdvantageUI(container);
  };

  for (const btn of container.querySelectorAll('[data-action="roll-ability"]')) {
    btn.addEventListener('click', () => rollAndReset('ability', btn.dataset.key));
  }
  for (const btn of container.querySelectorAll('[data-action="roll-save"]')) {
    btn.addEventListener('click', () => rollAndReset('save', btn.dataset.key));
  }
  for (const btn of container.querySelectorAll('[data-action="roll-skill"]')) {
    btn.addEventListener('click', () => rollAndReset('skill', btn.dataset.key));
  }
  for (const btn of container.querySelectorAll('[data-action="roll-tool"]')) {
    btn.addEventListener('click', () => rollAndReset('tool', btn.dataset.key));
  }
}
