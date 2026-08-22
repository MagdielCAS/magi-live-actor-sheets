<script setup lang="ts">
// A number that lives on the server.
//
// This is the only component that binds an input to sheet data, and every
// numeric field of the sheet goes through it. It never binds v-model
// straight at the store: useServerBackedField holds the draft and decides
// when a write is worth sending. See that file for why.

import { useServerBackedField } from '@/composables/useServerBackedField'
import { clamp, toNumber } from '@/core/util/format'

const props = withDefaults(
  defineProps<{
    label: string
    read: () => number
    write: (value: number) => void
    min?: number
    max?: number
  }>(),
  { min: 0, max: Number.MAX_SAFE_INTEGER },
)

const field = useServerBackedField<number>({
  read: props.read,
  write: props.write,
  parse: (raw) => clamp(Math.trunc(toNumber(raw, props.read())), props.min, props.max),
  format: (value) => String(value),
})
</script>

<template>
  <label class="flex flex-col gap-1">
    <span class="text-xs text-muted-foreground">{{ label }}</span>
    <input
      v-model="field.model.value"
      type="text"
      inputmode="numeric"
      class="w-full rounded-md border border-input bg-card px-3 py-2 text-center tabular-nums
             outline-none focus-visible:ring-2 focus-visible:ring-ring"
      @focus="field.onFocus"
      @blur="field.onBlur"
      @keydown="field.onKeydown"
    >
  </label>
</template>
