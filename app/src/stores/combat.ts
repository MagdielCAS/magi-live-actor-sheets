// Combat mode.
//
// A note about scope, so nobody looks for something that is not here:
// docs/protocol.md carries NO encounter data. There is no combatant list,
// no turn order, and no active turn. So this store holds three kinds of
// thing:
//
//   - a view of the character, through useCharacterStore;
//   - state that belongs to this device only, such as the advantage of the
//     next roll (web/js/render/skills.js kept this in a module variable);
//   - the actions that combat needs, which are all in the protocol already.
//
// Two of those actions, rollDeathSave and rollHitDie, are in the protocol
// and had no UI at all in the old page.
//
// A real initiative order needs a new message (combat.state, bridge to
// server to client). The slot for it is `encounter` below, and it stays
// null until the protocol carries one.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Advantage, ErrorPayload, RollKind } from '@/core/protocol/messages'
import type { SheetSpellSlot } from '@/core/protocol/sheet'
import { slotPath } from '@/core/protocol/paths'
import { slotKey } from '@/core/protocol/sheet'
import { clamp } from '@/core/util/format'
import { useCharacterStore } from './character'
import { useConnectionStore } from './connection'
import { useToastStore } from './toast'

export const useCombatStore = defineStore('combat', () => {
  const character = useCharacterStore()

  /** Applies to the next roll only, then goes back to normal. */
  const advantage = ref<Advantage>('normal')
  const selectedAttackId = ref<string | null>(null)
  /** This device only. The protocol does not carry concentration. */
  const concentratingOn = ref<string | null>(null)

  /** Waiting for a message the protocol does not have yet. */
  const encounter = ref<null>(null)

  const hp = computed(() => character.hp)
  const conditions = computed(() => character.conditions)
  const attacks = computed(() => character.attacks)
  const spellSlots = computed(() => character.spellSlots)

  const isDying = computed(() => (character.hp?.value ?? 1) <= 0)

  function setAdvantage(next: Advantage): void {
    advantage.value = next
  }

  async function roll(kind: RollKind, opts: { key?: string; itemId?: string } = {}): Promise<void> {
    const connection = useConnectionStore()
    const toast = useToastStore()

    const payload: { kind: RollKind; key?: string; itemId?: string; advantage?: Advantage } = { kind }
    if (opts.key !== undefined) payload.key = opts.key
    if (opts.itemId !== undefined) payload.itemId = opts.itemId
    if (advantage.value !== 'normal') payload.advantage = advantage.value

    try {
      await connection.send('actor.roll', payload)
      toast.show('Roll sent.')
    } catch (cause) {
      toast.error((cause as ErrorPayload).message)
    } finally {
      // The advantage applies to one roll only.
      advantage.value = 'normal'
    }
  }

  const rollInitiative = (): Promise<void> => roll('initiative')
  const rollDeathSave = (): Promise<void> => roll('death')
  const rollHitDie = (key: string): Promise<void> => roll('hitDie', { key })
  const rollAttack = (itemId: string): Promise<void> => roll('attack', { itemId })
  const rollDamage = (itemId: string): Promise<void> => roll('damage', { itemId })

  /** Use an item. A spell also names the slot level to spend. */
  async function use(itemId: string, level?: number): Promise<void> {
    const connection = useConnectionStore()
    const toast = useToastStore()
    try {
      await connection.send('actor.use', level === undefined ? { itemId } : { itemId, level })
    } catch (cause) {
      toast.error((cause as ErrorPayload).message)
    }
  }

  /**
   * Spend or give back one spell slot.
   *
   * The path comes from slotPath(slot), never from the level. A warlock
   * can hold a pact slot at the same level as a normal slot, so the two
   * need separate paths.
   */
  async function setSlot(slot: SheetSpellSlot, value: number): Promise<void> {
    const index = character.spellSlots.findIndex((s) => slotKey(s) === slotKey(slot))
    if (index < 0) return
    const next = clamp(value, 0, slot.max)
    await character.patchActor({ [slotPath(slot)]: next }, [
      { path: ['spells', 'slots', index, 'value'], value: next },
    ])
  }

  return {
    advantage,
    selectedAttackId,
    concentratingOn,
    encounter,
    hp,
    conditions,
    attacks,
    spellSlots,
    isDying,
    setAdvantage,
    roll,
    rollInitiative,
    rollDeathSave,
    rollHitDie,
    rollAttack,
    rollDamage,
    use,
    setSlot,
  }
})
