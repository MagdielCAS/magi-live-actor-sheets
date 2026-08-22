// Keep the reference of a sub-object that did not change.
//
// The module sends a full snapshot for each change, so the whole sheet is
// replaced many times a minute. Without this step every part of the page
// would draw again each time, because each part would see a new object.
//
// reconcile() walks the new snapshot next to the old one and gives back the
// OLD object wherever the two are equal. A computed that reads one section
// then gives the same reference, and Vue does not tell its dependents. The
// spell tab stays quiet while the hit points change.
//
// The cost is one comparison for each snapshot. The sheet is small and the
// module already waits 120 ms between snapshots (protocol.md section 9), so
// this is much cheaper than the work it prevents.

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Give back `prev` when it is deeply equal to `next`, and otherwise a value
 * that shares every unchanged part of `prev`.
 */
export function reconcile<T>(prev: unknown, next: T): T {
  return merge(prev, next) as T
}

function merge(prev: unknown, next: unknown): unknown {
  if (Object.is(prev, next)) return prev

  if (Array.isArray(next)) {
    if (!Array.isArray(prev) || prev.length !== next.length) {
      return next.map((item, i) => merge(Array.isArray(prev) ? prev[i] : undefined, item))
    }
    let same = true
    const out = next.map((item, i) => {
      const merged = merge(prev[i], item)
      if (!Object.is(merged, prev[i])) same = false
      return merged
    })
    return same ? prev : out
  }

  if (isPlainObject(next)) {
    if (!isPlainObject(prev)) return next

    const nextKeys = Object.keys(next)
    const prevKeys = Object.keys(prev)
    let same = nextKeys.length === prevKeys.length

    const out: Record<string, unknown> = {}
    for (const key of nextKeys) {
      const merged = merge(prev[key], next[key])
      out[key] = merged
      if (same && !Object.is(merged, prev[key])) same = false
    }
    return same ? prev : out
  }

  // A primitive that is not identical is simply the new one.
  return next
}
