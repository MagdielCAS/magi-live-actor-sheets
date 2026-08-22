// Magi Live Actor Sheets.
//
// The module joins Foundry to the relay server. Only the Game Master tab
// opens the bridge, because a player tab would send the same snapshots
// twice and cannot write to another player's actor.

import { log } from "./log.mjs";
import { MODULE_ID, SETTINGS, getSetting, registerSettings } from "./settings.mjs";
import { Bridge } from "./bridge.mjs";
import { Watchers } from "./watchers.mjs";
import { Commands } from "./commands.mjs";
import { Pairing } from "./pairing.mjs";
import * as adapters from "./adapters/index.mjs";

const state = { bridge: null, watchers: null, pairing: null, adapter: null };

Hooks.once("init", () => {
  registerSettings(() => restart());
});

Hooks.once("ready", () => {
  state.adapter = adapters.current();
  if (!state.adapter) {
    log.warn(
      `The game system "${game.system.id}" is not supported. ` +
        `This module supports: ${adapters.supportedSystems().join(", ")}.`
    );
    return;
  }

  state.bridge = new Bridge();
  state.watchers = new Watchers(state.bridge, state.adapter);
  state.pairing = new Pairing(state.bridge);

  new Commands(state.bridge, state.adapter, state.watchers).register();
  state.pairing.register();
  state.watchers.register();

  // A small API helps when something needs a check in the console.
  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = {
      bridge: state.bridge,
      pair: () => state.pairing.open(),
      snapshot: (actorId) => state.adapter.buildSheet(game.actors.get(actorId)),
    };
  }

  restart();
});

function restart() {
  if (!state.bridge) return;

  state.bridge.stop();

  if (!game.user.isGM) {
    log.debug("This client is not the Game Master, so it does not bridge.");
    return;
  }
  if (!getSetting(SETTINGS.enabled)) {
    log.info("The bridge is off. Turn it on in the module settings.");
    return;
  }

  state.bridge.start();
}
