# CLAUDE.md

Notes for an assistant working on this repository. `README.md` is for the
person who installs the project; this file is for the person who changes it.

## What this is

A live D&D 5e character sheet for a phone, in step with Foundry VTT in both
directions. Three parts, in three directories:

| Part | Where | What it is |
|---|---|---|
| Foundry module | `module/` | Plain ESM. Runs in the **Game Master browser tab**. The only part that talks to Foundry. |
| Relay server | `server/` | One Go binary. Moves messages, serves the page. No database. |
| Web page (old) | `web/` | Plain HTML, CSS, ES modules. No build step. **This is still the page the image ships.** |
| Web page (new) | `app/` | Vue 3, Vite, TypeScript, Pinia, Tailwind, shadcn-vue. A working frame, not yet equal to `web/`. |

```
Foundry v14 (GM tab)  ──WS──▶  Go relay :30001  ◀──WS──▶  phone
   module/                        server/               web/ → app/
```

**Two pages exist at the same time, on purpose.** `app/` is the replacement and
it is built with Vite; `web/` is what a player still gets. The one line that
moves the image from one to the other is marked in the `Dockerfile`. Do not
make that change until `app/` draws everything `web/` draws.

Targets **Foundry v14** and **dnd5e 5.x**. Foundry holds the true data; the
server keeps only an in-memory snapshot cache.

**The module is browser code.** A headless Foundry server does not run it. A GM
browser tab must be open for the bridge to exist. This is inherent, not a bug.

## The contract

`docs/protocol.md` is the source of truth for every message, the `SheetDTO`
shape, the authorization rules, and the write allowlist. Three components in
two languages agree through it. **Change it in the same commit as the code.**

## Hard-won facts — read before touching these areas

Each of these was a real bug that reached a running system. Do not undo them.

### The bridge is cross-origin by nature

`/ws/bridge` has **no same-origin check, and must not have one.** The bridge is
the Foundry tab: that page comes from the Foundry domain and opens a socket on
the relay domain, so `Origin` never equals `Host`. An earlier check refused
every real bridge with 403, which a browser reports only as close code **1006**
with no reason.

The **shared secret** guards that endpoint. `/ws/client` keeps the check, where
it is correct: the relay serves that page itself.

### dnd5e fields the system calculates

These look writable and are not. A write to them silently does nothing:

| Field | Why | Use instead |
|---|---|---|
| `system.attributes.exhaustion` | `prepareExhaustionLevel()` overwrites it from the exhaustion condition | read-only |
| `system.uses.value` | `UsesField` computes `max - spent` | `system.uses.spent` |
| `system.attributes.ac.value`, `system.skills.*.total`, `system.abilities.*.mod` | derived from items, effects, scores | read-only |

Before adding any writable field, check the dnd5e source. It is public:
`git clone --depth 1 https://github.com/foundryvtt/dnd5e`. `raw.githubusercontent.com`
is reachable; `foundryvtt.com` and `foundryvtt.wiki` are blocked by the egress
proxy. The core Foundry repo (`foundryvtt/foundryvtt`) is an issue tracker with
no source, so **dnd5e's own usage is the best evidence for a v14 API**.

### The write allowlist exists twice, on purpose

`server/internal/authz/authz.go` and `module/scripts/authz.mjs` must hold the
same paths. The module writes with **GM permission**, so the module-side check
is the last line of defence if the server has a fault. Change both, or a phone
gains or loses a field silently.

### Pact magic has its own track

A warlock can hold a pact slot at the same level as a normal slot. The page
keeps each slot's kind and routes through `slotPath()` in `web/js/paths.js`.
Never look a slot up by level alone.

### The new page uses a hash route, and must keep using one

`app/` sets `base: './'` and `createWebHashHistory`. The two go together and
neither works alone.

The relay answers **any** path it does not know with `index.html`, at status 200
with `Content-Type: text/html`, and it sends `nosniff`. So with a path route,
a browser at `/magi/sheet/abc/spells` asks for `./assets/index-<hash>.js`,
which resolves to `/magi/sheet/abc/assets/…`, which the relay answers with the
page. The browser then refuses the module because the type is wrong, and the
screen is blank with **no JavaScript running to explain it**.

Finding the root at run time does not save this: the browser resolves the
`<script src>` of `index.html` before one byte of the page runs. It is circular.

A hash keeps the path of the document at the root of the application, so every
relative address stays correct. Nothing is lost, because every entry point of
this product is already the root plus a query: `?c=`, `?actorId=`, `?fixture=1`.

Two details that were both real faults:

- **`createWebHashHistory()` must be given a base.** Its default is
  `location.pathname + location.search`, so a person who arrives at
  `/magi/?c=123456` keeps the pairing code in every address after it, long
  after the code is used. `appPathname()` in `app/src/core/transport/base.ts`
  is the value to pass.
- **Every JS chunk must stay flat in `assets/`.** `base.ts` finds the root with
  `new URL('../', import.meta.url)`. A nested chunk makes the root wrong, and
  every address in the page with it. `npm run check-dist` tests this.

### A missing asset must be a 404, not the page

`serveWeb` now answers a request under `assets/` that names no real file with a
plain **404**. This is not tidiness. A browser that kept an old `index.html`
asks for a file that a new release removed; the fallback would answer with HTML,
`nosniff` would make the browser refuse it, and the person would get a blank
screen that only a hard reload clears. A 404 is the honest answer and it is
visible in the network panel.

The cache headers exist for the same reason. A file under `assets/` carries a
hash of its content in its name and gets a year with `immutable`; `index.html`
and the fallback get `no-cache`, because the page names the current asset files.
Caching `index.html` is what creates the failure above.

### The write loop came back a different way

The old page produced 600+ writes from one tap: a snapshot redrew the tab with
`innerHTML`, which destroyed the focused input, which fired `blur`, which wrote
the same value, which made a new snapshot.

Vue patches in place, so with a stable key the input survives and the first
trigger is gone. **The focus and caret restoration in `web/app.js` is therefore
dead code and was not carried over.** But the loop returns through a `v-for`
without `:key`, a `v-model` bound straight at the store, or an unconditional
`@blur`. `app/src/composables/useServerBackedField.ts` closes all three, and
every input of the sheet goes through it. Two rules there:

- A commit compares against the **live server value**, not the value the input
  was drawn with. That is stronger than the old check: it holds no matter who
  fired the blur, the unmount included.
- **Never commit from `onBeforeUnmount`.** That was the exact trigger.

Proved end to end against the fake bridge: 8 snapshots arriving while a person
typed produced 4 writes, one for each deliberate commit.

### The page must not use absolute paths

A proxy can serve the page under a path such as `/magi/`. Every address goes
through `web/js/base.js`, which finds the application root from its own module
address (`import.meta.url`). **The page's own URL is not a safe base**: the
server answers an unknown path with the same page, so a deep link would give
the wrong prefix. The server side of this is `MAGI_PUBLIC_URL`.

### Verified dnd5e 5.x roll API

Every roll method takes three objects: `roll*(config, dialog, message)`.

```js
actor.rollSkill({ skill: "ath" }, { configure: false }, {})
actor.rollAbilityCheck({ ability: "str" }, …)
actor.rollSavingThrow({ ability: "dex" }, …)
actor.rollDeathSave({}, …)
item.use({}, { configure: false }, {})
```

`rollAttack` exists **only** on an attack activity. `rollDamage` comes from the
activity mixin, so attack, save, and heal activities all have it. Reach them
with `item.system.activities.getByType("attack")[0]` and `.find(…)`;
`item.system.hasAttack` is the getter for "does this item attack".

Rolls pass `{ configure: false }` so a tap on a phone never opens a window on
the GM screen.

### Foundry v14 details that were checked against dnd5e's source

- `foundry.applications.api.DialogV2` is the live name (`Dialog` is the v14
  alias; the code accepts both).
- `renderActorDirectory` hands over an `HTMLElement`, not jQuery.
- `game.settings.registerMenu` is the reliable way to add a UI entry point. A
  sidebar DOM selector is not: the earlier one matched nothing on v14.

### Never fail silently

Two bugs cost a whole debugging round trip each because the code returned
without a word: the pairing button when no selector matched, and the server
when it refused a handshake. A browser turns a 403 or 401 during a WebSocket
handshake into **code 1006 with no reason**, so the server log is the only
place that can explain it. Log every refusal and every give-up.

### Other things that are load-bearing

- The adapter sends **absolute** image URLs. The phone loads the page from the
  relay, so a Foundry-relative path would ask the relay for a file it lacks.
- WebSocket read limits are raised above the 32 KiB library default: a real
  character snapshot is larger.
- A 25 s ping keeps a reverse proxy from closing an idle socket at 60 s.
- Each connection has one writer goroutine and a bounded queue, so a slow phone
  cannot block the hub.
- Snapshots carry a `rev` counter; the server drops out-of-order ones.
- The page applies an edit optimistically, then the next snapshot replaces
  local state. It preserves focus and caret in an input being edited — an
  earlier version re-rendered on every snapshot and produced **600+ writes**
  from one tap.

## Running it without Foundry

`scripts/dev/fake-bridge.mjs` speaks the bridge half of the protocol and serves
one example character, so the whole system runs with no Foundry:

```bash
cd server && go build -o /tmp/magi-server ./cmd/magi-server && cd ..
MAGI_BRIDGE_SECRET=dev-secret /tmp/magi-server -web ./web &
MAGI_BRIDGE_SECRET=dev-secret node scripts/dev/fake-bridge.mjs &
# then open http://127.0.0.1:30001/?actorId=fixture-aelar
```

`http://127.0.0.1:30001/?fixture=1` renders the page from
`web/js/fixture.js` with no server at all — useful for layout work.

Chromium for browser checks is at `/opt/pw-browsers/chromium`; Playwright is at
`/opt/node22/lib/node_modules/playwright` (CommonJS, so
`import pkg from '…/playwright/index.js'`).

## Checks before a push

```bash
cd server && gofmt -l . && go vet ./... && go test ./... && cd ..
find module/scripts web scripts -name '*.mjs' -o -name '*.js' | xargs -n1 node --check
cd app && npm run typecheck && npm test -- --run && npm run build && npm run check-dist && cd ..
```

`npm run check-dist` tests three rules that no build error catches, and each one
shows up in production only as a blank page with no reason: an inline script or
style, which the relay policy refuses; an address that is not relative, which
breaks the page under a path such as `https://host/magi/`; and a JS chunk that
is not flat under `assets/`, which breaks the way the page finds its own root.

`app/scripts/smoke.mjs` drives the built page in Chromium against the **real Go
binary**, and fails on any policy violation. It is the only place the production
Content-Security-Policy is ever exercised, because the Vite development server
sends no policy at all.

Tests exist only where they protect something: the write allowlist, pairing
expiry and one-time use, origin and LAN admission, and the pairing URL. **Do
not add tests for their own sake** — the owner asked for clean readable code
over bulk.

## Conventions

- **Simplified Technical English (ASD-STE100)** in every document, comment, log
  line, and commit message. Short sentences, active voice, plain words.
- Small commits, conventional prefixes (`feat:`, `fix:`, `ci:`, `docs:`).
- Work on `claude/foundry-mobile-sheet-sync-56e5ol`, open a PR to `main`.
- **The owner squash-merges.** After a merge, restart the branch from
  `origin/main` rather than stacking. Before any force-push, check whether the
  remote branch holds commits that are not in `main` — it has twice held the
  owner's own edits.
- Do not put a model name in anything pushed to the repository.

## Releases and deployment

**Every merge into `main` makes a release.** `.github/workflows/release.yml`
picks the size of the version step from the merged branch name:

| Branch prefix | Step |
|---|---|
| `major/`, `breaking/` | 2.0.0 |
| `minor/`, `feat/`, `feature/` | 1.5.0 |
| anything else | patch |

A merge message can say `[major]`, `[minor]`, `[patch]`, or `[skip release]`.
The newest `v*` tag is the current version, and **the workflow writes the
version into the manifest as it builds** — do not hand-edit the version in
`module/module.json`, it is not authoritative.

The release publishes `module.json` and `module.zip`, with `module.json` at the
**root** of the zip. Upload assets by their real path: in `gh release create`,
a name after a `#` is only a **label**, which once left the manifest published
as `manifest.json` and made the install URL 404.

`docker.yml` runs on a pull request on its own, and the release workflow calls
it on a merge so the image gets the version numbers.

Install URL for Foundry:
`https://github.com/MagdielCAS/magi-live-actor-sheets/releases/latest/download/module.json`

### Container and Coolify

Image: `ghcr.io/magdielcas/magi-live-actor-sheets`. Deployed at
`https://fichas.magdiel.dev`.

| Setting | Value | Why |
|---|---|---|
| `MAGI_BIND` | `0.0.0.0:30001` (in the image) | the binary defaults to loopback, unreachable in a container |
| `MAGI_TRUST_LAN` | `false` (in the image) | **behind a proxy every request comes from the Docker network, which is private. With LAN trust on, any visitor from the internet would look local and could open any sheet.** |
| `MAGI_BRIDGE_SECRET` | required | without it the server makes a new secret at each start, and the module stops matching after a redeploy |
| `MAGI_PUBLIC_URL` | only under a path | a proxy removes the path before the request arrives |

A GHCR package is **private** when a workflow first creates it. Coolify cannot
pull it until it is made public or given a `read:packages` token.

## Not verified

- No Foundry instance exists in this environment, so no change to `module/` has
  ever been executed. It is checked by reading the dnd5e source and by parsing
  the files. The owner is the only one who can confirm real behaviour.
- The sheet has not been confirmed to sync end to end against a real world.
- The pairing button in the Actors sidebar may still land nowhere on v14. The
  entry point in **Configure Settings** is the reliable one, and
  `game.modules.get("magi-live-actor-sheets").api.pair()` always works.
