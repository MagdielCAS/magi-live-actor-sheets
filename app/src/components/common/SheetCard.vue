<script setup lang="ts">
// A card of the sheet.
//
// The design system gives every card the same shape: the card surface, a
// hairline, a 14px radius, 14px of padding, and no drop shadow. A title is
// 12px gold caps, and a gold hairline runs from the end of the title to
// the edge of the card. Drawing that in one place keeps it one shape.

defineProps<{ title?: string }>()
</script>

<template>
  <section class="rounded-xl border border-border bg-card p-3.5">
    <h2 v-if="title" class="card-title mb-2.5">
      {{ title }}
      <span class="rule-brand-reverse" aria-hidden="true" />
    </h2>
    <slot />
  </section>
</template>
