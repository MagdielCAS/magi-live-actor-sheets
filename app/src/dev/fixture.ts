// The example character, with the type of the contract put back on it.
//
// It stays at web/js/fixture.js, and this module reads it from there, so
// there is one example character for three readers:
//
//   - the old page, which imports it at run time;
//   - scripts/dev/fake-bridge.mjs, which reads the file from disk with a
//     plain import and cannot read TypeScript;
//   - this page, where Vite puts it in a chunk at build time, so there is
//     no address to resolve at run time.
//
// Move it into this project only when /web goes away. Moving it earlier
// breaks the two readers above: the old page would ask the relay for a
// file outside the directory it serves, and get a 404.

// @ts-expect-error - a plain .js module with no types of its own.
import { fixtureSheet as rawFixtureSheet } from '../../../web/js/fixture.js'
import type { SheetDTO } from '@/core/protocol/sheet'

export function fixtureSheet(): SheetDTO {
  return (rawFixtureSheet as () => unknown)() as SheetDTO
}
