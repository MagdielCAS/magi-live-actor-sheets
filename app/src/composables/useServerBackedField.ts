// An input whose true value lives on the server.
//
// This replaces commitOnBlurOrEnter() in web/js/util.js, and it exists for
// one reason: the old page produced more than 600 writes from one tap.
//
// The old loop went like this. A snapshot drew the tab again with
// innerHTML, which destroyed the input that had the focus, which fired a
// blur event, whose handler wrote the same value again, which made a new
// snapshot. The optimistic echo drew the tab too, so the loop did not even
// need the server to answer.
//
// Vue patches in place, so with a stable key the input is not destroyed and
// the first trigger is gone. The focus and caret work in web/app.js is
// therefore dead and is NOT carried over. But the loop can come back
// through three doors, and the guard below closes all of them:
//
//   1. commit() compares against the LIVE server value, not the value the
//      input was drawn with. This is stronger than the old `drawnWith`
//      check: it holds no matter who fired the blur, the unmount included,
//      and it also stops a write when somebody else already set the value.
//   2. The draft is re-seeded from the server only while the field does
//      NOT have the focus, so a snapshot cannot take away what a person is
//      typing.
//   3. A `committed` latch, reset on focus, makes the Enter-then-blur pair
//      write once. This is the old `done` latch.
//
// Never commit from onBeforeUnmount. That was the exact trigger of the old
// bug.

import { computed, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useUiStore } from '@/stores/ui'

export interface ServerBackedFieldOptions<T> {
  /** Read the true value out of the store. */
  read: () => T
  /** Show the change and send it. */
  write: (value: T) => void
  /** Turn the text of the input into the value. Clamping belongs here. */
  parse?: (raw: string) => T
  /** Turn the value into the text of the input. */
  format?: (value: T) => string
  /** Defaults to Object.is. */
  equals?: (a: T, b: T) => boolean
  /**
   * Write while the person types, after this many milliseconds of quiet,
   * instead of only on blur. Use it for a long text field.
   */
  debounceMs?: number
}

export interface ServerBackedField {
  /** Bind this with v-model. */
  model: Ref<string>
  /** True while the draft is different from the server value. */
  dirty: ComputedRef<boolean>
  onFocus: () => void
  onBlur: () => void
  onKeydown: (event: KeyboardEvent) => void
}

export function useServerBackedField<T>(opts: ServerBackedFieldOptions<T>): ServerBackedField {
  const format = opts.format ?? ((v: T) => String(v))
  const parse = opts.parse ?? ((raw: string) => raw as unknown as T)
  const equals = opts.equals ?? Object.is

  const ui = useUiStore()

  const serverValue = computed(opts.read)
  const model = ref<string>(format(serverValue.value))
  const focused = ref(false)
  /** The last value this field wrote, since the focus arrived. */
  let lastCommitted: { value: T } | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  const dirty = computed(() => !equals(parse(model.value), serverValue.value))

  // Door 2: the server can refresh the draft, but never while a person is
  // in the field.
  watch(serverValue, (next) => {
    if (focused.value) return
    model.value = format(next)
  })

  function commit(): void {
    const next = parse(model.value)
    // Door 1. This comparison is what makes the loop impossible. write()
    // shows the change at once, so the server value is already `next` when
    // the blur after an Enter arrives here.
    if (equals(next, serverValue.value)) return
    // Door 3. The same guard again, and it does not need write() to show
    // the change at once. A debounced field passes it, because each new
    // value is different from the one before.
    if (lastCommitted !== null && equals(next, lastCommitted.value)) return
    lastCommitted = { value: next }
    opts.write(next)
  }

  function scheduleCommit(): void {
    if (opts.debounceMs === undefined) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(commit, opts.debounceMs)
  }

  if (opts.debounceMs !== undefined) {
    watch(model, scheduleCommit)
  }

  function onFocus(): void {
    focused.value = true
    lastCommitted = null
    ui.beginEdit()
  }

  function onBlur(): void {
    clearTimeout(debounceTimer)
    commit()
    focused.value = false
    ui.endEdit()
    // Put the true value back on the screen, so a draft that the server
    // refused, or that parse() changed, does not stay there and lie.
    model.value = format(serverValue.value)
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return
    event.preventDefault()
    clearTimeout(debounceTimer)
    commit()
    // Door 3: the blur that follows finds the value already equal to the
    // server value, so it writes nothing.
    ;(event.target as HTMLElement | null)?.blur()
  }

  return { model, dirty, onFocus, onBlur, onKeydown }
}
