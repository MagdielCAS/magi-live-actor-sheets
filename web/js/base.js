// Where the page lives.
//
// A proxy can serve the page under a path, for example https://host/magi/.
// An address that starts with "/" would then leave that path and reach the
// Foundry server instead of the relay. So every address must be relative to
// the root of this application.
//
// This file is always at <root>/js/base.js, so the root is one directory
// above it. The address of the page is not a safe base, because the server
// answers an unknown path with the same page.

const APP_ROOT = new URL("../", import.meta.url);

// appUrl makes an absolute address for a path in this application.
export function appUrl(path) {
  return new URL(path, APP_ROOT);
}

// appWebSocketUrl makes the WebSocket address for a path in this
// application, with the query that the caller gives.
export function appWebSocketUrl(path, params) {
  const url = appUrl(path);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (params) url.search = params.toString();
  return url.toString();
}
