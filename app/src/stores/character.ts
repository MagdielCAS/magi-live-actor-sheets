// The character sheet.
//
// The module sends a whole snapshot for each change (protocol.md section
// 10), so the sheet is replaced, never changed field by field. Three
// decisions come from that:
//
//   1. shallowRef, not ref. A deep reactive object would build a new proxy
//      tree for every snapshot and give nothing back, because every reader
//      depends on the ref itself.
//   2. reconcile() keeps the reference of each part that did not change.
//      A computed that reads one part then gives the same object, and Vue
//      3.4 and later do not tell its dependents. The spell tab stays quiet
//      while the hit points change.
//   3. The sheet is read-only. A part is shared with the snapshot before
//      it, so a change in place would corrupt the sharing. An optimistic
//      edit goes through patchPath(), which copies only the path it
//      changes.
//
// Read through the slices below, never through `sheet` itself.

import { defineStore } from 'pinia'
import { computed, shallowRef, ref } from 'vue'
import type { ReadonlySheet, SheetDTO } from '@/core/protocol/sheet'
import type { Changes, ErrorPayload, PatchPayload } from '@/core/protocol/messages'
import { reconcile } from '@/core/util/structural-share'
import { patchPath, indexOfItem } from '@/core/util/patch-path'
import { useConnectionStore } from './connection'
import { useToastStore } from './toast'

/** One optimistic change: where in the sheet, and the new value. */
export interface LocalEdit {
  path: readonly (string | number)[]
  value: unknown
}

export const useCharacterStore = defineStore('character', () => {
  const sheet = shallowRef<ReadonlySheet | null>(null)
  const rev = ref(0)

  // --- Slices. Stable while the part behind them does not change. ---
  const loaded = computed(() => sheet.value !== null)
  const actorId = computed(() => sheet.value?.id ?? null)
  const name = computed(() => sheet.value?.name ?? '')
  const img = computed(() => sheet.value?.img ?? '')
  const header = computed(() => sheet.value?.header ?? null)
  const hp = computed(() => sheet.value?.hp ?? null)
  const deathSaves = computed(() => sheet.value?.deathSaves ?? null)
  const abilities = computed(() => sheet.value?.abilities ?? [])
  const skills = computed(() => sheet.value?.skills ?? [])
  const tools = computed(() => sheet.value?.tools ?? [])
  const resources = computed(() => sheet.value?.resources ?? [])
  const currency = computed(() => sheet.value?.currency ?? null)
  const attacks = computed(() => sheet.value?.attacks ?? [])
  const inventory = computed(() => sheet.value?.inventory ?? [])
  const spellSlots = computed(() => sheet.value?.spells.slots ?? [])
  const spellList = computed(() => sheet.value?.spells.list ?? [])
  const features = computed(() => sheet.value?.features ?? [])
  const conditions = computed(() => sheet.value?.conditions ?? [])
  const notes = computed(() => sheet.value?.notes ?? null)

  /**
   * Take one snapshot. The server drops a snapshot that is not newer, and
   * the page does the same, because a reconnect can deliver one late.
   */
  function applySnapshot(dto: SheetDTO): void {
    if (sheet.value !== null && dto.rev <= rev.value) return
    sheet.value = reconcile(sheet.value, dto as unknown as ReadonlySheet)
    rev.value = dto.rev
  }

  function clear(): void {
    sheet.value = null
    rev.value = 0
  }

  /** Show a change before the server confirms it. */
  function applyLocal(edits: readonly LocalEdit[]): void {
    let next = sheet.value
    if (next === null) return
    for (const edit of edits) {
      next = patchPath(next, edit.path, edit.value)
    }
    sheet.value = next
  }

  async function sendPatch(payload: PatchPayload): Promise<void> {
    const connection = useConnectionStore()
    try {
      await connection.send('actor.patch', payload)
    } catch (cause) {
      const failure = cause as ErrorPayload
      // The next snapshot puts the true value back on the screen. Say so,
      // because a change that quietly does nothing is worse than an error.
      useToastStore().error(failure.message)
    }
  }

  /** Write one or more actor paths, and show the change at once. */
  async function patchActor(changes: Changes, optimistic: readonly LocalEdit[] = []): Promise<void> {
    applyLocal(optimistic)
    await sendPatch({ target: 'actor', changes })
  }

  /** Write one or more item paths, and show the change at once. */
  async function patchItem(
    itemId: string,
    changes: Changes,
    optimistic: readonly LocalEdit[] = [],
  ): Promise<void> {
    applyLocal(optimistic)
    await sendPatch({ target: 'item', itemId, changes })
  }

  /** Where an item sits in a list, so an optimistic edit can name its path. */
  function inventoryIndex(itemId: string): number {
    return indexOfItem(inventory.value, itemId)
  }

  function spellIndex(itemId: string): number {
    return indexOfItem(spellList.value, itemId)
  }

  return {
    sheet,
    rev,
    loaded,
    actorId,
    name,
    img,
    header,
    hp,
    deathSaves,
    abilities,
    skills,
    tools,
    resources,
    currency,
    attacks,
    inventory,
    spellSlots,
    spellList,
    features,
    conditions,
    notes,
    applySnapshot,
    applyLocal,
    clear,
    patchActor,
    patchItem,
    inventoryIndex,
    spellIndex,
  }
})
