// The pairing dialog.
//
// The Game Master picks a character. The server makes a short code. The
// dialog then shows the code and a QR picture. The player scans the
// picture, or types the code on the phone.

import { log } from "./log.mjs";
import { toSvg } from "./qr.mjs";

const REQUEST_TIMEOUT_MS = 10000;

// The application class moved in Foundry v14. Accept both names, so the
// module works on v13 and on v14.
function dialogClass() {
  const api = foundry.applications.api;
  return api.DialogV2 ?? api.Dialog;
}

export class Pairing {
  #bridge;
  #pending = new Map();

  constructor(bridge) {
    this.#bridge = bridge;
  }

  register() {
    this.#bridge.on("pairing.issued", (message) => {
      const resolve = this.#pending.get(message.id);
      if (!resolve) return;
      this.#pending.delete(message.id);
      resolve(message.payload);
    });

    // A button in the Actors list opens the dialog.
    Hooks.on("renderActorDirectory", (app, element) => {
      if (!game.user.isGM) return;
      this.#addDirectoryButton(element instanceof HTMLElement ? element : element[0]);
    });
  }

  #addDirectoryButton(root) {
    if (!root || root.querySelector(".magi-pair-button")) return;

    // The sidebar changes shape between Foundry versions, so try the
    // places a button can live, from the best to the last resort. The
    // menu in Configure Settings works whatever happens here.
    const target =
      root.querySelector(".header-actions") ??
      root.querySelector(".directory-header .action-buttons") ??
      root.querySelector(".action-buttons") ??
      root.querySelector(".directory-header") ??
      root.querySelector("header") ??
      root.firstElementChild;

    if (!target) {
      log.warn(
        "Cannot find a place for the pairing button in the Actors list. " +
          "Use Configure Settings, or game.modules.get('magi-live-actor-sheets').api.pair()."
      );
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "magi-pair-button";
    button.innerHTML = `<i class="fa-solid fa-mobile-screen"></i> ${game.i18n.localize("MAGI.Pairing.Button")}`;
    button.addEventListener("click", () => this.open());
    target.append(button);
    log.debug(`Pairing button added to ${target.className || target.tagName}.`);
  }

  // requestCode asks the server for a code and waits for the answer.
  #requestCode(actorId) {
    return new Promise((resolve, reject) => {
      const id = foundry.utils.randomID();
      if (!this.#bridge.send("pairing.request", { actorId }, { id })) {
        reject(new Error(game.i18n.localize("MAGI.Pairing.NotConnected")));
        return;
      }
      this.#pending.set(id, resolve);
      setTimeout(() => {
        if (!this.#pending.delete(id)) return;
        reject(new Error(game.i18n.localize("MAGI.Pairing.NoAnswer")));
      }, REQUEST_TIMEOUT_MS);
    });
  }

  async open() {
    if (!game.user.isGM) return;

    const characters = game.actors.filter((actor) => actor.type === "character");
    if (characters.length === 0) {
      ui.notifications?.warn(game.i18n.localize("MAGI.Pairing.NoCharacters"));
      return;
    }

    const options = characters
      .map((actor) => `<option value="${actor.id}">${foundry.utils.escapeHTML(actor.name)}</option>`)
      .join("");

    const Dialog = dialogClass();
    const actorId = await Dialog.prompt({
      window: { title: game.i18n.localize("MAGI.Pairing.Title") },
      content: `
        <div class="magi-pairing">
          <p>${game.i18n.localize("MAGI.Pairing.Choose")}</p>
          <select name="actorId" class="magi-pairing-select">${options}</select>
        </div>`,
      ok: {
        label: game.i18n.localize("MAGI.Pairing.Create"),
        callback: (event, button) => button.form.elements.actorId.value,
      },
      rejectClose: false,
    });

    if (!actorId) return;

    try {
      const issued = await this.#requestCode(actorId);
      this.#showCode(game.actors.get(actorId), issued);
    } catch (err) {
      log.error("The pairing request failed.", err);
      ui.notifications?.error(err.message);
    }
  }

  #showCode(actor, issued) {
    const { code, url, expiresAt } = issued ?? {};
    const target = url || code;
    const minutes = Math.max(0, Math.round((Date.parse(expiresAt) - Date.now()) / 60000));

    const Dialog = dialogClass();
    new Dialog({
      window: { title: game.i18n.format("MAGI.Pairing.CodeTitle", { name: actor?.name ?? "" }) },
      content: `
        <div class="magi-pairing-code">
          <div class="magi-qr">${toSvg(target, 220)}</div>
          <p class="magi-code">${foundry.utils.escapeHTML(String(code ?? ""))}</p>
          <p class="magi-url">${foundry.utils.escapeHTML(String(url ?? ""))}</p>
          <p class="magi-hint">${game.i18n.format("MAGI.Pairing.Expires", { minutes })}</p>
        </div>`,
      buttons: [{ action: "close", label: game.i18n.localize("MAGI.Pairing.Done"), default: true }],
    }).render({ force: true });
  }
}
