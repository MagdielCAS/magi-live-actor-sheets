<script setup lang="ts">
// Hit points, the derived numbers, abilities and skills.
//
// This tab is written out rather than left as a stub, because it is the
// one that proves the write guard: the hit point fields are the exact
// fields that produced more than 600 writes in the old page.

import { computed } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { useCombatStore } from '@/stores/combat'
import { ACTOR_PATH } from '@/core/protocol/paths'
import { signed } from '@/core/util/format'

const character = useCharacterStore()
const combat = useCombatStore()

const hp = computed(() => character.hp)
const header = computed(() => character.header)

function writeHp(path: string, key: 'value' | 'max' | 'temp', value: number): void {
  void character.patchActor({ [path]: value }, [{ path: ['hp', key], value }])
}

const PROFICIENCY_DOT: Record<number, string> = {
  0: 'bg-transparent border border-border',
  0.5: 'bg-muted-foreground/50',
  1: 'bg-primary',
  2: 'bg-success',
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Hit points -->
    <section class="rounded-xl border border-border bg-card p-4">
      <h2 class="mb-3 text-sm font-medium text-muted-foreground">Hit points</h2>
      <div class="grid grid-cols-3 gap-3">
        <NumberField
          label="Current"
          :read="() => hp?.value ?? 0"
          :max="9999"
          :write="(v) => writeHp(ACTOR_PATH.hpValue, 'value', v)"
        />
        <NumberField
          label="Max"
          :read="() => hp?.max ?? 0"
          :max="9999"
          :write="(v) => writeHp(ACTOR_PATH.hpMax, 'max', v)"
        />
        <NumberField
          label="Temp"
          :read="() => hp?.temp ?? 0"
          :max="9999"
          :write="(v) => writeHp(ACTOR_PATH.hpTemp, 'temp', v)"
        />
      </div>
    </section>

    <!-- The numbers the system derives. All read-only. -->
    <section class="grid grid-cols-4 gap-2">
      <div class="rounded-lg border border-border bg-card px-2 py-3 text-center">
        <p class="text-xs text-muted-foreground">AC</p>
        <p class="text-lg font-semibold tabular-nums">{{ header?.ac ?? '—' }}</p>
      </div>
      <button
        type="button"
        class="rounded-lg border border-border bg-card px-2 py-3 text-center"
        @click="combat.rollInitiative()"
      >
        <p class="text-xs text-muted-foreground">Init</p>
        <p class="text-lg font-semibold tabular-nums text-primary">
          {{ header ? signed(header.initiative) : '—' }}
        </p>
      </button>
      <div class="rounded-lg border border-border bg-card px-2 py-3 text-center">
        <p class="text-xs text-muted-foreground">Speed</p>
        <p class="text-lg font-semibold">{{ header?.speed ?? '—' }}</p>
      </div>
      <div class="rounded-lg border border-border bg-card px-2 py-3 text-center">
        <p class="text-xs text-muted-foreground">Prof</p>
        <p class="text-lg font-semibold tabular-nums">
          {{ header ? signed(header.prof) : '—' }}
        </p>
      </div>
    </section>

    <!-- Exhaustion is read-only on purpose: prepareExhaustionLevel()
         writes it from the exhaustion condition, so a write here would
         quietly do nothing. -->
    <section
      v-if="(header?.exhaustion ?? 0) > 0"
      class="rounded-xl border border-warning/40 bg-warning/10 p-4"
    >
      <p class="text-sm">
        Exhaustion {{ header?.exhaustion }}
        <span class="text-muted-foreground">· change this in Foundry</span>
      </p>
    </section>

    <!-- Abilities -->
    <section class="rounded-xl border border-border bg-card p-4">
      <h2 class="mb-3 text-sm font-medium text-muted-foreground">Abilities</h2>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div
          v-for="ability in character.abilities"
          :key="ability.key"
          class="rounded-lg bg-secondary p-3 text-center"
        >
          <p class="text-xs text-muted-foreground">{{ ability.label }}</p>
          <p class="text-xl font-semibold tabular-nums">{{ ability.value }}</p>
          <div class="mt-2 flex gap-1">
            <button
              type="button"
              class="flex-1 rounded bg-card py-1 text-xs"
              @click="combat.roll('ability', { key: ability.key })"
            >
              {{ signed(ability.mod) }}
            </button>
            <button
              type="button"
              class="flex-1 rounded bg-card py-1 text-xs"
              @click="combat.roll('save', { key: ability.key })"
            >
              Save {{ signed(ability.save) }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Skills -->
    <section class="rounded-xl border border-border bg-card p-4">
      <h2 class="mb-3 text-sm font-medium text-muted-foreground">Skills</h2>
      <ul class="flex flex-col">
        <li v-for="skill in character.skills" :key="skill.key">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm"
            @click="combat.roll('skill', { key: skill.key })"
          >
            <span
              class="size-2 shrink-0 rounded-full"
              :class="PROFICIENCY_DOT[skill.proficiency]"
              :aria-label="`Proficiency ${skill.proficiency}`"
            />
            <span class="flex-1 truncate">{{ skill.label }}</span>
            <span class="text-xs text-muted-foreground">{{ skill.ability }}</span>
            <span class="w-8 text-right tabular-nums">{{ signed(skill.mod) }}</span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
