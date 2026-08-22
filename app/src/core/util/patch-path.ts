// Copy-on-write for the sheet.
//
// The store shares the sub-objects that did not change between two
// snapshots, so a shared sub-object is reachable from the snapshot before
// it. A change in place would corrupt that sharing and leave a stale view
// on the screen. An optimistic edit must therefore make a copy of the path
// it changes, and leave every other branch as it was.
//
// This is the runtime half of the DeepReadonly type in protocol/sheet.ts.

type Key = string | number

/**
 * Give back a copy of `root` where `path` holds `value`. Every object on
 * the path is copied. Every branch beside the path keeps its reference, so
 * a computed that reads one of them stays quiet.
 *
 *   patchPath(sheet, ['hp', 'value'], 12)
 *   patchPath(sheet, ['inventory', 3, 'qty'], 5)
 */
export function patchPath<T>(root: T, path: readonly Key[], value: unknown): T {
  if (path.length === 0) return value as T
  return write(root, path, 0, value) as T
}

function write(node: unknown, path: readonly Key[], depth: number, value: unknown): unknown {
  const key = path[depth]
  if (key === undefined) return value

  const last = depth === path.length - 1

  if (Array.isArray(node)) {
    const index = Number(key)
    const copy = node.slice()
    copy[index] = last ? value : write(node[index], path, depth + 1, value)
    return copy
  }

  if (typeof node === 'object' && node !== null) {
    const source = node as Record<Key, unknown>
    const copy: Record<Key, unknown> = { ...source }
    copy[key] = last ? value : write(source[key], path, depth + 1, value)
    return copy
  }

  // Nothing to copy from. Build the rest of the path.
  return { [key]: last ? value : write(undefined, path, depth + 1, value) }
}

/** The index of the item with this id, or -1. */
export function indexOfItem(list: readonly { itemId: string }[], itemId: string): number {
  return list.findIndex((item) => item.itemId === itemId)
}
