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
| Web page | `web/` | Plain HTML, CSS, ES modules. **No build step, no framework, no dependency.** |

```
Foundry v14 (GM tab)  ──WS──▶  Go relay :30001  ◀──WS──▶  phone
   module/                        server/                  web/
```

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
```

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
