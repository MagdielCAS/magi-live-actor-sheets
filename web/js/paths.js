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
  exhaustion: 'system.attributes.exhaustion',
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

export function currencyPath(key) {
  return `system.currency.${key}`;
}

// key is "primary", "secondary", or "tertiary".
export function resourcePath(key) {
  return `system.resources.${key}.value`;
}

export const ITEM_PATH = {
  quantity: 'system.quantity',
  equipped: 'system.equipped',
  prepared: 'system.preparation.prepared',
  usesValue: 'system.uses.value',
};
