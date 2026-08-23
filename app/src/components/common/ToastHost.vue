<script setup lang="ts">
// The short messages at the bottom of the screen. It sits above the tab
// bar, so a message never hides a destination.
//
// A toast floats over the sheet, so it is the one thing on the page that
// keeps a shadow. A card has none.

import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <div
    aria-live="polite"
    class="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4
           bottom-[calc(var(--tabbar-height)+var(--safe-bottom)+var(--gutter))]
           md:bottom-6"
  >
    <p
      v-for="item in toast.items"
      :key="item.id"
      class="max-w-sm rounded-full border px-4 py-2.5 text-sm shadow-[var(--shadow-pop)]"
      :class="
        item.kind === 'error'
          ? 'border-destructive bg-secondary text-[var(--blood-300)]'
          : 'border-border bg-secondary text-foreground'
      "
    >
      {{ item.text }}
    </p>
  </div>
</template>
