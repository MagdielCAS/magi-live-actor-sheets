// Performs the commands that arrive from a phone.
//
// Every command must answer with exactly one command.result that carries
// the id of the request. The server waits for that answer, so a command
// must never throw without a reply.

import { log } from "./log.mjs";

export class Commands {
  #bridge;
  #adapter;
  #watchers;

  constructor(bridge, adapter, watchers) {
    this.#bridge = bridge;
    this.#adapter = adapter;
    this.#watchers = watchers;
  }

  register() {
    this.#bridge.on("bridge.ready", (message) => {
      log.info("The server accepted the bridge.");
      this.#watchers.setSubscriptions(message.payload?.subscriptions ?? []);
      this.#watchers.sendActorList();
      for (const actorId of message.payload?.subscriptions ?? []) {
        this.#watchers.send(actorId);
      }
    });

    this.#bridge.on("subscriptions.set", (message) => {
      const actorIds = message.payload?.actorIds ?? [];
      this.#watchers.setSubscriptions(actorIds);
      for (const actorId of actorIds) this.#watchers.send(actorId);
    });

    this.#bridge.on("actor.request", (message) => {
      this.#watchers.send(message.actorId);
    });

    this.#bridge.on("command.patch", (m) => this.#run(m, (actor) => this.#adapter.applyPatch(actor, m.payload)));
    this.#bridge.on("command.roll", (m) => this.#run(m, (actor) => this.#adapter.roll(actor, m.payload)));
    this.#bridge.on("command.use", (m) => this.#run(m, (actor) => this.#adapter.use(actor, m.payload)));
    this.#bridge.on("command.chat", (m) => this.#run(m, (actor) => this.#adapter.chat(actor, m.payload)));
  }

  // run finds the actor, performs one action, and always answers.
  async #run(message, action) {
    try {
      const actor = game.actors.get(message.actorId);
      if (!actor) throw new Error(`There is no actor with the id ${message.actorId}`);

      await action(actor);
      this.#reply(message.id, { ok: true });

      // A roll or an item use can change the actor. The document hooks
      // report that change, so no snapshot is necessary here.
    } catch (err) {
      log.warn(`The command ${message.type} failed.`, err);
      this.#reply(message.id, { ok: false, error: String(err?.message ?? err) });
    }
  }

  #reply(id, payload) {
    if (!id) return;
    this.#bridge.send("command.result", payload, { id });
  }
}
