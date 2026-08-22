// The adapter registry. A second game system needs a new file here, not a
// change in the bridge, the watchers, or the web page.

import * as dnd5e from "./dnd5e.mjs";

const ADAPTERS = new Map([[dnd5e.id, dnd5e]]);

// current returns the adapter for the active game system, or null when this
// module does not support that system.
export function current() {
  return ADAPTERS.get(game.system.id) ?? null;
}

export function supportedSystems() {
  return Array.from(ADAPTERS.keys());
}
