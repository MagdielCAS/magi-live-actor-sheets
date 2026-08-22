// Structural sharing is what stops one tab from drawing again because
// another part of the sheet changed. If it stops working, nothing breaks
// visibly: the page just becomes slow again. So it is tested.

import { describe, expect, it } from 'vitest'
import { reconcile } from './structural-share'
import { patchPath } from './patch-path'

describe('reconcile', () => {
  it('keeps the whole object when nothing changed', () => {
    const prev = { hp: { value: 10 }, spells: { slots: [{ level: 1 }] } }
    const next = structuredClone(prev)
    expect(reconcile(prev, next)).toBe(prev)
  })

  it('keeps the parts that did not change', () => {
    const prev = {
      hp: { value: 10, max: 20 },
      spells: { slots: [{ level: 1, value: 3 }] },
      inventory: [{ itemId: 'i1', qty: 2 }],
    }
    const next = structuredClone(prev)
    next.hp.value = 8

    const merged = reconcile(prev, next)

    expect(merged).not.toBe(prev)
    expect(merged.hp).not.toBe(prev.hp)
    expect(merged.hp.value).toBe(8)
    // The point of the whole exercise: the spell tab and the item tab
    // read the same objects as before, so they do not draw again.
    expect(merged.spells).toBe(prev.spells)
    expect(merged.inventory).toBe(prev.inventory)
  })

  it('keeps the rows of a list that did not change', () => {
    const prev = { inventory: [{ itemId: 'i1', qty: 1 }, { itemId: 'i2', qty: 5 }] }
    const next = structuredClone(prev)
    next.inventory[1]!.qty = 6

    const merged = reconcile(prev, next)

    expect(merged.inventory[0]).toBe(prev.inventory[0])
    expect(merged.inventory[1]).not.toBe(prev.inventory[1])
  })

  it('notices a key that went away', () => {
    const prev = { a: 1, b: 2 }
    const next = { a: 1 } as { a: number; b?: number }
    const merged = reconcile(prev, next)
    expect(merged).not.toBe(prev)
    expect('b' in merged).toBe(false)
  })

  it('notices a list that got shorter', () => {
    const prev = { list: [1, 2, 3] }
    const merged = reconcile(prev, { list: [1, 2] })
    expect(merged.list).toHaveLength(2)
  })
})

describe('patchPath', () => {
  it('copies only the path it changes', () => {
    const sheet = {
      hp: { value: 10, max: 20 },
      spells: { slots: [{ level: 1, value: 3 }] },
    }

    const next = patchPath(sheet, ['hp', 'value'], 7)

    expect(next).not.toBe(sheet)
    expect(next.hp).not.toBe(sheet.hp)
    expect(next.hp.value).toBe(7)
    expect(next.spells).toBe(sheet.spells)
    // The value before is untouched, which is what makes sharing safe.
    expect(sheet.hp.value).toBe(10)
  })

  it('reaches into a list by index', () => {
    const sheet = { inventory: [{ itemId: 'i1', qty: 1 }, { itemId: 'i2', qty: 5 }] }
    const next = patchPath(sheet, ['inventory', 1, 'qty'], 6)

    expect(next.inventory[1]!.qty).toBe(6)
    expect(next.inventory[0]).toBe(sheet.inventory[0])
    expect(sheet.inventory[1]!.qty).toBe(5)
  })
})
