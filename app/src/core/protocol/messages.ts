// The message envelope and every message the page sends or receives.
// This is protocol.md sections 2, 4, and 5.

import type { SheetDTO } from './sheet'

export const PROTOCOL_VERSION = 1

/** The envelope. A reply uses the id of the request. */
export interface Envelope<TType extends string, TPayload> {
  v: typeof PROTOCOL_VERSION
  type: TType
  id?: string
  actorId?: string
  payload: TPayload
}

// --- Server to client ------------------------------------------------

export interface BridgeStatePayload {
  online: boolean
}

export interface ErrorPayload {
  code: string
  message: string
}

export type ServerMessage =
  | Envelope<'actor.snapshot', SheetDTO>
  | Envelope<'bridge.state', BridgeStatePayload>
  | Envelope<'ack', Record<string, never>>
  | Envelope<'error', ErrorPayload>

// --- Client to server ------------------------------------------------

/** A map of Foundry document path to new value. Every key must be on the allowlist. */
export type Changes = Record<string, string | number | boolean>

export type PatchPayload =
  | { target: 'actor'; changes: Changes }
  | { target: 'item'; itemId: string; changes: Changes }

export type Advantage = 'normal' | 'advantage' | 'disadvantage'

export type RollKind =
  | 'skill'
  | 'ability'
  | 'save'
  | 'tool'
  | 'death'
  | 'initiative'
  | 'hitDie'
  | 'attack'
  | 'damage'

export interface RollPayload {
  kind: RollKind
  /** For skill, ability, save, tool, and hitDie. */
  key?: string
  /** For attack and damage. */
  itemId?: string
  /** Defaults to "normal" when absent. */
  advantage?: Advantage
}

export interface UsePayload {
  itemId: string
  /** The slot level to spend, for a spell. */
  level?: number
}

export interface ChatPayload {
  text: string
  emote: boolean
}

export interface ClientPayloadMap {
  'actor.patch': PatchPayload
  'actor.roll': RollPayload
  'actor.use': UsePayload
  'actor.chat': ChatPayload
}

export type ClientMessageType = keyof ClientPayloadMap

/** The reason a send did not succeed. Always an ErrorPayload. */
export type SendFailure = ErrorPayload
