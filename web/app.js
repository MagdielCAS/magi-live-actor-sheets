// Entry point. Reads the URL and localStorage, connects to the server (or
// loads fixture data), and wires the tab bar, the badge, and the render
// modules to the WebSocket client.

import { WSClient } from './js/ws.js';
import * as state from './js/state.js';
import { fixtureSheet } from './js/fixture.js';
import { showToast } from './js/toast.js';
import { renderMain } from './js/render/main.js';
import { renderSkills } from './js/render/skills.js';
import { renderCombat } from './js/render/combat.js';
import { renderSpells } from './js/render/spells.js';
import { renderItems } from './js/render/items.js';
import { renderNotes } from './js/render/notes.js';

const TOKEN_KEY = 'magi.token';

const RENDERERS = {
  main: renderMain,
  skills: renderSkills,
  combat: renderCombat,
  spells: renderSpells,
  items: renderItems,
  notes: renderNotes,
};

const params = new URLSearchParams(location.search);
const isFixture = params.get('fixture') === '1';
const urlActorId = params.get('actorId');
const urlCode = params.get('c');

let ws = null;
let activeTab = 'main';
let connectionState = 'offline'; // 'connecting' | 'live' | 'reconnecting' | 'offline'
let bridgeOnline = null; // null: unknown yet. true/false: from bridge.state.

const panels = {};
const ctx = {
  patchActor: (changes) => sendPatch('actor', changes),
  patchItem: (itemId, changes) => sendPatch('item', changes, itemId),
  roll: (kind, opts) => sendRoll(kind, opts),
  use: (itemId, level) => sendUse(itemId, level),
  chat: (text, emote) => sendChat(text, emote),
  applyLocal: (mutator) => {
    state.applyLocal(mutator);
    renderActiveTab();
  },
  toast: showToast,
};

function init() {
  for (const tab of Object.keys(RENDERERS)) {
    panels[tab] = document.getElementById(`tab-${tab}`);
  }
  wireTabBar();
  wirePairingForm();

  if (isFixture) {
    startFixture();
    return;
  }
  if (urlActorId) {
    startLive({ actorId: urlActorId });
    return;
  }
  const token = localStorage.getItem(TOKEN_KEY);
  if (urlCode || !token) {
    showPairing(urlCode);
    return;
  }
  startLive({ token });
}

// --- Fixture mode: no server, used for local development ---

function startFixture() {
  state.setSheet(fixtureSheet());
  showSheet();
  document.getElementById('badge').textContent = 'Fixture';
  document.getElementById('badge').dataset.state = 'fixture';
  renderActiveTab();
}

// --- Pairing ---

function showPairing(prefillCode) {
  document.getElementById('pairing').classList.remove('hidden');
  document.getElementById('sheet').classList.add('hidden');
  document.getElementById('tabbar').classList.add('hidden');
  if (prefillCode) {
    document.getElementById('pairing-code').value = prefillCode;
  }
}

function wirePairingForm() {
  const form = document.getElementById('pairing-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('pairing-code').value.trim();
    if (code) submitPairing(code);
  });
}

async function submitPairing(code) {
  const errorEl = document.getElementById('pairing-error');
  errorEl.textContent = '';
  try {
    const res = await fetch('/api/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      throw new Error('The code is not valid, or it expired. Ask the GM for a new one.');
    }
    const body = await res.json();
    localStorage.setItem(TOKEN_KEY, body.token);
    document.getElementById('pairing').classList.add('hidden');
    startLive({ token: body.token });
  } catch (err) {
    errorEl.textContent = err.message || 'Pairing failed.';
  }
}

// --- Live connection ---

function startLive(auth) {
  ws = new WSClient(auth);
  ws.on('snapshot', (dto) => {
    state.setSheet(dto);
    showSheet();
    renderActiveTab();
  });
  ws.on('bridgeState', (payload) => {
    bridgeOnline = payload.online;
    updateBadge();
  });
  ws.on('connectionState', (nextState) => {
    connectionState = nextState;
    updateBadge();
  });
  updateBadge();
  ws.connect();
}

function updateBadge() {
  const badge = document.getElementById('badge');
  if (connectionState === 'live') {
    if (bridgeOnline === false) {
      badge.textContent = 'GM offline';
      badge.dataset.state = 'bridge-offline';
    } else {
      badge.textContent = 'Live';
      badge.dataset.state = 'live';
    }
    return;
  }
  if (connectionState === 'connecting' || connectionState === 'reconnecting') {
    badge.textContent = 'Reconnecting…';
    badge.dataset.state = 'reconnecting';
    return;
  }
  badge.textContent = 'Offline';
  badge.dataset.state = 'offline';
}

// --- Outgoing messages (protocol.md section 4.2) ---

async function sendPatch(target, changes, itemId) {
  if (isFixture) return;
  const payload = target === 'item' ? { target, itemId, changes } : { target, changes };
  try {
    await ws.send('actor.patch', payload);
  } catch (err) {
    showToast(err.message || 'The save failed.', 'error');
  }
}

async function sendRoll(kind, opts) {
  if (isFixture) {
    showToast('Roll sent (fixture mode).');
    return;
  }
  try {
    await ws.send('actor.roll', { kind, ...opts });
    showToast('Roll sent.');
  } catch (err) {
    showToast(err.message || 'The roll failed.', 'error');
  }
}

async function sendUse(itemId, level) {
  if (isFixture) return;
  try {
    await ws.send('actor.use', level != null ? { itemId, level } : { itemId });
  } catch (err) {
    showToast(err.message || 'The action failed.', 'error');
  }
}

async function sendChat(text, emote) {
  if (isFixture) {
    showToast('Message sent (fixture mode).');
    return;
  }
  try {
    await ws.send('actor.chat', { text, emote });
  } catch (err) {
    showToast(err.message || 'The message failed.', 'error');
  }
}

// --- Tabs and rendering ---

function showSheet() {
  document.getElementById('pairing').classList.add('hidden');
  document.getElementById('sheet').classList.remove('hidden');
  document.getElementById('tabbar').classList.remove('hidden');
}

function wireTabBar() {
  for (const btn of document.querySelectorAll('.tab-btn')) {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  }
}

function switchTab(tab) {
  if (tab === activeTab) return;
  activeTab = tab;
  for (const [name, panel] of Object.entries(panels)) {
    panel.hidden = name !== tab;
  }
  for (const btn of document.querySelectorAll('.tab-btn')) {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  }
  renderActiveTab();
}

// Re-render the active tab only. Keep the focus and the caret position of
// an input the user is editing right now (protocol.md section 10).
function renderActiveTab() {
  const sheet = state.getSheet();
  if (!sheet) return;
  const panel = panels[activeTab];
  const active = document.activeElement;
  let focusField = null;
  let selStart = null;
  let selEnd = null;
  if (active && panel.contains(active) && active.dataset.field) {
    focusField = active.dataset.field;
    if (typeof active.selectionStart === 'number') {
      selStart = active.selectionStart;
      selEnd = active.selectionEnd;
    }
  }

  RENDERERS[activeTab](panel, sheet, ctx);

  if (focusField) {
    const el = panel.querySelector(`[data-field="${CSS.escape(focusField)}"]`);
    if (el) {
      el.focus();
      if (selStart !== null && typeof el.setSelectionRange === 'function') {
        try {
          el.setSelectionRange(selStart, selEnd);
        } catch {
          // Not a text field that supports a selection range. Ignore it.
        }
      }
    }
  }
}

init();
