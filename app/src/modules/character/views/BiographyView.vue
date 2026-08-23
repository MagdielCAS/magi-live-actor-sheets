<script setup lang="ts">
// The biography and the four personality fields.
//
// The biography is Foundry HTML and is the only string in the page that
// becomes DOM without escaping. It goes through sanitizeHtml() first, which
// keeps an allowlist of tags and removes every style attribute. Never put
// notes.biography into v-html without that call.

import { computed } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { sanitizeHtml } from '@/core/util/sanitize-html'
import { ACTOR_PATH } from '@/core/protocol/paths'
import { useServerBackedField } from '@/composables/useServerBackedField'

const character = useCharacterStore()

const biography = computed(() => sanitizeHtml(character.notes?.biography ?? ''))

const FIELDS = [
  { key: 'trait', label: 'Personality trait', path: ACTOR_PATH.trait },
  { key: 'ideal', label: 'Ideal', path: ACTOR_PATH.ideal },
  { key: 'bond', label: 'Bond', path: ACTOR_PATH.bond },
  { key: 'flaw', label: 'Flaw', path: ACTOR_PATH.flaw },
] as const

type NoteKey = (typeof FIELDS)[number]['key']

// A long text field writes while a person types, after a moment of quiet,
// instead of only on blur. The guard inside the composable is the same.
const fields = FIELDS.map((field) => ({
  ...field,
  state: useServerBackedField<string>({
    read: () => character.notes?.[field.key as NoteKey] ?? '',
    write: (value) => {
      void character.patchActor({ [field.path]: value }, [
        { path: ['notes', field.key], value },
      ])
    },
    debounceMs: 600,
  }),
}))
</script>

<template>
  <div class="flex flex-col gap-3">
    <SheetCard title="Biography">
      <!-- eslint-disable-next-line vue/no-v-html -- sanitizeHtml above. -->
      <div class="max-w-none text-base leading-normal" v-html="biography" />
    </SheetCard>

    <SheetCard v-for="field in fields" :key="field.key" :title="field.label">
      <textarea
        v-model="field.state.model.value"
        rows="3"
        :aria-label="field.label"
        class="min-h-19 w-full resize-y rounded-sm border border-input bg-sunken px-2.5 py-2
               text-sm"
        @focus="field.state.onFocus"
        @blur="field.state.onBlur"
      />
    </SheetCard>
  </div>
</template>
