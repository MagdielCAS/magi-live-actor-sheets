<script setup lang="ts">
// What the page knows about the connection. The states keep the names the
// old page used, so the two are easy to compare during the move.

import { useConnectionStore } from '@/stores/connection'

const connection = useConnectionStore()

const TONE: Record<string, string> = {
  live: 'bg-success/15 text-success',
  fixture: 'bg-warning/15 text-warning',
  connecting: 'bg-muted text-muted-foreground',
  reconnecting: 'bg-warning/15 text-warning',
  offline: 'bg-destructive/15 text-destructive',
  'bridge-offline': 'bg-warning/15 text-warning',
}
</script>

<template>
  <p
    aria-live="polite"
    class="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
    :class="TONE[connection.badgeState] ?? TONE['offline']"
  >
    {{ connection.badgeText }}
  </p>
</template>
