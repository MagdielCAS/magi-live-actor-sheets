// Where the page lives.
//
// A proxy can serve the page under a path, for example https://host/magi/.
// An address that starts with "/" would then leave that path and reach the
// Foundry server instead of the relay. So every address must be relative to
// the root of this application.
//
// This module is built into a chunk in <root>/assets/, so the root is one
// directory above it. Vite keeps every JS chunk flat in assetsDir, and a CI
// step tests that. The address of the page is not a safe base, because the
// server answers an unknown path with the same page.

const APP_ROOT = new URL('../', import.meta.url)

/** An absolute address for a path in this application. */
export function appUrl(path: string): URL {
  return new URL(path, APP_ROOT)
}

/**
 * The path part of the root of this application, with a trailing slash.
 * This is the base for the router. Vue Router defaults the base of a hash
 * history to location.pathname + location.search, which would make the
 * pairing code in "?c=123456" stay in every address after it, long after
 * the code is used. Always pass this value.
 */
export function appPathname(): string {
  return APP_ROOT.pathname
}

/**
 * The WebSocket address for a path in this application, with the query
 * that the caller gives.
 */
export function appWebSocketUrl(path: string, params?: URLSearchParams): string {
  const url = appUrl(path)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  if (params) url.search = params.toString()
  return url.toString()
}
