// Every tab is a dynamic import, so the first paint carries the shell and
// one tab, not the whole sheet. Vite makes one chunk for each import()
// below.

import type { RouteRecordRaw } from 'vue-router'

/** The tabs of the sheet, in the order the navigation shows them. */
export interface SheetTab {
  name: string
  path: string
  label: string
}

export const SHEET_TABS: readonly SheetTab[] = [
  { name: 'sheet.stats', path: 'stats', label: 'Stats' },
  { name: 'sheet.combat', path: 'combat', label: 'Combat' },
  { name: 'sheet.spells', path: 'spells', label: 'Spells' },
  { name: 'sheet.inventory', path: 'inventory', label: 'Items' },
  { name: 'sheet.features', path: 'features', label: 'Feats' },
  { name: 'sheet.bio', path: 'bio', label: 'Notes' },
]

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'boot',
    // A device that has a token knows nothing about its actor until the
    // first snapshot arrives. This route is the wait.
    component: () => import('@/modules/pairing/views/BootView.vue'),
    meta: { chrome: false },
  },
  {
    path: '/pair',
    name: 'pair',
    // The pairing screen is the first thing a new device sees, so it is
    // not split away from the entry chunk.
    component: () => import('@/modules/pairing/views/PairingView.vue'),
    meta: { chrome: false },
  },
  {
    path: '/sheet/:actorId',
    component: () => import('@/modules/character/views/SheetShell.vue'),
    props: true,
    children: [
      { path: '', redirect: { name: 'sheet.stats' } },
      {
        path: 'stats',
        name: 'sheet.stats',
        component: () => import('@/modules/character/views/StatsView.vue'),
      },
      {
        path: 'combat',
        name: 'sheet.combat',
        component: () => import('@/modules/combat/views/CombatView.vue'),
      },
      {
        path: 'spells',
        name: 'sheet.spells',
        component: () => import('@/modules/character/views/SpellsView.vue'),
      },
      {
        path: 'inventory',
        name: 'sheet.inventory',
        component: () => import('@/modules/character/views/InventoryView.vue'),
      },
      {
        path: 'features',
        name: 'sheet.features',
        component: () => import('@/modules/character/views/FeaturesView.vue'),
      },
      {
        path: 'bio',
        name: 'sheet.bio',
        component: () => import('@/modules/character/views/BiographyView.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'boot' },
  },
]
