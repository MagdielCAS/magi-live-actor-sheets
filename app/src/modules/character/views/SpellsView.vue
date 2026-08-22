<script setup lang="ts">
// Spell slots and the spell list.
//
// A stub for the moment. The one thing it already does correctly is the
// identity of a slot: slotKey(), never the level. A warlock can hold a
// pact slot at the same level as a normal slot, so a level is not a name.

import { useCharacterStore } from '@/stores/character'
import { useCombatStore } from '@/stores/combat'
import { slotKey } from '@/core/protocol/sheet'
import { slotLabel, spellLevelLabel } from '@/core/util/format'
import { computed } from 'vue'

const character = useCharacterStore()
const combat = useCombatStore()

/** Spells grouped by level, cantrips first. */
const byLevel = computed(() => {
  const groups = new Map<number, typeof character.spellList>()
  for (const spell of character.spellList) {
    const list = groups.get(spell.level) ?? []
    groups.set(spell.level, [...list, spell])
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0])
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <section class="rounded-xl border border-border bg-card p-4">
      <h2 class="mb-3 text-sm font-medium text-muted-foreground">Slots</h2>
      <div
        v-for="slot in character.spellSlots"
        :key="slotKey(slot)"
        class="flex items-center gap-3 py-1.5"
      >
        <span class="w-32 shrink-0 text-sm">{{ slotLabel(slot) }}</span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="n in slot.max"
            :key="n"
            type="button"
            :aria-label="`Slot ${n}`"
            class="size-5 rounded-full border border-border"
            :class="n <= slot.value ? 'bg-primary' : 'bg-transparent'"
            @click="combat.setSlot(slot, n <= slot.value ? n - 1 : n)"
          />
        </div>
      </div>
      <p v-if="character.spellSlots.length === 0" class="text-sm text-muted-foreground">
        No spell slots.
      </p>
    </section>

    <!-- TODO: wrap this list in useVirtualRows() before it can hold a
         full wizard spell book. -->
    <section
      v-for="[level, spells] in byLevel"
      :key="level"
      class="rounded-xl border border-border bg-card p-4"
    >
      <h2 class="mb-3 text-sm font-medium text-muted-foreground">
        {{ spellLevelLabel(level) }}
      </h2>
      <ul class="flex flex-col divide-y divide-border">
        <li v-for="spell in spells" :key="spell.itemId" class="flex items-center gap-3 py-2">
          <span class="min-w-0 flex-1 truncate text-sm">{{ spell.name }}</span>
          <button
            type="button"
            class="rounded bg-secondary px-3 py-1.5 text-xs"
            @click="combat.use(spell.itemId, level === 0 ? undefined : level)"
          >
            Cast
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
