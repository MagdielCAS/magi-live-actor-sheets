// Draw only the rows that are on the screen.
//
// An inventory or a spell list can hold hundreds of rows. Without this a
// phone builds every row on each change and drops frames. @tanstack/vue-
// virtual is already in the dependency graph, because reka-ui uses it.

import { useVirtualizer } from '@tanstack/vue-virtual'
import type { Ref } from 'vue'

export interface VirtualRowsOptions {
  /** The element that scrolls. */
  scrollElement: Ref<HTMLElement | null>
  /** How many rows there are. */
  count: Ref<number>
  /** The height of one row in pixels, before measurement. */
  estimateSize?: number
  /** How many rows to draw outside the screen, on each side. */
  overscan?: number
}

export function useVirtualRows(opts: VirtualRowsOptions) {
  return useVirtualizer({
    get count() {
      return opts.count.value
    },
    getScrollElement: () => opts.scrollElement.value,
    estimateSize: () => opts.estimateSize ?? 56,
    overscan: opts.overscan ?? 6,
  })
}
