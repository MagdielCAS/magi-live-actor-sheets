<script setup lang="ts">
// Features and traits.
//
// The protocol has carried sheet.features since the beginning and the old
// page never drew them. This tab is new, and it costs nothing on the
// server side.

import { useCharacterStore } from '@/stores/character'
import { useCombatStore } from '@/stores/combat'

const character = useCharacterStore()
const combat = useCombatStore()
</script>

<template>
  <div class="flex flex-col gap-3">
    <SheetCard v-if="character.conditions.length" title="Conditions">
      <div class="flex flex-wrap gap-2">
        <span
          v-for="condition in character.conditions"
          :key="condition.key"
          class="rounded-xs bg-[var(--fill-brand)] px-2.5 py-1 text-xs font-semibold text-brand"
        >
          {{ condition.label }}
        </span>
      </div>
    </SheetCard>

    <SheetCard title="Features">
      <ul class="flex flex-col divide-y divide-border">
        <li
          v-for="feature in character.features"
          :key="feature.itemId"
          class="flex items-center gap-3 py-2"
        >
          <span class="min-w-0 flex-1 truncate text-sm">{{ feature.name }}</span>
          <button
            v-if="feature.uses"
            type="button"
            class="font-numeric min-h-[var(--touch-min)] shrink-0 rounded-md border
                   border-border bg-secondary px-3 text-sm font-bold text-primary"
            @click="combat.use(feature.itemId)"
          >
            Use ({{ feature.uses.value }}/{{ feature.uses.max }})
          </button>
        </li>
      </ul>
      <p v-if="character.features.length === 0" class="text-sm text-muted-foreground">
        No features.
      </p>
    </SheetCard>
  </div>
</template>
