<script setup lang="ts">
// Combat mode: one screen for an active turn.
//
// Scope, said plainly: docs/protocol.md carries no encounter data, so
// there is no turn order and no combatant list here. What this screen can
// do is everything the protocol already allows, gathered in one place and
// inside the reach of a thumb:
//
//   the status bar   hit points, slots, conditions
//   quick actions    initiative, attack, damage, death save, hit die
//
// InitiativeStrip is the place a real turn order goes, once a combat.state
// message exists. useCombatStore().encounter is its slot.

import { useCharacterStore } from '@/stores/character'
import { useCombatStore } from '@/stores/combat'
import { slotKey } from '@/core/protocol/sheet'
import { slotLabel } from '@/core/util/format'
import type { Advantage } from '@/core/protocol/messages'

const character = useCharacterStore()
const combat = useCombatStore()

const ADVANTAGE: readonly { value: Advantage; label: string }[] = [
  { value: 'disadvantage', label: 'Dis' },
  { value: 'normal', label: 'Normal' },
  { value: 'advantage', label: 'Adv' },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Status bar -->
    <section class="rounded-xl border border-border bg-card p-4">
      <div class="flex items-baseline justify-between">
        <h2 class="text-sm font-medium text-muted-foreground">Hit points</h2>
        <p class="tabular-nums">
          <span class="text-2xl font-semibold">{{ combat.hp?.value ?? '—' }}</span>
          <span class="text-muted-foreground"> / {{ combat.hp?.max ?? '—' }}</span>
          <span v-if="(combat.hp?.temp ?? 0) > 0" class="text-success">
            +{{ combat.hp?.temp }}
          </span>
        </p>
      </div>

      <div v-if="combat.spellSlots.length" class="mt-3 flex flex-col gap-1">
        <div
          v-for="slot in combat.spellSlots"
          :key="slotKey(slot)"
          class="flex items-center gap-2 text-xs"
        >
          <span class="w-28 shrink-0 text-muted-foreground">{{ slotLabel(slot) }}</span>
          <span class="tabular-nums">{{ slot.value }} / {{ slot.max }}</span>
        </div>
      </div>

      <div v-if="combat.conditions.length" class="mt-3 flex flex-wrap gap-2">
        <span
          v-for="condition in combat.conditions"
          :key="condition.key"
          class="rounded-full bg-warning/15 px-3 py-1 text-xs text-warning"
        >
          {{ condition.label }}
        </span>
      </div>
    </section>

    <!-- The advantage of the next roll. It goes back to normal after one. -->
    <section class="rounded-xl border border-border bg-card p-4">
      <h2 class="mb-3 text-sm font-medium text-muted-foreground">Next roll</h2>
      <div role="group" aria-label="Advantage" class="flex gap-1 rounded-lg bg-secondary p-1">
        <button
          v-for="option in ADVANTAGE"
          :key="option.value"
          type="button"
          class="flex-1 rounded-md py-2 text-sm"
          :class="combat.advantage === option.value ? 'bg-card text-foreground' : 'text-muted-foreground'"
          @click="combat.setAdvantage(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </section>

    <!-- Quick actions -->
    <section class="rounded-xl border border-border bg-card p-4">
      <h2 class="mb-3 text-sm font-medium text-muted-foreground">Actions</h2>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="rounded-lg bg-secondary py-3 text-sm"
          @click="combat.rollInitiative()"
        >
          Initiative
        </button>
        <!-- Both of these are in the protocol and had no UI in the old
             page. -->
        <button
          type="button"
          class="rounded-lg bg-secondary py-3 text-sm"
          :disabled="!combat.isDying"
          :class="combat.isDying ? '' : 'opacity-50'"
          @click="combat.rollDeathSave()"
        >
          Death save
        </button>
        <button
          type="button"
          class="col-span-2 rounded-lg bg-secondary py-3 text-sm"
          @click="combat.rollHitDie('d10')"
        >
          Hit die
        </button>
      </div>
    </section>

    <!-- Attacks -->
    <section class="rounded-xl border border-border bg-card p-4">
      <h2 class="mb-3 text-sm font-medium text-muted-foreground">Attacks</h2>
      <ul class="flex flex-col divide-y divide-border">
        <li
          v-for="attack in character.attacks"
          :key="attack.itemId"
          class="flex items-center gap-2 py-2"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm">{{ attack.name }}</p>
            <p class="truncate text-xs text-muted-foreground">
              {{ attack.toHit }} · {{ attack.damage }}
            </p>
          </div>
          <button
            type="button"
            class="rounded bg-secondary px-3 py-1.5 text-xs"
            @click="combat.rollAttack(attack.itemId)"
          >
            Attack
          </button>
          <button
            type="button"
            class="rounded bg-secondary px-3 py-1.5 text-xs"
            @click="combat.rollDamage(attack.itemId)"
          >
            Damage
          </button>
        </li>
      </ul>
      <p v-if="character.attacks.length === 0" class="text-sm text-muted-foreground">
        No attacks.
      </p>
    </section>
  </div>
</template>
