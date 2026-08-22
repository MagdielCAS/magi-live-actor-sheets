<script setup lang="ts">
// Money and carried items.
//
// A stub for the moment. It draws the data so the route and the store are
// proved, and it marks where the virtual list goes: an inventory can hold
// hundreds of rows, and useVirtualRows() keeps a phone at 60 frames a
// second.

import { useCharacterStore } from '@/stores/character'
import { currencyPath, ITEM_PATH } from '@/core/protocol/paths'
import type { CurrencyKey } from '@/core/protocol/sheet'

const character = useCharacterStore()

const COINS: readonly CurrencyKey[] = ['pp', 'gp', 'ep', 'sp', 'cp']

function writeCoin(key: CurrencyKey, value: number): void {
  void character.patchActor({ [currencyPath(key)]: value }, [
    { path: ['currency', key], value },
  ])
}

function setQuantity(itemId: string, qty: number): void {
  const index = character.inventoryIndex(itemId)
  if (index < 0) return
  void character.patchItem(itemId, { [ITEM_PATH.quantity]: qty }, [
    { path: ['inventory', index, 'qty'], value: qty },
  ])
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <section class="rounded-xl border border-border bg-card p-4">
      <h2 class="mb-3 text-sm font-medium text-muted-foreground">Currency</h2>
      <div class="grid grid-cols-5 gap-2">
        <NumberField
          v-for="coin in COINS"
          :key="coin"
          :label="coin.toUpperCase()"
          :read="() => character.currency?.[coin] ?? 0"
          :max="999999"
          :write="(v) => writeCoin(coin, v)"
        />
      </div>
    </section>

    <!-- TODO: wrap this list in useVirtualRows() before it can hold
         hundreds of items. -->
    <section class="rounded-xl border border-border bg-card p-4">
      <h2 class="mb-3 text-sm font-medium text-muted-foreground">Inventory</h2>
      <ul class="flex flex-col divide-y divide-border">
        <li
          v-for="item in character.inventory"
          :key="item.itemId"
          class="flex items-center gap-3 py-2"
        >
          <span class="min-w-0 flex-1 truncate text-sm">{{ item.name }}</span>
          <div class="flex items-center gap-1">
            <button
              type="button"
              aria-label="One less"
              class="size-8 rounded bg-secondary"
              @click="setQuantity(item.itemId, Math.max(0, item.qty - 1))"
            >
              −
            </button>
            <span class="w-8 text-center text-sm tabular-nums">{{ item.qty }}</span>
            <button
              type="button"
              aria-label="One more"
              class="size-8 rounded bg-secondary"
              @click="setQuantity(item.itemId, Math.min(999, item.qty + 1))"
            >
              +
            </button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
