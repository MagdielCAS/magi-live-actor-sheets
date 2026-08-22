// The write allowlist and the pact track.
//
// This file exists because both were real faults. A path that leaves the
// allowlist makes the server refuse the whole message, and a slot found by
// its level spends the wrong track for a warlock.

import { describe, expect, it } from 'vitest'
import {
  ACTOR_PATH,
  ACTOR_WRITE_ALLOWLIST,
  ITEM_PATH,
  ITEM_WRITE_ALLOWLIST,
  pactSlotPath,
  slotPath,
  spellSlotPath,
} from './paths'
import { slotKey } from './sheet'

describe('the write allowlist', () => {
  // These are the paths in docs/protocol.md section 8, written out again.
  // A change on one side must fail here until the other side agrees.
  const ACTOR_PATHS_FROM_PROTOCOL = [
    'system.attributes.hp.value',
    'system.attributes.hp.max',
    'system.attributes.hp.temp',
    'system.attributes.hp.tempmax',
    'system.attributes.death.success',
    'system.attributes.death.failure',
    'system.attributes.inspiration',
    'system.spells.spell1.value',
    'system.spells.spell2.value',
    'system.spells.spell3.value',
    'system.spells.spell4.value',
    'system.spells.spell5.value',
    'system.spells.spell6.value',
    'system.spells.spell7.value',
    'system.spells.spell8.value',
    'system.spells.spell9.value',
    'system.spells.pact.value',
    'system.currency.pp',
    'system.currency.gp',
    'system.currency.ep',
    'system.currency.sp',
    'system.currency.cp',
    'system.resources.primary.value',
    'system.resources.secondary.value',
    'system.resources.tertiary.value',
    'system.details.biography.value',
    'system.details.trait',
    'system.details.ideal',
    'system.details.bond',
    'system.details.flaw',
  ]

  it('holds exactly the actor paths of the protocol', () => {
    expect([...ACTOR_WRITE_ALLOWLIST].sort()).toEqual([...ACTOR_PATHS_FROM_PROTOCOL].sort())
  })

  it('holds exactly the item paths of the protocol', () => {
    expect([...ITEM_WRITE_ALLOWLIST].sort()).toEqual(
      [
        'system.quantity',
        'system.equipped',
        'system.preparation.prepared',
        'system.uses.spent',
      ].sort(),
    )
  })

  it('never offers a field that the system derives', () => {
    // A write to one of these is accepted and then thrown away, which is
    // worse than a refusal because nothing reports it.
    const derived = [
      'system.attributes.exhaustion',
      'system.uses.value',
      'system.attributes.ac.value',
      'system.skills.ath.total',
      'system.abilities.str.mod',
    ]
    const all = [...ACTOR_WRITE_ALLOWLIST, ...ITEM_WRITE_ALLOWLIST]
    for (const path of derived) expect(all).not.toContain(path)
  })

  it('writes uses through spent, because the system computes value', () => {
    expect(ITEM_PATH.usesSpent).toBe('system.uses.spent')
    expect(ITEM_WRITE_ALLOWLIST).not.toContain('system.uses.value')
  })

  it('keeps exhaustion out, because prepareExhaustionLevel overwrites it', () => {
    expect(Object.values(ACTOR_PATH)).not.toContain('system.attributes.exhaustion')
  })
})

describe('pact magic', () => {
  it('sends a pact slot to its own track, at any level', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      expect(slotPath({ level, pact: true })).toBe(pactSlotPath())
      expect(slotPath({ level })).toBe(spellSlotPath(level))
    }
  })

  it('gives a pact slot and a normal slot of the same level different names', () => {
    expect(slotKey({ level: 3, pact: true })).not.toBe(slotKey({ level: 3 }))
  })

  it('never confuses two slots that share a level', () => {
    const slots = [
      { level: 3, value: 2, max: 3 },
      { level: 3, value: 1, max: 2, pact: true },
    ]
    const keys = slots.map(slotKey)
    expect(new Set(keys).size).toBe(2)
    expect(new Set(slots.map(slotPath)).size).toBe(2)
  })
})
