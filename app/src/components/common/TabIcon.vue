<script setup lang="ts">
// The glyph of a tab. It is decoration only: every icon on this page
// keeps the word beside it, so a reader that speaks the page skips this.
//
// One named import for each icon, so each one goes into the chunk that
// draws it and no shared icon chunk appears. See vite.config.ts.

import {
  Backpack,
  HeartPulse,
  NotebookPen,
  ScrollText,
  Sparkles,
  Swords,
} from '@lucide/vue'
import type { Component } from 'vue'

const GLYPH: Record<string, Component> = {
  'sheet.stats': HeartPulse,
  'sheet.combat': Swords,
  'sheet.spells': Sparkles,
  'sheet.inventory': Backpack,
  'sheet.features': ScrollText,
  'sheet.bio': NotebookPen,
}

const props = defineProps<{ tab: string; size: number }>()

const glyph = computed(() => GLYPH[props.tab])
</script>

<template>
  <component
    :is="glyph"
    v-if="glyph"
    :size="size"
    :stroke-width="2"
    aria-hidden="true"
    focusable="false"
  />
</template>
