# Protocol

This document is the contract between the three parts of the system: the Foundry
module, the Go relay server, and the mobile web page. Do not change one part
without a change to this document.

All text uses ASD-STE100 Simplified Technical English.

## 1. Transport

There are two WebSocket endpoints and two HTTP endpoints.

| Endpoint | Who connects | Purpose |
|---|---|---|
| `GET /ws/bridge` | The Foundry module, in the GM tab | One bridge for each world |
| `GET /ws/client` | The mobile web page | One connection for each open sheet |
| `POST /api/pair` | The mobile web page | Redeem a pairing code for a token |
| `GET /healthz` | Any monitor | Returns `200 OK` |

The server sends the web page from `/`.

## 2. Envelope

Every message is one JSON object with this shape:

```jsonc
{
  "v": 1,                    // Protocol version. Always 1.
  "type": "actor.snapshot",  // The message type. See below.
  "id": "5f3c…",             // Optional. Present when a reply is necessary.
  "actorId": "abc123",       // Optional. The actor that the message is about.
  "payload": { }             // The message data. The type controls the shape.
}
```

A reply uses the same `id` as the request. The server discards a message with an
unknown `type`. The server closes the connection if `v` is not 1.

## 3. Bridge messages

### 3.1 Bridge to server

| Type | Payload | Purpose |
|---|---|---|
| `bridge.hello` | `{ secret, worldId, worldTitle, systemId, systemVersion, foundryVersion, moduleVersion }` | The first message. The server closes the connection if the secret is wrong. |
| `actor.list` | `{ actors: [ { id, name, img } ] }` | The characters that the bridge can serve. |
| `actor.snapshot` | A `SheetDTO`. See section 6. | The full state of one actor. |
| `command.result` | `{ ok, error?, detail? }` with the `id` of the command | The result of one command. |
| `pairing.request` | `{ actorId }` with an `id` | Ask the server for a pairing code. |

### 3.2 Server to bridge

| Type | Payload | Purpose |
|---|---|---|
| `bridge.ready` | `{ subscriptions: [ actorId ] }` | The answer to `bridge.hello`. |
| `subscriptions.set` | `{ actorIds: [ … ] }` | The actors that have a live viewer now. |
| `actor.request` | `{ }` with `actorId` | Send a new snapshot for this actor. |
| `command.patch` | See section 5.1 | Change actor or item data. |
| `command.roll` | See section 5.2 | Make a roll. |
| `command.use` | See section 5.3 | Use an item or cast a spell. |
| `command.chat` | See section 5.4 | Send a chat message. |
| `pairing.issued` | `{ code, url, expiresAt }` with the request `id` | The answer to `pairing.request`. |

The bridge sends a `command.result` for every `command.*` message.

## 4. Client messages

The client connects with one of two query parameters:

- `?token=<token>` — a paired device. The token names the actor.
- `?actorId=<id>` — a device on the LAN. Section 7 gives the rules.

### 4.1 Server to client

| Type | Payload | Purpose |
|---|---|---|
| `actor.snapshot` | A `SheetDTO` | The full state. The server sends this on connect and after each change. |
| `bridge.state` | `{ online: true \| false }` | Tells the page if the GM tab is connected. |
| `ack` | `{ }` with the request `id` | The command was successful. |
| `error` | `{ code, message }` with the request `id` if there is one | The command failed. |

### 4.2 Client to server

| Type | Payload | Purpose |
|---|---|---|
| `actor.patch` | Same as `command.patch` | Change data. |
| `actor.roll` | Same as `command.roll` | Make a roll. |
| `actor.use` | Same as `command.use` | Use an item. |
| `actor.chat` | Same as `command.chat` | Send a chat message. |

The server checks each message, then sends the equivalent `command.*` message to
the bridge. The server uses the actor of the connection. The server ignores an
`actorId` field that the client sends.

## 5. Command payloads

### 5.1 `command.patch`

```jsonc
{ "target": "actor", "changes": { "system.attributes.hp.value": 12 } }
{ "target": "item", "itemId": "i1", "changes": { "system.quantity": 3 } }
```

The keys of `changes` are Foundry document paths. The module gives the object to
`actor.update()` or to `item.update()`. Section 8 gives the permitted paths.

### 5.2 `command.roll`

```jsonc
{ "kind": "skill",      "key": "ath" }
{ "kind": "ability",    "key": "str" }
{ "kind": "save",       "key": "dex" }
{ "kind": "tool",       "key": "thief" }
{ "kind": "death" }
{ "kind": "initiative" }
{ "kind": "hitDie",     "key": "d10" }
{ "kind": "attack",     "itemId": "i1" }
{ "kind": "damage",     "itemId": "i1" }
```

An optional `advantage` field accepts `"advantage"`, `"disadvantage"`, or
`"normal"`. The default is `"normal"`.

### 5.3 `command.use`

```jsonc
{ "itemId": "i1" }
```

For a spell, an optional `level` field sets the slot level.

### 5.4 `command.chat`

```jsonc
{ "text": "I look behind the door.", "emote": false }
```

The module speaks as the actor. The text is plain text. The module escapes it.

## 6. `SheetDTO`

The shape does not contain data that is specific to one game system. A second
game system needs a new adapter, not a new web page.

```jsonc
{
  "id": "abc123",
  "name": "Aelar",
  "img": "path/to/portrait.webp",
  "system": "dnd5e",
  "rev": 42,

  "header": {
    "level": 5, "classes": "Ranger 5", "race": "Elf", "background": "Outlander",
    "ac": 16, "initiative": 3, "speed": "30 ft", "prof": 3,
    "inspiration": false, "exhaustion": 0
  },
  "hp": { "value": 38, "max": 44, "temp": 0, "tempmax": 0 },
  "deathSaves": { "success": 0, "failure": 0 },

  "abilities": [
    { "key": "str", "label": "Strength", "value": 12, "mod": 1, "save": 1, "proficient": false }
  ],
  "skills": [
    { "key": "ath", "label": "Athletics", "ability": "str", "mod": 1, "proficiency": 0, "passive": 11 }
  ],
  "tools": [ { "key": "thief", "label": "Thieves' Tools", "mod": 5 } ],

  "resources": [ { "key": "primary", "label": "Rage", "value": 2, "max": 3 } ],
  "currency": { "pp": 0, "gp": 25, "ep": 0, "sp": 4, "cp": 0 },

  "attacks": [
    { "itemId": "i1", "name": "Longbow", "img": "…", "toHit": "+7",
      "damage": "1d8+4 piercing", "uses": null }
  ],
  "inventory": [
    { "itemId": "i2", "name": "Rope", "img": "…", "type": "loot", "qty": 1,
      "weight": 10, "equipped": false, "uses": null }
  ],
  "spells": {
    "slots": [ { "level": 1, "value": 3, "max": 4 } ],
    "list": [
      { "itemId": "i3", "name": "Hunter's Mark", "level": 1, "school": "div",
        "prepared": true, "uses": null }
    ]
  },
  "features": [ { "itemId": "i4", "name": "Second Wind", "uses": { "value": 1, "max": 1 } } ],
  "conditions": [ { "key": "prone", "label": "Prone", "img": "…" } ],
  "notes": { "biography": "<p>…</p>", "trait": "", "ideal": "", "bond": "", "flaw": "" }
}
```

A `uses` value is `null` or `{ "value": 1, "max": 3 }`.

`rev` is a counter. The module increases it for each snapshot of that actor. The
server discards a snapshot with a `rev` that is not larger than the last one.

## 7. Authorization

The server permits a connection to `/ws/client` in two conditions.

**On the LAN.** The setting `MAGI_TRUST_LAN` is on, and the peer address is
loopback or an RFC1918 address. The client then sends only `actorId`. The server
reads `X-Forwarded-For` only if `MAGI_TRUSTED_PROXIES` contains the peer address.

**With a token.** The client sends a token. The server holds the token in memory
with one actor ID and an expiry time.

To get a token, the device redeems a pairing code:

1. The GM opens the pairing dialog in Foundry and selects an actor.
2. The module sends `pairing.request`.
3. The server makes a 6-digit code. The code is valid for 3 minutes and for one
   use.
4. The server answers `pairing.issued`. The `url` field ends with `?c=<code>`,
   and the page reads that same name. The module shows the code and a QR
   image of the URL.

   The `url` starts with `MAGI_PUBLIC_URL` when that setting has a value.
   A proxy that serves the relay under a path removes the path before the
   request arrives, so the server cannot find it again. Without that
   setting the server uses the scheme and the host of the bridge request.
5. The device sends `POST /api/pair` with `{ "code": "123456" }`.
6. The server answers `{ "token": "…", "actorId": "…", "expiresAt": … }`.

The page keeps the token in `localStorage`.

**Same origin, for the page only.** The server sends no CORS headers. On
`/ws/client` the server compares the WebSocket `Origin` header with the request
`Host`, and it refuses a different origin. The server sends the page itself, so
the two always agree, and a page on another domain cannot use the server.

`/ws/bridge` has no such test, and it must not have one. The bridge is the Game
Master tab of Foundry. That page comes from the Foundry address and opens the
socket on the relay address, so the two are different by nature. The shared
secret guards that endpoint instead.

## 8. Write allowlist

The module writes with GM permission. Therefore the server and the module both
compare each key of `changes` with this list. The server refuses the full
message if one key is not in the list.

**Target `actor`:**

```
system.attributes.hp.value
system.attributes.hp.max
system.attributes.hp.temp
system.attributes.hp.tempmax
system.attributes.death.success
system.attributes.death.failure
system.attributes.inspiration
system.spells.spell1.value … system.spells.spell9.value
system.spells.pact.value
system.currency.pp | gp | ep | sp | cp
system.resources.primary.value
system.resources.secondary.value
system.resources.tertiary.value
system.details.biography.value
system.details.trait
system.details.ideal
system.details.bond
system.details.flaw
```

**Target `item`:**

```
system.quantity
system.equipped
system.preparation.prepared
system.uses.spent
```

A path such as `ownership`, `system.attributes.ac.value`, or `flags` is not in
the list. The server refuses it.

### Fields that the system calculates

Some fields look writable but are not. The dnd5e system calculates them again
every time it prepares the actor, so a write to them has no effect. They are
not on the list, and a page must show them as read-only.

| Field | Why |
|---|---|
| `system.attributes.exhaustion` | `prepareExhaustionLevel()` reads the level from the exhaustion condition and replaces the stored value. |
| `system.uses.value` | `UsesField` calculates it as `max - spent`. Write `system.uses.spent` instead. |
| `system.attributes.ac.value`, `system.skills.*.total`, `system.abilities.*.mod` | The system calculates these from the items, the effects, and the ability scores. |

## 9. Flow control

The server tells the bridge which actors have a live viewer with
`subscriptions.set`. The module builds a snapshot only for those actors. The
module groups snapshots with a debounce of 120 ms.

## 10. Conflicts

Foundry holds the true data. The page shows a local change immediately, but a
new snapshot replaces the local data. The page keeps the cursor in an input that
the user edits at that moment.
