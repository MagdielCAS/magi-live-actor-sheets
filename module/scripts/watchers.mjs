// Watches the Foundry documents and sends a snapshot when data changes.
//
// The server tells the module which actors have a live viewer. The module
// builds a snapshot only for those actors, so a large world does not do
// work for a sheet that nobody looks at.

import { log } from "./log.mjs";

const DEBOUNCE_MS = 120;

export class Watchers {
  #bridge;
  #adapter;
  #subscribed = new Set();
  #timers = new Map();
  #revisions = new Map();

  constructor(bridge, adapter) {
    this.#bridge = bridge;
    this.#adapter = adapter;
  }

  setSubscriptions(actorIds) {
    this.#subscribed = new Set(actorIds ?? []);
    log.debug("Subscribed actors:", [...this.#subscribed]);
  }

  register() {
    Hooks.on("updateActor", (actor) => this.touch(actor));

    for (const hook of ["createItem", "updateItem", "deleteItem"]) {
      Hooks.on(hook, (item) => this.touch(item.parent));
    }

    for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
      Hooks.on(hook, (effect) => this.touch(this.#actorOf(effect)));
    }

    log.debug("Document hooks registered.");
  }

  // touch asks for a snapshot of one actor a short time from now. Several
  // changes in that time make one snapshot, not many.
  touch(actor) {
    if (!actor?.id || !this.#subscribed.has(actor.id)) return;

    clearTimeout(this.#timers.get(actor.id));
    this.#timers.set(
      actor.id,
      setTimeout(() => {
        this.#timers.delete(actor.id);
        this.send(actor.id);
      }, DEBOUNCE_MS)
    );
  }

  // send builds and sends the snapshot for one actor at once.
  send(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) {
      log.warn(`The world has no actor with the id ${actorId}`);
      return;
    }

    let sheet;
    try {
      sheet = this.#adapter.buildSheet(actor);
    } catch (err) {
      log.error(`Cannot read the actor ${actor.name}.`, err);
      return;
    }

    const rev = (this.#revisions.get(actorId) ?? 0) + 1;
    this.#revisions.set(actorId, rev);
    sheet.rev = rev;

    this.#bridge.send("actor.snapshot", sheet, { actorId });
  }

  sendActorList() {
    const actors = game.actors
      .filter((actor) => actor.type === "character")
      .map((actor) => ({
        id: actor.id,
        name: actor.name,
        img: actor.img,
      }));
    this.#bridge.send("actor.list", { actors });
  }

  // An effect can belong to an actor, or to an item that an actor owns.
  #actorOf(effect) {
    const parent = effect?.parent;
    if (!parent) return null;
    return parent.documentName === "Actor" ? parent : parent.parent ?? null;
  }
}
