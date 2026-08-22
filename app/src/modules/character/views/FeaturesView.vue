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
  <div class="flex flex-col gap-4">
    <section v-if="character.conditions.length" class="rounded-xl border border-border bg-card p-4">
      <h2 class="mb-3 text-sm font-medium text-muted-foreground">Conditions</h2>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="condition in character.conditions"
          :key="condition.key"
          class="rounded-full bg-warning/15 px-3 py-1 text-xs text-warning"
        >
          {{ condition.label }}
        </span>
      </div>
    </section>

    <section class="rounded-xl border border-border bg-card p-4">
      <h2 class="mb-3 text-sm font-medium text-muted-foreground">Features</h2>
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
            class="rounded bg-secondary px-3 py-1.5 text-xs tabular-nums"
            @click="combat.use(feature.itemId)"
          >
            Use ({{ feature.uses.value }}/{{ feature.uses.max }})
          </button>
        </li>
      </ul>
      <p v-if="character.features.length === 0" class="text-sm text-muted-foreground">
        No features.
      </p>
    </section>
  </div>
</template>
