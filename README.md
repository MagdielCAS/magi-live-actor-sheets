# Magi Live Actor Sheets

Show a live D&D 5e character sheet on a phone or a tablet. The sheet stays in
step with Foundry VTT in both directions. A change in Foundry appears on the
phone. A change on the phone appears in Foundry.

Foundry VTT is heavy for a mobile device. This project gives the player a light
page that holds only the character sheet.

- Foundry VTT **v14**
- D&D 5e system **5.x**

---

## How it works

```
┌──────────────────────────┐         ┌─────────────────────┐        ┌──────────────┐
│  Foundry v14 (GM tab)    │  WS     │  Go relay server    │  WS    │  Phone or    │
│  magi-live-actor-sheets  │────────▶│  :30001             │◀──────▶│  tablet      │
│  reads and writes actors │◀────────│  moves messages     │  HTTP  │  web page    │
└──────────────────────────┘         └─────────────────────┘        └──────────────┘
```

There are three parts.

1. **The module** runs in the Game Master's Foundry tab. It watches the actors,
   it sends a snapshot when data changes, and it applies the changes that come
   from a phone. It is the only part that speaks to Foundry.
2. **The relay server** is one Go binary. It moves messages between the module
   and the phones. It also sends the web page. It keeps no database.
3. **The web page** is plain HTML, CSS, and JavaScript. There is no build step.

Foundry holds the true data. The server keeps only a copy in memory.

**The Game Master's Foundry tab must be open.** The module is browser code, so
the bridge exists only while that tab runs. This is the same method that other
Foundry bridge modules use.

---

## Install

### 1. Start the relay server

You need Go 1.24 or later.

```bash
git clone https://github.com/MagdielCAS/magi-live-actor-sheets.git
cd magi-live-actor-sheets/server
go build -o magi-server ./cmd/magi-server
```

Run it next to Foundry:

```bash
MAGI_BRIDGE_SECRET="choose-a-long-secret" \
  ./magi-server -web ../web
```

The server listens on `127.0.0.1:30001`. To let the phones on your network
reach it, listen on every address:

```bash
MAGI_BIND=0.0.0.0:30001 \
MAGI_BRIDGE_SECRET="choose-a-long-secret" \
  ./magi-server -web ../web
```

If you do not set `MAGI_BRIDGE_SECRET`, the server makes a secret for that run
and prints it. Copy it into the module settings, or the module cannot connect.

### 2. Install the module in Foundry

Copy or link the `module` directory into your Foundry data directory:

```bash
ln -s "$PWD/module" "$HOME/.local/share/FoundryVTT/Data/modules/magi-live-actor-sheets"
```

Then start Foundry, open your world, and turn the module on in
**Game Settings → Manage Modules**.

### 3. Configure the module

Open **Game Settings → Configure Settings → Magi Live Actor Sheets**.

| Setting | Value |
|---|---|
| Server URL | `http://127.0.0.1:30001`, or the address your players use |
| Bridge secret | The same text as `MAGI_BRIDGE_SECRET` |
| Enable the bridge | On |

Only a Game Master can see and change these settings.

### 4. Open the sheet on a phone

**On the same network**, open the server address in the phone browser and add
the actor id:

```
http://192.168.1.10:30001/?actorId=<the actor id>
```

**From outside the network**, or to make a permanent link, pair the device.
In Foundry, open the pairing dialog, select the character, and show the QR code
to the player. The player scans it, or types the 6-digit code in the page. The
code is valid for 3 minutes and for one use. The page then remembers the
device.

---

## What the sheet shows

| Tab | Contents |
|---|---|
| Main | Portrait, hit points, damage and heal, armour class, initiative, speed, proficiency, inspiration, death saves, exhaustion, resources, and a chat box |
| Skills | The six abilities with checks and saves, all skills, tools, and an advantage selector |
| Combat | Attacks with the to-hit value and the damage |
| Spells | Spell slots and the spell list, with a prepared switch and a cast button |
| Items | The inventory with quantity, an equipped switch, uses, and the money |
| Notes | The biography, and the trait, ideal, bond, and flaw fields |

A tap on a skill, an ability, a save, or an attack makes the real roll in
Foundry and puts the result in the Foundry chat.

The page can change only the fields that a player changes during play. It
cannot change the class, the level, or the abilities of the character. Use
Foundry for that.

---

## Security

The rule is simple. On your own network the system is open. On the web it must
use the same domain as Foundry.

**On your own network.** A phone on the same network connects with only the
actor id. There is no password. Set `MAGI_TRUST_LAN=false` to stop this.

**On the web.** Put the relay behind the same domain or a sub-domain as your
Foundry server, with your reverse proxy. The server sends no CORS headers, and
it compares the WebSocket `Origin` header with the request `Host`. A page on
another domain therefore cannot use the server. A phone that is not on your
network must pair with a code.

**Writes are limited.** The module writes with Game Master permission.
Therefore the server and the module both compare each write with a list of
permitted fields. The list holds only what a player changes in play: hit
points, death saves, resources, money, spell slots, item quantity, item uses,
the equipped state, the prepared state, and the notes. Every other field is
refused. A phone cannot change the rest of your world.

### Example for nginx

Put the relay on the same domain as Foundry, under `/magi`:

```nginx
location /magi/ {
    proxy_pass         http://127.0.0.1:30001/;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade    $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host       $host;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
}
```

If the proxy is on a different machine than the relay, name it in
`MAGI_TRUSTED_PROXIES`. The server reads `X-Forwarded-For` only from an address
in that list. Without this rule, a proxy could make every visitor look local.

---

## Deploy with Docker and Coolify

A workflow builds an image and sends it to the GitHub Container Registry on
every push to `main` and on every `v*` tag. The image holds the relay and the
web page, for `linux/amd64` and for `linux/arm64`.

```
ghcr.io/magdielcas/magi-live-actor-sheets:latest
```

### In Coolify

1. Add a new resource, and select **Docker Image**.
2. Use the image name above. Coolify can also read `compose.yaml` from this
   repository.
3. Set the port to **30001**.
4. Set the environment variable `MAGI_BRIDGE_SECRET` to a long secret. Put the
   same text in the Foundry module settings.
5. Give the service the same domain as your Foundry server, or a sub-domain of
   it, for example `foundry.example.com/magi` or `magi.example.com`. The server
   refuses a page from any other domain.

Coolify ends the TLS connection and sends the WebSocket to the container, so
you do not need any other setting.

### Two points that matter

**Always set `MAGI_BRIDGE_SECRET`.** Without it the server makes a new secret
at each start. After a restart the module then holds the old secret, and the
bridge cannot connect.

**Leave `MAGI_TRUST_LAN` off.** The image turns it off, and it must stay off
behind a proxy. LAN trust lets a client on a private address open a sheet with
no pairing code. Behind the Coolify proxy every request arrives from the Docker
network, and a Docker network uses private addresses. With LAN trust on, the
server would treat every visitor from the internet as a member of your network,
and any person could open any character sheet. Each device must pair with a
code instead.

If you do want LAN trust behind a proxy, you must also set
`MAGI_TRUSTED_PROXIES` to the address of that proxy. The server then reads the
real client address from `X-Forwarded-For`.

### Build the image yourself

```bash
docker build -t magi-live-actor-sheets .
docker run --rm -p 30001:30001 \
  -e MAGI_BRIDGE_SECRET="choose-a-long-secret" \
  magi-live-actor-sheets
```

---

## Settings

| Environment variable | Flag | Default | Purpose |
|---|---|---|---|
| `MAGI_BIND` | `-bind` | `127.0.0.1:30001` | The address to listen on |
| `MAGI_BRIDGE_SECRET` | `-bridge-secret` | made for each run | The secret the module must send |
| `MAGI_TRUST_LAN` | `-trust-lan` | `true` | Let a phone on the network connect with no code |
| `MAGI_TRUSTED_PROXIES` | `-trusted-proxies` | empty | The proxies that may set `X-Forwarded-For` |
| — | `-web` | `./web` | The directory that holds the web page |

A flag wins over an environment variable. An environment variable wins over the
default.

---

## Development

You can run the whole system without Foundry. A test bridge takes the place of
the module. It holds one example character.

```bash
# Terminal 1: the relay
cd server && go build -o magi-server ./cmd/magi-server
MAGI_BRIDGE_SECRET=dev-secret ./magi-server -web ../web

# Terminal 2: the test bridge
MAGI_BRIDGE_SECRET=dev-secret node scripts/dev/fake-bridge.mjs

# Then open http://127.0.0.1:30001/?actorId=fixture-aelar
```

The test bridge prints the writes and the rolls that the page sends. It also
changes the hit points every 20 seconds, so you can see that Foundry can push
data to the page.

To see only the page, with no server, open `web/index.html?fixture=1`.

Checks:

```bash
cd server && gofmt -l . && go vet ./... && go test ./...
```

`docs/protocol.md` describes every message. Read it before you change one of
the three parts.

---

## License

MIT. See [LICENSE](LICENSE).
