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
  <nav aria-label="Sheet tabs" class="gap-1 p-3">
    <div class="mb-4 flex items-center gap-3 px-2 py-2">
      <img
        v-if="character.img"
        :src="character.img"
        alt=""
        class="size-10 shrink-0 rounded-full object-cover"
      >
      <div
        v-else
        class="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm"
      >
        {{ initials(character.name) }}
      </div>
      <div class="min-w-0">
        <p class="truncate text-sm font-medium">{{ character.name || 'Magi Live Sheet' }}</p>
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
        class="flex items-center rounded-md px-3 py-2 text-sm text-muted-foreground
               transition-colors hover:bg-secondary hover:text-foreground"
        active-class="bg-secondary text-foreground"
      >
        {{ tab.label }}
      </RouterLink>
    </template>
  </nav>
</template>
