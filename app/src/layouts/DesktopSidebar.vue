<script setup lang="ts">
// The rail on the left of a wide screen. It carries the same destinations
// as the bar on a phone, plus the name of the character.

import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SHEET_TABS } from '@/router/routes'
import { useCharacterStore } from '@/stores/character'
import { initials } from '@/core/util/format'

const route = useRoute()
const character = useCharacterStore()

const actorId = computed(() => (route.params['actorId'] as string | undefined) ?? character.actorId)
</script>

<template>
  <nav aria-label="Sheet tabs" class="gap-0.5 p-3 pt-[calc(var(--safe-top)+0.75rem)]">
    <div class="mb-4 flex items-center gap-3 px-2 py-2">
      <img
        v-if="character.img"
        :src="character.img"
        alt=""
        class="size-10 shrink-0 rounded-full border border-border object-cover"
      >
      <div
        v-else
        class="flex size-10 shrink-0 items-center justify-center rounded-full border
               border-border bg-secondary text-sm font-bold text-muted-foreground"
      >
        {{ initials(character.name) }}
      </div>
      <div class="min-w-0">
        <!-- The name of the character is what the game gives you, so it is
             gold and it is the display face. -->
        <p class="truncate font-display text-lg leading-snug text-brand">
          {{ character.name || 'Magi Live Sheet' }}
        </p>
        <p class="truncate text-xs text-muted-foreground">
          {{ character.header?.classes ?? '' }}
        </p>
      </div>
    </div>

    <template v-if="actorId">
      <RouterLink
        v-for="tab in SHEET_TABS"
        :key="tab.name"
        :to="{ name: tab.name, params: { actorId } }"
        class="flex min-h-[var(--touch-min)] items-center gap-2.5 rounded-md px-3.5 text-sm
               font-semibold text-muted-foreground no-underline transition-colors"
        active-class="text-primary"
      >
        <TabIcon :tab="tab.name" :size="18" />
        {{ tab.label }}
      </RouterLink>
    </template>
  </nav>
</template>
