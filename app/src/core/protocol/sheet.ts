// The shape of one actor, as the module sends it. This is the TypeScript
// form of protocol.md section 6. docs/protocol.md stays the contract; this
// file is the single description of that contract inside the page.
//
// Change this file and docs/protocol.md in the same commit.

// A "uses" value is null, or a pair of numbers.
export type Uses = { value: number; max: number } | null

export interface SheetHeader {
  level: number
  classes: string
  race: string
  background: string
  /** Read-only. The dnd5e system derives armour class from items and effects. */
  ac: number
  initiative: number
  /** A display string, for example "30 ft". Not a number. */
  speed: string
  prof: number
  inspiration: boolean
  /**
   * Read-only. prepareExhaustionLevel() writes this from the exhaustion
   * condition, so a write to it does nothing.
   */
  exhaustion: number
}

export interface SheetHp {
  value: number
  max: number
  temp: number
  tempmax: number
}

export interface SheetDeathSaves {
  /** 0 to 3. */
  success: number
  /** 0 to 3. */
  failure: number
}

export interface SheetAbility {
  /** "str", "dex", "con", "int", "wis", "cha". */
  key: string
  label: string
  /** The score, for example 12. */
  value: number
  /** Read-only. The system derives the modifier from the score. */
  mod: number
  save: number
  proficient: boolean
}

/** 0 = none, 0.5 = half, 1 = proficient, 2 = expertise. */
export type SkillProficiency = 0 | 0.5 | 1 | 2

export interface SheetSkill {
  /** For example "ath". */
  key: string
  label: string
  /** The ability key the skill uses, for example "str". */
  ability: string
  mod: number
  proficiency: SkillProficiency
  passive: number
}

export interface SheetTool {
  /** For example "thief". */
  key: string
  label: string
  mod: number
}

export type ResourceKey = 'primary' | 'secondary' | 'tertiary'

export interface SheetResource {
  key: ResourceKey
  label: string
  value: number
  max: number
}

export type CurrencyKey = 'pp' | 'gp' | 'ep' | 'sp' | 'cp'

export type SheetCurrency = Record<CurrencyKey, number>

export interface SheetAttack {
  itemId: string
  name: string
  /** An absolute address. The adapter makes it absolute. */
  img: string
  /** A prepared string, for example "+7". */
  toHit: string
  /** A prepared string, for example "1d8+4 piercing". */
  damage: string
  uses: Uses
}

export interface SheetItem {
  itemId: string
  name: string
  img: string
  /** "loot", "consumable", "equipment", and others. */
  type: string
  qty: number
  /** Can be fractional. */
  weight: number
  equipped: boolean
  uses: Uses
}

export interface SheetSpellSlot {
  /** 1 to 9. Level 0 (cantrips) has no slot to spend. */
  level: number
  value: number
  max: number
  /**
   * True for a pact slot. Pact magic has its own track: a warlock can hold
   * a pact slot at the same level as a normal slot, so a level is not a
   * name. Always identify a slot with slotKey(), never with the level.
   */
  pact?: boolean
}

export interface SheetSpell {
  itemId: string
  name: string
  /** 0 is a cantrip. */
  level: number
  /** For example "div". */
  school: string
  prepared: boolean
  uses: Uses
}

export interface SheetSpells {
  slots: SheetSpellSlot[]
  list: SheetSpell[]
}

export interface SheetFeature {
  itemId: string
  name: string
  uses: Uses
}

export interface SheetCondition {
  /** For example "prone". */
  key: string
  label: string
  img: string
}

export interface SheetNotes {
  /** Raw Foundry HTML. Send it through sanitizeHtml() before it becomes DOM. */
  biography: string
  trait: string
  ideal: string
  bond: string
  flaw: string
}

export interface SheetDTO {
  id: string
  name: string
  /** An absolute address to the portrait. */
  img: string
  /** "dnd5e". The shape itself does not depend on the system. */
  system: string
  /**
   * A counter. The module increases it for each snapshot of that actor.
   * The server drops a snapshot with a rev that is not larger than the
   * last one, and the page does the same.
   */
  rev: number

  header: SheetHeader
  hp: SheetHp
  deathSaves: SheetDeathSaves
  abilities: SheetAbility[]
  skills: SheetSkill[]
  tools: SheetTool[]
  resources: SheetResource[]
  currency: SheetCurrency
  attacks: SheetAttack[]
  inventory: SheetItem[]
  spells: SheetSpells
  features: SheetFeature[]
  conditions: SheetCondition[]
  notes: SheetNotes
}

/**
 * A read-only view of a value and everything below it.
 *
 * The store keeps the sheet in a shallowRef and shares the sub-objects that
 * did not change between two snapshots. A shared sub-object is reachable
 * from the snapshot before it, so a change in place would corrupt the
 * sharing and make a stale view. This type stops that at compile time.
 * Use patchPath() to make a changed copy.
 */
export type DeepReadonly<T> = T extends (infer R)[]
  ? readonly DeepReadonly<R>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T

export type ReadonlySheet = DeepReadonly<SheetDTO>

/**
 * The name of one spell slot. A pact slot and a normal slot can share a
 * level, so a level is not a name. This is the correct key for a v-for and
 * the correct way to find a slot in the list.
 */
export function slotKey(slot: Pick<SheetSpellSlot, 'level' | 'pact'>): string {
  return slot.pact ? 'pact' : `spell${slot.level}`
}
