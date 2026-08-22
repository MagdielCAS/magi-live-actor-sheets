// The WebSocket client. It connects to ws/client, reconnects on its own,
// and turns an outgoing message into a promise that settles on the matching
// ack or error. See protocol.md sections 2, 4, and 7.
//
// This class knows nothing about Vue. The store around it holds it in a
// plain variable, never in reactive state: a WebSocket inside a reactive
// proxy is a source of silent faults.

import { appWebSocketUrl } from './base'
import { PROTOCOL_VERSION } from '../protocol/messages'
import type {
  BridgeStatePayload,
  ClientMessageType,
  ClientPayloadMap,
  ErrorPayload,
} from '../protocol/messages'
import type { SheetDTO } from '../protocol/sheet'
import { isBridgeState, isEnvelope, isErrorPayload, isSheetDTO } from '../protocol/guards'

const MIN_BACKOFF_MS = 500
const MAX_BACKOFF_MS = 15000
const SEND_TIMEOUT_MS = 10000

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'

/** One of the two, never both. protocol.md section 7. */
export type Auth = { token: string } | { actorId: string }

export interface WSClientEvents {
  snapshot: SheetDTO
  bridgeState: BridgeStatePayload
  /** An error the page did not ask for. It has no request id. */
  serverError: ErrorPayload
  connectionState: ConnectionStatus
}

type Handler<K extends keyof WSClientEvents> = (detail: WSClientEvents[K]) => void

interface Pending {
  resolve: (value: unknown) => void
  reject: (reason: ErrorPayload) => void
  timer: ReturnType<typeof setTimeout>
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function wsUrl(auth: Auth): string {
  const params = new URLSearchParams()
  if ('token' in auth) params.set('token', auth.token)
  else params.set('actorId', auth.actorId)
  return appWebSocketUrl('ws/client', params)
}

export class WSClient {
  private socket: WebSocket | null = null
  private readonly listeners = new Map<string, Set<(detail: never) => void>>()
  private readonly pending = new Map<string, Pending>()
  private everConnected = false
  private manuallyClosed = false
  private backoffMs = MIN_BACKOFF_MS
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly auth: Auth) {}

  on<K extends keyof WSClientEvents>(event: K, handler: Handler<K>): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(handler as (detail: never) => void)
    return () => {
      this.listeners.get(event)?.delete(handler as (detail: never) => void)
    }
  }

  private emit<K extends keyof WSClientEvents>(event: K, detail: WSClientEvents[K]): void {
    for (const handler of this.listeners.get(event) ?? []) {
      ;(handler as Handler<K>)(detail)
    }
  }

  connect(): void {
    this.manuallyClosed = false
    this.emit('connectionState', this.everConnected ? 'reconnecting' : 'connecting')

    const socket = new WebSocket(wsUrl(this.auth))
    this.socket = socket

    socket.addEventListener('open', () => {
      this.backoffMs = MIN_BACKOFF_MS
      this.everConnected = true
      this.emit('connectionState', 'live')
    })

    socket.addEventListener('message', (event: MessageEvent) => {
      this.handleMessage(event)
    })

    socket.addEventListener('close', (event: CloseEvent) => {
      // A browser turns a refused handshake into code 1006 with no reason,
      // so this line is often the only thing that can explain a failure.
      console.warn(
        `magi: the connection closed. code=${event.code} reason=${event.reason || '(none)'}`,
      )
      this.rejectAllPending('The connection closed.')
      if (this.manuallyClosed) return
      this.emit('connectionState', this.everConnected ? 'reconnecting' : 'offline')
      this.scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      // The close event follows. No action here.
    })
  }

  private scheduleReconnect(): void {
    clearTimeout(this.reconnectTimer)
    const jitter = this.backoffMs * (0.25 + Math.random() * 0.5)
    const delay = Math.min(this.backoffMs + jitter, MAX_BACKOFF_MS)
    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS)
  }

  close(): void {
    this.manuallyClosed = true
    clearTimeout(this.reconnectTimer)
    this.socket?.close()
  }

  private handleMessage(event: MessageEvent): void {
    let raw: unknown
    try {
      raw = JSON.parse(String(event.data))
    } catch {
      console.warn('magi: the server sent a message that is not JSON. It was dropped.')
      return
    }

    if (!isEnvelope(raw)) {
      console.warn('magi: the server sent a message of another protocol version. It was dropped.')
      return
    }

    switch (raw.type) {
      case 'actor.snapshot':
        if (!isSheetDTO(raw.payload)) {
          console.warn('magi: the server sent a snapshot without the necessary fields.')
          return
        }
        this.emit('snapshot', raw.payload)
        return

      case 'bridge.state':
        if (!isBridgeState(raw.payload)) return
        this.emit('bridgeState', raw.payload)
        return

      case 'ack':
        this.settlePending(raw.id, (p) => {
          p.resolve(raw.payload)
        })
        return

      case 'error': {
        const payload: ErrorPayload = isErrorPayload(raw.payload)
          ? raw.payload
          : { code: 'unknown', message: 'The server refused the request.' }
        if (raw.id) {
          this.settlePending(raw.id, (p) => {
            p.reject(payload)
          })
          return
        }
        // An error with no request id belongs to nobody. The old page threw
        // it away in silence; this one gives it to a listener.
        console.warn(`magi: the server sent an error. code=${payload.code} ${payload.message}`)
        this.emit('serverError', payload)
        return
      }

      default:
        // Unknown type. Ignore it, the same as the server does.
        return
    }
  }

  private settlePending(id: string | undefined, settle: (entry: Pending) => void): void {
    if (!id) return
    const entry = this.pending.get(id)
    if (!entry) return
    clearTimeout(entry.timer)
    this.pending.delete(id)
    settle(entry)
  }

  private rejectAllPending(message: string): void {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer)
      entry.reject({ code: 'disconnected', message })
    }
    this.pending.clear()
  }

  /**
   * Send one client message. The promise settles on the matching ack or
   * error. There is no queue: a message made while the socket is down
   * fails immediately, and the caller shows that to the user.
   */
  send<K extends ClientMessageType>(type: K, payload: ClientPayloadMap[K]): Promise<unknown> {
    const socket = this.socket
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      const failure: ErrorPayload = { code: 'offline', message: 'The page is not connected.' }
      return Promise.reject(failure)
    }

    const id = makeId()
    const envelope = { v: PROTOCOL_VERSION, type, id, payload }

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject({ code: 'timeout', message: 'The server did not answer.' })
      }, SEND_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify(envelope))
    })
  }
}
