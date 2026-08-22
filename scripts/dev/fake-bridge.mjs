#!/usr/bin/env node
// A test bridge for development.
//
// This script speaks the bridge side of docs/protocol.md. It lets you run the
// server and the web page without Foundry VTT. It holds one example character
// in memory, it applies patches to that character, and it prints the rolls.
//
// Usage:
//   node scripts/dev/fake-bridge.mjs [--url ws://127.0.0.1:30001] [--secret S]
//
// Node 22 or later is necessary, because this script uses the global WebSocket.

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const out = {
    url: process.env.MAGI_URL ?? "ws://127.0.0.1:30001",
    secret: process.env.MAGI_BRIDGE_SECRET ?? "dev-secret",
    fixture: resolve(REPO, "web", "js", "fixture.js"),
  };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (key in out && argv[i + 1] !== undefined) out[key] = argv[i + 1];
  }
  return out;
}

const opts = parseArgs(process.argv.slice(2));

/* ------------------------------------------------------------------ */
/* The example character                                               */
/* ------------------------------------------------------------------ */

// The web page and this script use the same example character. This keeps the
// two sides equal. If the file is absent, the script stops with a clear message.
async function loadSheet(path) {
  let mod;
  try {
    mod = await import(pathToFileURL(path).href);
  } catch (err) {
    console.error(`Cannot read the example character at ${path}`);
    console.error(String(err.message ?? err));
    process.exit(1);
  }
  const sheet = mod.default ?? mod.fixture ?? Object.values(mod).find(isSheet);
  if (!isSheet(sheet)) {
    console.error(`The file ${path} does not export a SheetDTO object.`);
    process.exit(1);
  }
  return structuredClone(sheet);
}

function isSheet(v) {
  return !!v && typeof v === "object" && typeof v.id === "string" && !!v.abilities;
}

/* ------------------------------------------------------------------ */
/* Patch paths                                                         */
/* ------------------------------------------------------------------ */

// The protocol uses Foundry document paths. The example character uses the
// SheetDTO shape. This table joins the two, so a patch changes what you see.
const ACTOR_PATHS = {
  "system.attributes.hp.value": (s, v) => (s.hp.value = num(v)),
  "system.attributes.hp.max": (s, v) => (s.hp.max = num(v)),
  "system.attributes.hp.temp": (s, v) => (s.hp.temp = num(v)),
  "system.attributes.hp.tempmax": (s, v) => (s.hp.tempmax = num(v)),
  "system.attributes.death.success": (s, v) => (s.deathSaves.success = num(v)),
  "system.attributes.death.failure": (s, v) => (s.deathSaves.failure = num(v)),
  "system.attributes.exhaustion": (s, v) => (s.header.exhaustion = num(v)),
  "system.attributes.inspiration": (s, v) => (s.header.inspiration = !!v),
  "system.details.biography.value": (s, v) => (s.notes.biography = String(v)),
  "system.details.trait": (s, v) => (s.notes.trait = String(v)),
  "system.details.ideal": (s, v) => (s.notes.ideal = String(v)),
  "system.details.bond": (s, v) => (s.notes.bond = String(v)),
  "system.details.flaw": (s, v) => (s.notes.flaw = String(v)),
};

const ITEM_PATHS = {
  "system.quantity": (it, v) => (it.qty = num(v)),
  "system.equipped": (it, v) => (it.equipped = !!v),
  "system.preparation.prepared": (it, v) => (it.prepared = !!v),
  "system.uses.spent": (it, v) => setSpent(it, num(v)),
  "system.uses.value": (it, v) => {
    if (it.uses) it.uses.value = num(v);
  },
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function setSpent(item, spent) {
  if (!item.uses) return;
  item.uses.value = Math.max(0, (item.uses.max ?? 0) - spent);
}

function applyActorPatch(sheet, changes) {
  for (const [path, value] of Object.entries(changes)) {
    const slot = path.match(/^system\.spells\.spell([1-9])\.value$/);
    if (slot) {
      const level = Number(slot[1]);
      const entry = sheet.spells?.slots?.find((s) => s.level === level);
      if (entry) entry.value = num(value);
      continue;
    }
    const currency = path.match(/^system\.currency\.(pp|gp|ep|sp|cp)$/);
    if (currency) {
      sheet.currency[currency[1]] = num(value);
      continue;
    }
    const resource = path.match(/^system\.resources\.(primary|secondary|tertiary)\.value$/);
    if (resource) {
      const entry = sheet.resources?.find((r) => r.key === resource[1]);
      if (entry) entry.value = num(value);
      continue;
    }
    const apply = ACTOR_PATHS[path];
    if (!apply) throw new Error(`This test bridge does not know the path ${path}`);
    apply(sheet, value);
  }
}

function applyItemPatch(sheet, itemId, changes) {
  const item = findItem(sheet, itemId);
  if (!item) throw new Error(`There is no item with the id ${itemId}`);
  for (const [path, value] of Object.entries(changes)) {
    const apply = ITEM_PATHS[path];
    if (!apply) throw new Error(`This test bridge does not know the path ${path}`);
    apply(item, value);
  }
}

function findItem(sheet, itemId) {
  const lists = [sheet.attacks, sheet.inventory, sheet.spells?.list, sheet.features];
  for (const list of lists) {
    const hit = list?.find((i) => i.itemId === itemId);
    if (hit) return hit;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* The bridge                                                          */
/* ------------------------------------------------------------------ */

const sheet = await loadSheet(opts.fixture);
sheet.rev = 1;

let socket = null;
let backoff = 1000;

function send(type, payload, extra = {}) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ v: 1, type, payload, ...extra }));
}

function sendSnapshot() {
  sheet.rev += 1;
  send("actor.snapshot", sheet, { actorId: sheet.id });
  console.log(`→ snapshot rev ${sheet.rev}`);
}

function result(id, ok, error) {
  send("command.result", ok ? { ok: true } : { ok: false, error }, { id });
}

const handlers = {
  "bridge.ready": (msg) => {
    console.log("The server accepted the bridge.", msg.payload ?? {});
    send("actor.list", { actors: [{ id: sheet.id, name: sheet.name, img: sheet.img }] });
    sendSnapshot();
  },

  "subscriptions.set": (msg) => {
    console.log("Subscribed actors:", msg.payload?.actorIds ?? []);
  },

  "actor.request": () => sendSnapshot(),

  "command.patch": (msg) => {
    const { target, itemId, changes } = msg.payload ?? {};
    if (target === "item") applyItemPatch(sheet, itemId, changes ?? {});
    else applyActorPatch(sheet, changes ?? {});
    console.log(`← patch ${target ?? "actor"}`, changes);
    result(msg.id, true);
    sendSnapshot();
  },

  "command.roll": (msg) => {
    const { kind, key, itemId, advantage } = msg.payload ?? {};
    const d20 = 1 + Math.floor(Math.random() * 20);
    console.log(`← roll ${kind} ${key ?? itemId ?? ""} ${advantage ?? ""} → d20 = ${d20}`);
    result(msg.id, true);
  },

  "command.use": (msg) => {
    const item = findItem(sheet, msg.payload?.itemId);
    console.log(`← use ${item?.name ?? msg.payload?.itemId}`);
    result(msg.id, true);
  },

  "command.chat": (msg) => {
    console.log(`← chat: ${msg.payload?.text}`);
    result(msg.id, true);
  },

  "pairing.issued": (msg) => {
    const { code, url, expiresAt } = msg.payload ?? {};
    console.log(`Pairing code ${code} for ${url}. It expires at ${expiresAt}.`);
  },
};

function connect() {
  console.log(`Connecting to ${opts.url}/ws/bridge …`);
  socket = new WebSocket(`${opts.url.replace(/\/$/, "")}/ws/bridge`);

  socket.addEventListener("open", () => {
    backoff = 1000;
    send("bridge.hello", {
      secret: opts.secret,
      worldId: "dev-world",
      worldTitle: "Development World",
      systemId: "dnd5e",
      systemVersion: "5.3.3",
      foundryVersion: "14.0.0",
      moduleVersion: "0.1.0",
    });
  });

  socket.addEventListener("message", (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      console.error("The server sent text that is not JSON.");
      return;
    }
    const handler = handlers[msg.type];
    if (!handler) return console.log(`Ignored message type ${msg.type}`);
    try {
      handler(msg);
    } catch (err) {
      console.error(`${msg.type} failed: ${err.message}`);
      if (msg.id) result(msg.id, false, err.message);
    }
  });

  socket.addEventListener("close", (event) => {
    console.log(`The connection closed. Code ${event.code}. ${event.reason ?? ""}`);
    if (event.code === 1008) {
      console.error("The server refused the secret. Check --secret.");
      process.exit(1);
    }
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 15000);
  });

  socket.addEventListener("error", () => {
    /* The close event follows. It does the report. */
  });
}

// A change every 20 seconds shows that Foundry can also push data.
setInterval(() => {
  if (socket?.readyState !== WebSocket.OPEN) return;
  sheet.hp.value = Math.max(0, Math.min(sheet.hp.max, sheet.hp.value + (Math.random() < 0.5 ? -1 : 1)));
  console.log(`Simulated a change in Foundry. Hit points are now ${sheet.hp.value}.`);
  sendSnapshot();
}, 20000);

process.on("SIGINT", () => {
  socket?.close(1000, "The user stopped the test bridge.");
  process.exit(0);
});

connect();

