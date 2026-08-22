// The guard against the write loop.
//
// The old page produced more than 600 writes from one tap: a snapshot drew
// the tab again, which destroyed the focused input, which fired blur, whose
// handler wrote the same value, which made a new snapshot. Every test here
// stands for one door that loop can come back through.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import { useServerBackedField } from './useServerBackedField'
import { useUiStore } from '@/stores/ui'

beforeEach(() => {
  setActivePinia(createPinia())
})

/** A field over a value that a fake server holds. */
function makeField(initial: number) {
  const server = ref(initial)
  const write = vi.fn((value: number) => {
    // A real write shows the change at once, then sends it.
    server.value = value
  })
  const field = useServerBackedField<number>({
    read: () => server.value,
    write,
    parse: (raw) => Number(raw),
    format: (value) => String(value),
  })
  return { server, write, field }
}

describe('useServerBackedField', () => {
  it('writes nothing when the value did not change', () => {
    const { field, write } = makeField(10)
    field.onFocus()
    field.onBlur()
    expect(write).not.toHaveBeenCalled()
  })

  it('writes once when the value changed', () => {
    const { field, write } = makeField(10)
    field.onFocus()
    field.model.value = '12'
    field.onBlur()
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(12)
  })

  // Door 3. Enter commits and then blurs the element, so the blur handler
  // runs straight after. It must not write a second time.
  it('writes once for the Enter and blur pair', () => {
    const { field, write } = makeField(10)
    field.onFocus()
    field.model.value = '12'
    field.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))
    field.onBlur()
    expect(write).toHaveBeenCalledTimes(1)
  })

  // Door 1, and the heart of the whole thing. This is the exact shape of
  // the old loop: the value arrives from the server while the field is
  // open, and the blur that follows must be silent.
  it('does not write back a value the server already has', async () => {
    const { server, field, write } = makeField(10)
    field.onFocus()
    field.model.value = '12'
    field.onBlur()
    expect(write).toHaveBeenCalledTimes(1)

    // A snapshot brings the same value the page just sent.
    server.value = 12
    await nextTick()

    field.onFocus()
    field.onBlur()
    expect(write).toHaveBeenCalledTimes(1)
  })

  // Door 2. A snapshot while somebody types must not take the draft away.
  it('keeps the draft while the field has the focus', async () => {
    const { server, field } = makeField(10)
    field.onFocus()
    field.model.value = '123'

    server.value = 44
    await nextTick()

    expect(field.model.value).toBe('123')
  })

  it('takes the new value once the focus leaves', async () => {
    const { server, field } = makeField(10)
    server.value = 44
    await nextTick()
    expect(field.model.value).toBe('44')
  })

  it('puts the true value back after a blur, so a rejected draft cannot lie', () => {
    const { field } = makeField(10)
    field.onFocus()
    field.model.value = 'not a number'
    field.onBlur()
    // parse() turned that into NaN, which is not equal to 10, so a write
    // went out. What matters here is that the input shows the true value
    // again and not the text that was refused.
    expect(field.model.value).not.toBe('not a number')
  })

  it('counts an open field, so a list can hold still while somebody types', () => {
    const ui = useUiStore()
    const { field } = makeField(10)
    expect(ui.isEditing).toBe(false)
    field.onFocus()
    expect(ui.isEditing).toBe(true)
    field.onBlur()
    expect(ui.isEditing).toBe(false)
  })
})
