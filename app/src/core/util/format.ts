// Small pure helpers. These are the parts of web/js/util.js that survive
// the move to Vue: the escape and the commit helper do not, because Vue
// escapes text on its own and useServerBackedField replaces the commit.

/** Keep a number inside a range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** A modifier with its sign, for example "+3" or "-1". */
export function signed(value: number): string {
  return value < 0 ? String(value) : `+${value}`
}

/** Read a number from an input, with a fallback for text that is not a number. */
export function toNumber(raw: string, fallback = 0): number {
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** "Cantrips" for level 0, otherwise "Level 3". */
export function spellLevelLabel(level: number): string {
  return level === 0 ? 'Cantrips' : `Level ${level}`
}

/** The name of a spell slot row. A pact slot says so, because a level is not a name. */
export function slotLabel(slot: { level: number; pact?: boolean }): string {
  return slot.pact ? `Pact (level ${slot.level})` : spellLevelLabel(slot.level)
}

/** The initials the page shows when an actor or an item has no image. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}
