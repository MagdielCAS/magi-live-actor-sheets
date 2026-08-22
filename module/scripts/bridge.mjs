// The WebSocket client that joins Foundry to the relay server.
//
// Only the Game Master tab opens this connection. A player tab would send
// the same snapshots twice and cannot write to another player's actor.

import { log } from "./log.mjs";
import { MODULE_ID, SETTINGS, getSetting, websocketUrl } from "./settings.mjs";

const PROTOCOL_VERSION = 1;
const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;

// The server closes with this code when the secret is wrong. Another try
// would fail in the same way, so the bridge stops.
const POLICY_VIOLATION = 1008;

export class Bridge {
  #socket = null;
  #retryMs = FIRST_RETRY_MS;
  #timer = null;
  #stopped = false;
  #handlers = new Map();

  // on registers the function that answers one message type.
  on(type, handler) {
    this.#handlers.set(type, handler);
  }

  get connected() {
    return this.#socket?.readyState === WebSocket.OPEN;
  }

  start() {
    this.#stopped = false;
    this.#connect();
  }

  stop() {
    this.#stopped = true;
    clearTimeout(this.#timer);
    this.#socket?.close(1000, "The module stopped the bridge.");
    this.#socket = null;
  }

  send(type, payload, extra = {}) {
    if (!this.connected) return false;
    this.#socket.send(JSON.stringify({ v: PROTOCOL_VERSION, type, payload, ...extra }));
    return true;
  }

  #connect() {
    if (this.#stopped) return;

    let url;
    try {
      url = websocketUrl("/ws/bridge");
    } catch (err) {
      log.error("The server URL is not valid.", err);
      return;
    }

    log.info(`Connecting to ${url}`);
    let socket;
    try {
      socket = new WebSocket(url);
    } catch (err) {
      log.error("Cannot open the connection.", err);
      this.#retry();
      return;
    }
    this.#socket = socket;

    // A socket that this object replaced can still send a close event
    // later. Each handler therefore acts only while its own socket is the
    // current one. Without this test, the late close event of an old
    // socket would remove the new socket and start one more connection.
    // The server keeps only the newest bridge, so that makes a loop of
    // connections that close each other.
    const current = () => this.#socket === socket;

    socket.addEventListener("open", () => {
      if (current()) this.#onOpen();
    });
    socket.addEventListener("message", (event) => {
      if (current()) this.#onMessage(event);
    });
    socket.addEventListener("close", (event) => {
      if (current()) this.#onClose(event);
    });
    socket.addEventListener("error", () => {
      /* The close event follows, and it does the report. */
    });
  }

  #onOpen() {
    this.#retryMs = FIRST_RETRY_MS;
    this.send("bridge.hello", {
      secret: getSetting(SETTINGS.bridgeSecret),
      worldId: game.world.id,
      worldTitle: game.world.title,
      systemId: game.system.id,
      systemVersion: game.system.version,
      foundryVersion: game.version,
      moduleVersion: game.modules.get(MODULE_ID)?.version ?? "0.0.0",
    });
  }

  #onMessage(event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      log.warn("The server sent text that is not JSON.");
      return;
    }

    const handler = this.#handlers.get(message.type);
    if (!handler) {
      log.debug(`No handler for the message type ${message.type}`);
      return;
    }

    // A handler must never stop the connection, so every fault is caught.
    Promise.resolve()
      .then(() => handler(message))
      .catch((err) => log.error(`The handler for ${message.type} failed.`, err));
  }

  #onClose(event) {
    this.#socket = null;
    if (this.#stopped) return;

    if (event.code === POLICY_VIOLATION) {
      log.error(`The server refused the bridge: ${event.reason}`);
      ui.notifications?.error(
        game.i18n.format("MAGI.Notify.Refused", { reason: event.reason || "" })
      );
      return;
    }

    log.warn(`The connection closed with code ${event.code}. Trying again.`);
    this.#retry();
  }

  #retry() {
    // A small random part stops every client from returning at once.
    const jitter = Math.random() * 500;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#connect(), this.#retryMs + jitter);
    this.#retryMs = Math.min(this.#retryMs * 2, MAX_RETRY_MS);
  }
}
