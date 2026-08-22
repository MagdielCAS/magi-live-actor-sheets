// State about the page itself, not about the character.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  /**
   * How many inputs hold a draft at this moment.
   *
   * This is the only signal about editing that is shared. A field keeps its
   * own draft inside useServerBackedField; nothing here can suppress a
   * snapshot, because a snapshot also brings hit points the GM changed, a
   * new condition, or a spent slot.
   *
   * Use this for the one job that really crosses components: hold back a
   * list that would re-order itself, or a view that would scroll on its
   * own, while a person types.
   */
  const editingCount = ref(0)
  const isEditing = computed(() => editingCount.value > 0)

  function beginEdit(): void {
    editingCount.value += 1
  }

  function endEdit(): void {
    editingCount.value = Math.max(0, editingCount.value - 1)
  }

  return { editingCount, isEditing, beginEdit, endEdit }
})
