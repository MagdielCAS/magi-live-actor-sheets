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

const ACTION = 'min-h-[var(--touch-min)] rounded-md border border-border bg-secondary '
  + 'px-3 text-sm font-semibold text-primary'
</script>

<template>
  <div class="flex flex-col gap-3">
    <SheetCard title="Hit points">
      <div class="flex items-baseline justify-between">
        <p class="font-numeric">
          <span class="text-4xl font-bold">{{ combat.hp?.value ?? '—' }}</span>
          <span class="text-2xl text-faint"> / </span>
          <span class="text-2xl text-muted-foreground">{{ combat.hp?.max ?? '—' }}</span>
        </p>
        <!-- Temporary hit points are a gift, so they read as vital. -->
        <p v-if="(combat.hp?.temp ?? 0) > 0" class="font-numeric text-lg font-bold text-success">
          +{{ combat.hp?.temp }} temp
        </p>
      </div>

      <div v-if="combat.spellSlots.length" class="mt-3 flex flex-col gap-1">
        <div
          v-for="slot in combat.spellSlots"
          :key="slotKey(slot)"
          class="flex items-center gap-2 text-sm"
        >
          <span class="w-28 shrink-0 text-muted-foreground">{{ slotLabel(slot) }}</span>
          <span class="font-numeric font-bold">{{ slot.value }} / {{ slot.max }}</span>
        </div>
      </div>

      <div v-if="combat.conditions.length" class="mt-3 flex flex-wrap gap-2">
        <span
          v-for="condition in combat.conditions"
          :key="condition.key"
          class="rounded-xs bg-[var(--fill-brand)] px-2.5 py-1 text-xs font-semibold text-brand"
        >
          {{ condition.label }}
        </span>
      </div>
    </SheetCard>

    <!-- The advantage of the next roll. It goes back to normal after one. -->
    <SheetCard title="Next roll">
      <div
        role="group"
        aria-label="Advantage"
        class="flex overflow-hidden rounded-md border border-border"
      >
        <button
          v-for="option in ADVANTAGE"
          :key="option.value"
          type="button"
          class="min-h-[var(--touch-min)] flex-1 border-l border-border px-1 text-sm
                 first:border-l-0"
          :class="
            combat.advantage === option.value
              ? 'bg-primary font-bold text-primary-foreground'
              : 'bg-sunken text-foreground'
          "
          @click="combat.setAdvantage(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </SheetCard>

    <SheetCard title="Actions">
      <div class="grid grid-cols-2 gap-2">
        <button type="button" :class="ACTION" @click="combat.rollInitiative()">
          Initiative
        </button>
        <!-- Both of these are in the protocol and had no UI in the old
             page. -->
        <button
          type="button"
          :class="ACTION"
          :disabled="!combat.isDying"
          @click="combat.rollDeathSave()"
        >
          Death save
        </button>
        <button type="button" class="col-span-2" :class="ACTION" @click="combat.rollHitDie('d10')">
          Hit die
        </button>
      </div>
    </SheetCard>

    <SheetCard title="Attacks">
      <ul class="flex flex-col divide-y divide-border">
        <li
          v-for="attack in character.attacks"
          :key="attack.itemId"
          class="flex items-center gap-2 py-2"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-base font-bold">{{ attack.name }}</p>
            <!-- A to-hit and a damage formula are dice, so they are set in
                 the mono face. -->
            <p class="truncate font-mono text-sm text-muted-foreground">
              {{ attack.toHit }} · {{ attack.damage }}
            </p>
          </div>
          <button
            type="button"
            :class="ACTION"
            @click="combat.rollAttack(attack.itemId)"
          >
            Attack
          </button>
          <!-- Damage is blood, everywhere on the sheet. -->
          <button
            type="button"
            class="min-h-[var(--touch-min)] rounded-md border border-destructive
                   bg-[var(--fill-damage)] px-3 text-sm font-semibold text-[var(--blood-300)]"
            @click="combat.rollDamage(attack.itemId)"
          >
            Damage
          </button>
        </li>
      </ul>
      <p v-if="character.attacks.length === 0" class="text-sm text-muted-foreground">
        No attacks.
      </p>
    </SheetCard>
  </div>
</template>
