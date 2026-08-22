// Foundry document paths for actor.patch, from protocol.md section 8.
// The page writes only these paths. The server and the module refuse any
// other path, so there is no reason to build UI for one.
//
// This is the third copy of the write allowlist, and the advisory one. The
// two copies that defend the data are server/internal/authz/authz.go and
// module/scripts/authz.mjs. Change all three together.

import type { SheetSpellSlot, CurrencyKey, ResourceKey } from './sheet'

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
} as const

// The dnd5e system calculates system.uses.value as max minus spent, so a
// write must set system.uses.spent.
export const ITEM_PATH = {
  quantity: 'system.quantity',
  equipped: 'system.equipped',
  prepared: 'system.preparation.prepared',
  usesSpent: 'system.uses.spent',
} as const

/** Spell slot levels 1 to 9. Level 0 (cantrips) has no slot to spend. */
export function spellSlotPath(level: number): string {
  return `system.spells.spell${level}.value`
}

/**
 * Pact magic has its own track. A warlock can hold a pact slot at the same
 * level as a normal slot, so the two need separate paths.
 */
export function pactSlotPath(): string {
  return 'system.spells.pact.value'
}

/** slotPath chooses the right path for one slot of the snapshot. */
export function slotPath(slot: Pick<SheetSpellSlot, 'level' | 'pact'>): string {
  return slot.pact ? pactSlotPath() : spellSlotPath(slot.level)
}

export function currencyPath(key: CurrencyKey): string {
  return `system.currency.${key}`
}

export function resourcePath(key: ResourceKey): string {
  return `system.resources.${key}.value`
}

/** Every actor path the page may write. */
export const ACTOR_WRITE_ALLOWLIST: readonly string[] = [
  ...Object.values(ACTOR_PATH),
  ...Array.from({ length: 9 }, (_, i) => spellSlotPath(i + 1)),
  pactSlotPath(),
  ...(['pp', 'gp', 'ep', 'sp', 'cp'] as const).map(currencyPath),
  ...(['primary', 'secondary', 'tertiary'] as const).map(resourcePath),
]

/** Every item path the page may write. */
export const ITEM_WRITE_ALLOWLIST: readonly string[] = Object.values(ITEM_PATH)
