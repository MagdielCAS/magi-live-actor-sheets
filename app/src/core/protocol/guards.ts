// Narrowing at the edge of the WebSocket.
//
// Everything that arrives on the socket is unknown until it passes one of
// these. The checks are deliberately shallow: they test the fields the page
// reads before it treats the value as a message. A message that does not
// pass is dropped, and the drop is logged. The page never fails in silence.

import { PROTOCOL_VERSION } from './messages'
import type { BridgeStatePayload, ErrorPayload, ServerMessage } from './messages'
import type { SheetDTO } from './sheet'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** True when the value is an envelope of this protocol version. */
export function isEnvelope(value: unknown): value is ServerMessage {
  return isRecord(value) && value['v'] === PROTOCOL_VERSION && typeof value['type'] === 'string'
}

/**
 * A snapshot must carry the fields the page reads before it can draw
 * anything. A partial snapshot would fail later, in a component, where the
 * reason is much harder to see.
 */
export function isSheetDTO(value: unknown): value is SheetDTO {
  if (!isRecord(value)) return false
  return (
    typeof value['id'] === 'string' &&
    typeof value['rev'] === 'number' &&
    isRecord(value['header']) &&
    isRecord(value['hp']) &&
    isRecord(value['spells']) &&
    Array.isArray(value['abilities']) &&
    Array.isArray(value['skills']) &&
    Array.isArray(value['inventory'])
  )
}

export function isBridgeState(value: unknown): value is BridgeStatePayload {
  return isRecord(value) && typeof value['online'] === 'boolean'
}

export function isErrorPayload(value: unknown): value is ErrorPayload {
  return isRecord(value) && typeof value['code'] === 'string' && typeof value['message'] === 'string'
}

/** Make an ErrorPayload out of an unknown rejection, so a catch always has one shape. */
export function toErrorPayload(value: unknown, fallbackCode = 'unknown'): ErrorPayload {
  if (isErrorPayload(value)) return value
  if (value instanceof Error) return { code: fallbackCode, message: value.message }
  return { code: fallbackCode, message: String(value) }
}
