<script setup lang="ts">
// The parent of the six tabs. It holds nothing of its own: the tabs read
// the store, and the store is filled by the socket. It exists so that the
// tabs share one route segment and one place to report a sheet that has
// not arrived.

import { useCharacterStore } from '@/stores/character'

defineProps<{ actorId: string }>()

const character = useCharacterStore()
</script>

<template>
  <div v-if="character.loaded">
    <RouterView v-slot="{ Component }">
      <!-- Keep the last few tabs, so a return to one of them is instant
           and its scroll position survives. Three is a deliberate limit:
           six live tabs is a lot for the memory of a phone. -->
      <KeepAlive :max="3">
        <component :is="Component" />
      </KeepAlive>
    </RouterView>
  </div>
  <p v-else class="py-8 text-center text-sm text-muted-foreground">
    Waiting for the sheet…
  </p>
</template>
