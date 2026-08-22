// The module settings. Only a Game Master can see or change them.

import { log } from "./log.mjs";

export const MODULE_ID = "magi-live-actor-sheets";

export const SETTINGS = {
  serverUrl: "serverUrl",
  bridgeSecret: "bridgeSecret",
  enabled: "enabled",
};

export function registerSettings(onChange) {
  game.settings.register(MODULE_ID, SETTINGS.serverUrl, {
    name: "MAGI.Settings.ServerUrl.Name",
    hint: "MAGI.Settings.ServerUrl.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: String,
    default: "http://127.0.0.1:30001",
    onChange,
  });

  game.settings.register(MODULE_ID, SETTINGS.bridgeSecret, {
    name: "MAGI.Settings.BridgeSecret.Name",
    hint: "MAGI.Settings.BridgeSecret.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: String,
    default: "",
    onChange,
  });

  game.settings.register(MODULE_ID, SETTINGS.enabled, {
    name: "MAGI.Settings.Enabled.Name",
    hint: "MAGI.Settings.Enabled.Hint",
    scope: "world",
    config: true,
    restricted: true,
    type: Boolean,
    default: false,
    onChange,
  });

  registerPairingMenu();

  log.debug("Settings registered.");
}

// A button in Configure Settings that opens the pairing dialog.
//
// The button in the Actors list depends on the shape of the sidebar, and
// that shape changes between Foundry versions. This entry point uses only
// the settings API, which does not change, so there is always a way to
// reach the dialog.
function registerPairingMenu() {
  const Base = foundry.applications?.api?.ApplicationV2 ?? FormApplication;

  class PairingMenu extends Base {
    // Foundry makes this object and calls render. The work belongs to the
    // dialog, so this object only opens it. The module API is read late,
    // because settings are registered before the module is ready.
    render() {
      const api = game.modules.get(MODULE_ID)?.api;
      if (api?.pair) api.pair();
      else ui.notifications?.error(game.i18n.localize("MAGI.Pairing.NotReady"));
      return this;
    }
  }

  game.settings.registerMenu(MODULE_ID, "pair", {
    name: "MAGI.Pairing.MenuName",
    hint: "MAGI.Pairing.MenuHint",
    label: "MAGI.Pairing.Button",
    icon: "fa-solid fa-mobile-screen",
    type: PairingMenu,
    restricted: true,
  });
}

export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

// The user gives an HTTP address, because that is the address they open in a
// browser. The bridge needs the WebSocket form of the same address.
export function websocketUrl(path) {
  const raw = String(getSetting(SETTINGS.serverUrl) ?? "").trim();
  if (!raw) throw new Error("The server URL is empty.");

  const url = new URL(raw);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = url.pathname.replace(/\/$/, "") + path;
  url.search = "";
  url.hash = "";
  return url.toString();
}
