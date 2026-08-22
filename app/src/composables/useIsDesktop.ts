// The one place that asks the browser about the size of the screen.
//
// The layout itself does NOT use this. AppLayout draws both navigation
// bars and lets Tailwind hide one, so there is no layout shift, no second
// mount on a rotation, and nothing that waits for JavaScript before the
// first paint.
//
// Use this only for behaviour that CSS cannot express: a swipe gesture, a
// different number of rows to keep alive, a hover-only affordance.

import { useMediaQuery } from '@vueuse/core'
import type { Ref } from 'vue'

/** The same width as the `md:` prefix in Tailwind. */
export const DESKTOP_QUERY = '(min-width: 768px)'

export function useIsDesktop(): Ref<boolean> {
  return useMediaQuery(DESKTOP_QUERY)
}

/** True on a device where the main pointer cannot hover. */
export function useIsTouch(): Ref<boolean> {
  return useMediaQuery('(hover: none) and (pointer: coarse)')
}
