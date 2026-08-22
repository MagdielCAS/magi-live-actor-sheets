// The WebSocket client. It connects to /ws/client, reconnects on its own,
// and turns outgoing messages into promises that settle on the matching
// ack or error. See protocol.md sections 2, 4, and 7.

const PROTOCOL_VERSION = 1;
const MIN_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 15000;
const SEND_TIMEOUT_MS = 10000;

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function wsUrl(auth) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams();
  if (auth.token) params.set('token', auth.token);
  if (auth.actorId) params.set('actorId', auth.actorId);
  return `${proto}//${location.host}/ws/client?${params.toString()}`;
}

export class WSClient {
  constructor(auth) {
    this.auth = auth; // { token } or { actorId }
    this.socket = null;
    this.listeners = new Map(); // event -> Set(handler)
    this.pending = new Map(); // id -> { resolve, reject, timer }
    this.everConnected = false;
    this.manuallyClosed = false;
    this.backoffMs = MIN_BACKOFF_MS;
    this.reconnectTimer = null;
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit(event, detail) {
    for (const handler of this.listeners.get(event) ?? []) handler(detail);
  }

  connect() {
    this.manuallyClosed = false;
    this.emit('connectionState', this.everConnected ? 'reconnecting' : 'connecting');
    const socket = new WebSocket(wsUrl(this.auth));
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.backoffMs = MIN_BACKOFF_MS;
      this.everConnected = true;
      this.emit('connectionState', 'live');
    });

    socket.addEventListener('message', (event) => this.handleMessage(event));

    socket.addEventListener('close', () => {
      this.rejectAllPending('The connection closed.');
      if (this.manuallyClosed) return;
      this.emit('connectionState', this.everConnected ? 'reconnecting' : 'offline');
      this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      // The close event follows. No action here.
    });
  }

  scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    const jitter = this.backoffMs * (0.25 + Math.random() * 0.5);
    const delay = Math.min(this.backoffMs + jitter, MAX_BACKOFF_MS);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
  }

  close() {
    this.manuallyClosed = true;
    clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  handleMessage(event) {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return; // Not valid JSON. Ignore it.
    }
    if (msg.v !== PROTOCOL_VERSION) return;

    switch (msg.type) {
      case 'actor.snapshot':
        this.emit('snapshot', msg.payload);
        break;
      case 'bridge.state':
        this.emit('bridgeState', msg.payload);
        break;
      case 'ack':
        this.settlePending(msg.id, (p) => p.resolve(msg.payload));
        break;
      case 'error':
        this.settlePending(msg.id, (p) => p.reject(msg.payload));
        if (!msg.id) this.emit('serverError', msg.payload);
        break;
      default:
        break; // Unknown type. Ignore it, same as the server does.
    }
  }

  settlePending(id, settle) {
    if (!id || !this.pending.has(id)) return;
    const entry = this.pending.get(id);
    clearTimeout(entry.timer);
    this.pending.delete(id);
    settle(entry);
  }

  rejectAllPending(message) {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject({ code: 'disconnected', message });
    }
    this.pending.clear();
  }

  // Send one client message and resolve or reject on the matching ack/error.
  send(type, payload) {
    const id = makeId();
    const envelope = { v: PROTOCOL_VERSION, type, id, payload };

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject({ code: 'offline', message: 'The page is not connected.' });
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject({ code: 'timeout', message: 'The server did not answer.' });
      }, SEND_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify(envelope));
    });
  }
}
