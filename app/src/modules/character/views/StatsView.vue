<script setup lang="ts">
// Hit points, the derived numbers, abilities and skills.
//
// This tab is written out rather than left as a stub, because it is the
// one that proves the write guard: the hit point fields are the exact
// fields that produced more than 600 writes in the old page.
//
// Two accents carry the meaning here. Arcane marks what rolls: the
// initiative chip, an ability check, a skill row. Gold marks what the
// class gives you: expertise on the proficiency dot.

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

// The proficiency ramp of the design system: none, half, full, expertise.
const PROFICIENCY_DOT: Record<number, string> = {
  0: 'bg-transparent border-2 border-faint',
  0.5: 'bg-[var(--prof-half)] border-2 border-[var(--prof-half)]',
  1: 'bg-[var(--prof-full)] border-2 border-[var(--prof-full)]',
  2: 'bg-[var(--prof-expert)] border-2 border-[var(--prof-expert)]',
}

const CHIP = 'flex min-h-[var(--touch-big)] flex-col items-center justify-center gap-0.5 '
  + 'rounded-lg border border-border bg-card px-1.5 py-2'
</script>

<template>
  <div class="flex flex-col gap-3">
    <SheetCard title="Hit points">
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
    </SheetCard>

    <!-- The numbers the system derives. All read-only, except the chip
         that rolls, which wears the arcane accent to say so. -->
    <section class="grid grid-cols-4 gap-2">
      <div :class="CHIP">
        <p class="stat-label">AC</p>
        <p class="font-numeric text-lg font-bold">{{ header?.ac ?? '—' }}</p>
      </div>
      <button type="button" :class="CHIP" @click="combat.rollInitiative()">
        <p class="stat-label">Init</p>
        <p class="font-numeric text-lg font-bold text-primary">
          {{ header ? signed(header.initiative) : '—' }}
        </p>
      </button>
      <div :class="CHIP">
        <p class="stat-label">Speed</p>
        <p class="font-numeric text-lg font-bold">{{ header?.speed ?? '—' }}</p>
      </div>
      <div :class="CHIP">
        <p class="stat-label">Prof</p>
        <p class="font-numeric text-lg font-bold">
          {{ header ? signed(header.prof) : '—' }}
        </p>
      </div>
    </section>

    <!-- Exhaustion is read-only on purpose: prepareExhaustionLevel()
         writes it from the exhaustion condition, so a write here would
         quietly do nothing. -->
    <SheetCard v-if="(header?.exhaustion ?? 0) > 0" title="Exhaustion">
      <p class="flex items-baseline gap-3 text-sm">
        <span class="font-numeric text-lg font-bold">{{ header?.exhaustion }}</span>
        <span class="text-muted-foreground">Change this in Foundry</span>
      </p>
    </SheetCard>

    <SheetCard title="Abilities">
      <div class="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <div
          v-for="ability in character.abilities"
          :key="ability.key"
          class="rounded-lg border border-border bg-secondary p-2.5"
        >
          <div class="flex items-baseline justify-between">
            <p class="text-sm text-muted-foreground">{{ ability.label }}</p>
            <p class="font-numeric text-lg font-bold">{{ ability.value }}</p>
          </div>
          <div class="mt-2 flex gap-1.5">
            <button
              type="button"
              class="min-h-[var(--touch-min)] flex-1 whitespace-nowrap rounded-md border
                     border-border bg-secondary px-1 text-sm font-semibold text-primary"
              @click="combat.roll('ability', { key: ability.key })"
            >
              Check {{ signed(ability.mod) }}
            </button>
            <button
              type="button"
              class="min-h-[var(--touch-min)] flex-1 whitespace-nowrap rounded-md border
                     bg-secondary px-1 text-sm font-semibold text-primary"
              :class="ability.proficient ? 'border-primary' : 'border-border'"
              @click="combat.roll('save', { key: ability.key })"
            >
              Save {{ signed(ability.save) }}
            </button>
          </div>
        </div>
      </div>
    </SheetCard>

    <SheetCard title="Skills">
      <ul class="flex flex-col gap-1.5">
        <li v-for="skill in character.skills" :key="skill.key">
          <button
            type="button"
            class="flex min-h-[var(--touch-min)] w-full items-center gap-2.5 rounded-md
                   border border-border bg-sunken px-2.5 text-left text-sm"
            @click="combat.roll('skill', { key: skill.key })"
          >
            <span
              class="size-3.5 shrink-0 rounded-full"
              :class="PROFICIENCY_DOT[skill.proficiency]"
              :aria-label="`Proficiency ${skill.proficiency}`"
            />
            <span class="flex-1 truncate">{{ skill.label }}</span>
            <span class="stat-label">{{ skill.ability }}</span>
            <span class="font-numeric w-8 text-right font-bold text-primary">
              {{ signed(skill.mod) }}
            </span>
          </button>
        </li>
      </ul>
    </SheetCard>
  </div>
</template>
