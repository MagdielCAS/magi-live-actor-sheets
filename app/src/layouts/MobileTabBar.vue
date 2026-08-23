<script setup lang="ts">
// The bar at the bottom of a phone. It sits inside the reach of a thumb,
// and it pads itself past the iOS home bar.
//
// The active tab is arcane in the glyph and in the word. No underline and
// no pill: the colour is the whole signal.

import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SHEET_TABS } from '@/router/routes'
import { useCharacterStore } from '@/stores/character'

const route = useRoute()
const character = useCharacterStore()

const actorId = computed(() => (route.params['actorId'] as string | undefined) ?? character.actorId)
</script>

<template>
  <nav
    v-if="actorId"
    aria-label="Sheet tabs"
    class="flex border-t border-border bg-popover pb-[var(--safe-bottom)]"
  >
    <RouterLink
      v-for="tab in SHEET_TABS"
      :key="tab.name"
      :to="{ name: tab.name, params: { actorId } }"
      class="flex h-[var(--tabbar-height)] min-h-[var(--touch-min)] flex-1 flex-col
             items-center justify-center gap-0.5 text-xs font-semibold
             text-muted-foreground no-underline transition-colors"
      active-class="text-primary"
    >
      <TabIcon :tab="tab.name" :size="20" />
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>
