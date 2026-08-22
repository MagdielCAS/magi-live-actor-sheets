<script setup lang="ts">
// The bar at the top of the sheet.
//
// On a phone it carries the identity of the character, because the rail
// that carries it on a desktop is hidden there. Without this a person on a
// phone cannot see whose sheet is open.

import { useCharacterStore } from '@/stores/character'
import { initials } from '@/core/util/format'

const character = useCharacterStore()
</script>

<template>
  <header
    class="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] pb-2"
  >
    <!-- The desktop rail already shows all of this. -->
    <template v-if="character.loaded">
      <img
        v-if="character.img"
        :src="character.img"
        alt=""
        class="size-9 shrink-0 rounded-full object-cover md:hidden"
      >
      <div
        v-else
        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary
               text-xs md:hidden"
      >
        {{ initials(character.name) }}
      </div>
      <div class="min-w-0 flex-1 md:hidden">
        <p class="truncate text-sm font-medium">{{ character.name }}</p>
        <p class="truncate text-xs text-muted-foreground">
          {{ character.header?.classes }}<span v-if="character.header?.race">
            · {{ character.header.race }}</span>
        </p>
      </div>
    </template>

    <ConnectionBadge class="ml-auto" />
  </header>
</template>
