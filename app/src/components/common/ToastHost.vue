<script setup lang="ts">
// The short messages at the bottom of the screen. It sits above the tab
// bar, so a message never hides a destination.

import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <div
    aria-live="polite"
    class="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4
           bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom,0px)+1rem)]
           md:bottom-6"
  >
    <p
      v-for="item in toast.items"
      :key="item.id"
      class="max-w-sm rounded-lg px-4 py-2 text-sm shadow-lg"
      :class="item.kind === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-popover text-foreground'"
    >
      {{ item.text }}
    </p>
  </div>
</template>
