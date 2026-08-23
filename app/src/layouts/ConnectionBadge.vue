<script setup lang="ts">
// What the page knows about the connection. The states keep the names the
// old page used, so the two are easy to compare during the move.
//
// The accents say what each state is: vital for a live connection, blood
// for offline, gold for a state that is neither.

import { useConnectionStore } from '@/stores/connection'

const TONE: Record<string, string> = {
  live: 'bg-success text-success-foreground border-success',
  fixture: 'bg-card text-muted-foreground border-dashed border-border',
  connecting: 'bg-card text-muted-foreground border-border',
  reconnecting: 'bg-brand text-brand-foreground border-brand',
  offline: 'bg-destructive text-destructive-foreground border-destructive',
  'bridge-offline': 'bg-accent text-accent-foreground border-primary',
}

const connection = useConnectionStore()
</script>

<template>
  <p
    aria-live="polite"
    class="shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-[0.04em]
           transition-colors"
    :class="TONE[connection.badgeState] ?? TONE['offline']"
  >
    {{ connection.badgeText }}
  </p>
</template>
