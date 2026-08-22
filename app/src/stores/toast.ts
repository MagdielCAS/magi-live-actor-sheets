// A short message at the bottom of the screen. The page uses it to report
// a refused write, a roll that went out, and a lost connection.

import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastKind = 'info' | 'error'

export interface Toast {
  id: number
  text: string
  kind: ToastKind
}

const SHOW_MS = 2600

let nextId = 1

export const useToastStore = defineStore('toast', () => {
  const items = ref<Toast[]>([])

  function show(text: string, kind: ToastKind = 'info'): void {
    const id = nextId++
    items.value = [...items.value, { id, text, kind }]
    setTimeout(() => {
      items.value = items.value.filter((t) => t.id !== id)
    }, SHOW_MS)
  }

  function error(text: string): void {
    show(text, 'error')
  }

  return { items, show, error }
})
