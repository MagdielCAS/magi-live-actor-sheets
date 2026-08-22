// The write allowlist of docs/protocol.md section 8.
//
// The server checks this list too. The module checks it again because the
// module writes with Game Master permission. If this check were absent, a
// fault in the server would let a phone change any part of the world.
//
// Two paths that look writable are absent on purpose. The dnd5e system
// calculates system.attributes.exhaustion from the exhaustion Active
// Effect, and it calculates system.uses.value as max minus spent. A write
// to either one has no effect.

const ACTOR_PATHS = new Set([
  "system.attributes.hp.value",
  "system.attributes.hp.max",
  "system.attributes.hp.temp",
  "system.attributes.hp.tempmax",
  "system.attributes.death.success",
  "system.attributes.death.failure",
  "system.attributes.inspiration",
  "system.spells.pact.value",
  "system.currency.pp",
  "system.currency.gp",
  "system.currency.ep",
  "system.currency.sp",
  "system.currency.cp",
  "system.resources.primary.value",
  "system.resources.secondary.value",
  "system.resources.tertiary.value",
  "system.details.biography.value",
  "system.details.trait",
  "system.details.ideal",
  "system.details.bond",
  "system.details.flaw",
  ...Array.from({ length: 9 }, (_, i) => `system.spells.spell${i + 1}.value`),
]);

const ITEM_PATHS = new Set([
  "system.quantity",
  "system.equipped",
  "system.preparation.prepared",
  "system.uses.spent",
]);

// checkPatch throws if one key of changes is not permitted for target. It
// refuses the whole patch, because a patch is one action.
export function checkPatch(target, changes) {
  const allowed = target === "actor" ? ACTOR_PATHS : target === "item" ? ITEM_PATHS : null;
  if (!allowed) throw new Error(`Unknown patch target "${target}"`);

  const keys = Object.keys(changes ?? {});
  if (keys.length === 0) throw new Error("The patch has no changes");

  for (const key of keys) {
    if (!allowed.has(key)) {
      throw new Error(`The path "${key}" is not allowed on target "${target}"`);
    }
  }
  return true;
}
