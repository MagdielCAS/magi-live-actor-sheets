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

  log.debug("Settings registered.");
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
