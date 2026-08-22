// The adapter for the D&D 5e system, version 5.x.
//
// It turns a Foundry actor into the SheetDTO of docs/protocol.md section 6,
// and it performs the commands that arrive from a phone.
//
// Every field path and every roll signature below comes from the dnd5e
// source at github.com/foundryvtt/dnd5e (release 5.3.3, verified on Foundry
// v14). The roll methods all use the same shape: roll*(config, dialog,
// message).

import { checkPatch } from "../authz.mjs";

export const id = "dnd5e";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// The phone loads the page from the relay, not from Foundry. A Foundry
// image path is relative, so it must become absolute or the phone asks the
// relay for a file that it does not have.
function absoluteImage(path) {
  const value = String(path ?? "").trim();
  if (!value) return "";
  if (/^(https?:|data:)/i.test(value)) return value;
  try {
    return new URL(value, window.location.origin).href;
  } catch {
    return "";
  }
}

function usesOf(item) {
  const uses = item.system?.uses;
  // The system calculates uses.value as max minus spent. A value of zero
  // for max means the item has no limit on its use.
  if (!uses || !uses.max) return null;
  return { value: Number(uses.value ?? 0), max: Number(uses.max ?? 0) };
}

function labelOf(item, key) {
  const value = item.labels?.[key];
  return value ? String(value) : "";
}

// A background and a race are documents in dnd5e 5.x, not plain text.
function documentName(value) {
  if (!value) return "";
  return typeof value === "string" ? value : String(value.name ?? "");
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

function buildAbilities(actor) {
  const config = CONFIG.DND5E?.abilities ?? {};
  return Object.entries(actor.system?.abilities ?? {}).map(([key, ability]) => ({
    key,
    label: String(config[key]?.label ?? key.toUpperCase()),
    value: Number(ability.value ?? 0),
    mod: Number(ability.mod ?? 0),
    save: Number(ability.save?.value ?? ability.save ?? 0),
    proficient: Number(ability.proficient ?? 0) > 0,
  }));
}

function buildSkills(actor) {
  const config = CONFIG.DND5E?.skills ?? {};
  return Object.entries(actor.system?.skills ?? {}).map(([key, skill]) => ({
    key,
    label: String(config[key]?.label ?? key),
    ability: String(skill.ability ?? config[key]?.ability ?? ""),
    mod: Number(skill.total ?? 0),
    proficiency: Number(skill.value ?? 0),
    passive: Number(skill.passive ?? 0),
  }));
}

function buildTools(actor) {
  const tools = actor.system?.tools ?? {};
  return Object.entries(tools).map(([key, tool]) => ({
    key,
    label: String(CONFIG.DND5E?.tools?.[key]?.label ?? key),
    mod: Number(tool.total ?? 0),
  }));
}

function buildResources(actor) {
  const resources = actor.system?.resources ?? {};
  return ["primary", "secondary", "tertiary"]
    .map((key) => ({ key, resource: resources[key] }))
    .filter(({ resource }) => resource && Number(resource.max ?? 0) > 0)
    .map(({ key, resource }) => ({
      key,
      label: String(resource.label || key),
      value: Number(resource.value ?? 0),
      max: Number(resource.max ?? 0),
    }));
}

function buildSpellSlots(actor) {
  const spells = actor.system?.spells ?? {};
  const slots = [];
  for (let level = 1; level <= 9; level += 1) {
    const slot = spells[`spell${level}`];
    if (!slot || !Number(slot.max ?? 0)) continue;
    slots.push({ level, value: Number(slot.value ?? 0), max: Number(slot.max ?? 0) });
  }
  // Pact magic uses its own track. It is shown with its own level number.
  const pact = spells.pact;
  if (pact && Number(pact.max ?? 0) > 0) {
    slots.push({
      level: Number(pact.level ?? 0),
      value: Number(pact.value ?? 0),
      max: Number(pact.max ?? 0),
      pact: true,
    });
  }
  return slots;
}

// The system data model has this getter. It reports whether any activity of
// the item makes an attack roll.
function isAttack(item) {
  return Boolean(item.system?.hasAttack);
}

function buildItems(actor) {
  const attacks = [];
  const inventory = [];
  const spellList = [];
  const features = [];

  for (const item of actor.items) {
    const base = {
      itemId: item.id,
      name: String(item.name ?? ""),
      img: absoluteImage(item.img),
      uses: usesOf(item),
    };

    if (item.type === "spell") {
      spellList.push({
        ...base,
        level: Number(item.system?.level ?? 0),
        school: String(item.system?.school ?? ""),
        prepared: Boolean(item.system?.preparation?.prepared),
      });
      continue;
    }

    if (item.type === "feat" || item.type === "class" || item.type === "subclass") {
      features.push(base);
      continue;
    }

    inventory.push({
      ...base,
      type: String(item.type ?? ""),
      qty: Number(item.system?.quantity ?? 0),
      weight: Number(item.system?.weight?.value ?? item.system?.weight ?? 0),
      equipped: Boolean(item.system?.equipped),
    });

    if (isAttack(item)) {
      attacks.push({
        ...base,
        toHit: labelOf(item, "toHit") || labelOf(item, "modifier"),
        damage: labelOf(item, "damage"),
      });
    }
  }

  return { attacks, inventory, spellList, features };
}

function buildConditions(actor) {
  return actor.effects
    .filter((effect) => !effect.disabled)
    .map((effect) => ({
      key: String(effect.statuses?.first?.() ?? effect.id),
      label: String(effect.name ?? ""),
      img: absoluteImage(effect.img ?? effect.icon),
    }));
}

export function buildSheet(actor) {
  const system = actor.system ?? {};
  const attributes = system.attributes ?? {};
  const details = system.details ?? {};
  const { attacks, inventory, spellList, features } = buildItems(actor);

  const speedValue = attributes.movement?.walk ?? 0;
  const speedUnits = attributes.movement?.units ?? "";

  return {
    id: actor.id,
    name: String(actor.name ?? ""),
    img: absoluteImage(actor.img),
    system: "dnd5e",

    header: {
      level: Number(details.level ?? 0),
      classes: describeClasses(actor),
      race: documentName(details.race),
      background: documentName(details.background),
      ac: Number(attributes.ac?.value ?? 0),
      initiative: Number(attributes.init?.total ?? attributes.init?.mod ?? 0),
      speed: speedValue ? `${speedValue} ${speedUnits}`.trim() : "",
      prof: Number(attributes.prof ?? 0),
      inspiration: Boolean(attributes.inspiration),
      // Read-only. The system calculates it from the exhaustion condition.
      exhaustion: Number(attributes.exhaustion ?? 0),
    },

    hp: {
      value: Number(attributes.hp?.value ?? 0),
      max: Number(attributes.hp?.max ?? 0),
      temp: Number(attributes.hp?.temp ?? 0),
      tempmax: Number(attributes.hp?.tempmax ?? 0),
    },
    deathSaves: {
      success: Number(attributes.death?.success ?? 0),
      failure: Number(attributes.death?.failure ?? 0),
    },

    abilities: buildAbilities(actor),
    skills: buildSkills(actor),
    tools: buildTools(actor),
    resources: buildResources(actor),
    currency: { ...(system.currency ?? {}) },

    attacks,
    inventory,
    spells: { slots: buildSpellSlots(actor), list: spellList },
    features,
    conditions: buildConditions(actor),

    notes: {
      biography: String(details.biography?.value ?? ""),
      trait: String(details.trait ?? ""),
      ideal: String(details.ideal ?? ""),
      bond: String(details.bond ?? ""),
      flaw: String(details.flaw ?? ""),
    },
  };
}

function describeClasses(actor) {
  const classes = actor.items.filter((item) => item.type === "class");
  if (classes.length === 0) return "";
  return classes
    .map((item) => `${item.name} ${item.system?.levels ?? ""}`.trim())
    .join(" / ");
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export async function applyPatch(actor, payload) {
  const { target = "actor", itemId, changes } = payload ?? {};
  checkPatch(target, changes);

  if (target === "actor") {
    await actor.update(changes);
    return;
  }

  const item = actor.items.get(itemId);
  if (!item) throw new Error(`There is no item with the id ${itemId}`);
  await item.update(changes);
}

/* ------------------------------------------------------------------ */
/* Rolls                                                               */
/* ------------------------------------------------------------------ */

// A roll from a phone must not open a window on the Game Master screen, so
// every roll asks for no dialog.
function rollConfig(payload) {
  const config = {};
  if (payload?.advantage === "advantage") config.advantage = true;
  if (payload?.advantage === "disadvantage") config.disadvantage = true;
  return config;
}

const NO_DIALOG = { configure: false };

export async function roll(actor, payload) {
  const { kind, key, itemId } = payload ?? {};
  const config = rollConfig(payload);

  switch (kind) {
    case "skill":
      return actor.rollSkill({ ...config, skill: key }, NO_DIALOG, {});
    case "tool":
      return actor.rollToolCheck({ ...config, tool: key }, NO_DIALOG, {});
    case "ability":
      return actor.rollAbilityCheck({ ...config, ability: key }, NO_DIALOG, {});
    case "save":
      return actor.rollSavingThrow({ ...config, ability: key }, NO_DIALOG, {});
    case "death":
      return actor.rollDeathSave(config, NO_DIALOG, {});
    case "initiative":
      return actor.rollInitiative({ createCombatants: true });
    case "hitDie":
      return actor.rollHitDie({ ...config, denomination: key }, NO_DIALOG, {});
    case "attack":
      return rollActivity(actor, itemId, "attack", config);
    case "damage":
      return rollActivity(actor, itemId, "damage", config);
    default:
      throw new Error(`Unknown roll kind "${kind}"`);
  }
}

// In dnd5e 5.x an attack and its damage belong to an activity of the item.
//
// Only an attack activity has rollAttack. Several kinds of activity have
// rollDamage: an attack, a save, and a heal all make damage or healing. So
// an attack looks for the attack activity, and damage takes the first
// activity that can roll it.
//
// If the item has no such activity, the item card is the correct answer,
// because the card carries the buttons for the attack and the damage.
async function rollActivity(actor, itemId, what, config) {
  const item = actor.items.get(itemId);
  if (!item) throw new Error(`There is no item with the id ${itemId}`);

  const activities = item.system?.activities;

  if (what === "attack") {
    const attack = activities?.getByType?.("attack")?.[0];
    if (typeof attack?.rollAttack === "function") {
      return attack.rollAttack(config, NO_DIALOG, {});
    }
  } else {
    const source = activities?.find?.((a) => typeof a.rollDamage === "function");
    if (source) return source.rollDamage(config, NO_DIALOG, {});
  }

  return item.use({}, NO_DIALOG, {});
}

export async function use(actor, payload) {
  const item = actor.items.get(payload?.itemId);
  if (!item) throw new Error(`There is no item with the id ${payload?.itemId}`);

  const config = {};
  if (Number.isFinite(payload?.level)) {
    config.spell = { slot: `spell${payload.level}` };
  }
  return item.use(config, NO_DIALOG, {});
}

export async function chat(actor, payload) {
  const text = String(payload?.text ?? "").trim();
  if (!text) throw new Error("The message is empty");

  return ChatMessage.create({
    content: foundry.utils.escapeHTML?.(text) ?? text,
    speaker: ChatMessage.getSpeaker({ actor }),
    style: payload?.emote
      ? CONST.CHAT_MESSAGE_STYLES.EMOTE
      : CONST.CHAT_MESSAGE_STYLES.IC,
  });
}
