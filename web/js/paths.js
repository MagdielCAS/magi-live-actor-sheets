// Foundry document paths for actor.patch, from protocol.md section 8.
// The web page writes only these paths. The server and the module refuse
// any other path, so there is no reason to build UI for one.

export const ACTOR_PATH = {
  hpValue: 'system.attributes.hp.value',
  hpMax: 'system.attributes.hp.max',
  hpTemp: 'system.attributes.hp.temp',
  hpTempMax: 'system.attributes.hp.tempmax',
  deathSuccess: 'system.attributes.death.success',
  deathFailure: 'system.attributes.death.failure',
  inspiration: 'system.attributes.inspiration',
  biography: 'system.details.biography.value',
  trait: 'system.details.trait',
  ideal: 'system.details.ideal',
  bond: 'system.details.bond',
  flaw: 'system.details.flaw',
};

// Spell slot levels 1-9. Level 0 (cantrips) has no slot to spend.
export function spellSlotPath(level) {
  return `system.spells.spell${level}.value`;
}

// Pact magic has its own track. A warlock can hold a pact slot at the same
// level as a normal slot, so the two need separate paths.
export function pactSlotPath() {
  return 'system.spells.pact.value';
}

// slotPath chooses the right path for one slot of the snapshot.
export function slotPath(slot) {
  return slot.pact ? pactSlotPath() : spellSlotPath(slot.level);
}

export function currencyPath(key) {
  return `system.currency.${key}`;
}

// key is "primary", "secondary", or "tertiary".
export function resourcePath(key) {
  return `system.resources.${key}.value`;
}

// The dnd5e system calculates system.uses.value as max minus spent, so a
// write must set system.uses.spent.
export const ITEM_PATH = {
  quantity: 'system.quantity',
  equipped: 'system.equipped',
  prepared: 'system.preparation.prepared',
  usesSpent: 'system.uses.spent',
};
