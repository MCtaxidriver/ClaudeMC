# ClaudeMC

Browserbasiertes Minecraft-Multiplayer-Spiel (Vanilla JS + Three.js, ohne Build-Tools) mit Rust-WebSocket-Backend.

## Struktur

| Pfad | Inhalt | Deployment |
|---|---|---|
| `/client` | Das komplette Spiel (index.html, js/, vendor/, texturepack/) | GitHub Pages: https://mctaxidriver.github.io/ClaudeMC/ |
| `/server` | Rust-WebSocket-Server (tokio + tokio-tungstenite) | Render.com: wss://claudemc.onrender.com |

## Deployment

- **Frontend:** Der Workflow `.github/workflows/pages.yml` deployt bei jedem Push auf `main` den Inhalt von `/client` nach GitHub Pages. Voraussetzung: In den Repo-Einstellungen unter *Settings → Pages → Source* muss **GitHub Actions** gewählt sein.
- **Backend:** Render baut den Rust-Service aus `/server` (Root Directory in Render auf `server` setzen). Der Server liest den Port aus `std::env::var("PORT")`.

## Multiplayer-Protokoll (JSON über WebSocket)

Der Server ist ein autoritativer Hub: Er hält Seed, Weltzeit und das Block-Edit-Journal
(identisches Format wie `World.serializeEdits()` im Client). Terrain wird nie übertragen —
Clients generieren es deterministisch aus dem Seed.

**Client → Server**

| Nachricht | Bedeutung |
|---|---|
| `{"t":"join","name":"…"}` | Beitritt; Antwort ist `welcome` |
| `{"t":"pos","d":"over","x":…,"y":…,"z":…,"yw":…,"pt":…}` | Position/Blick, max. 10 Hz |
| `{"t":"set","d":…,"x":…,"y":…,"z":…,"id":…}` | Blockänderung |
| `{"t":"ping","ts":…}` | Keepalive/Latenz |

**Server → Client**

| Nachricht | Bedeutung |
|---|---|
| `welcome` | `pid`, `seed`, `time`, Spielerliste, komplettes Edit-Journal |
| `snap` | Positions-Snapshot aller Spieler, 10 Hz |
| `set` | Blockänderung eines Mitspielers (`by` = pid) |
| `pjoin` / `pleave` | Spieler kommt/geht |
| `time` | Weltzeit-Sync (~alle 10 s) |
| `pong` | Antwort auf `ping` |

Der Welt-Seed kann per Env-Var `WORLD_SEED` fixiert werden (Zahl oder Text);
ohne sie würfelt der Server beim Start. Das Journal lebt im RAM — ein
Server-Neustart beginnt eine frische Welt.

## Tests

- Server: `cd server && cargo test` (Integrationstest mit zwei WS-Clients)
- Client: `client/js/net.js` ist transport-only; die MP-Integration in `main.js`
  ist vollständig hinter `game.mp`/`net.active`-Guards — der Singleplayer bleibt unverändert.
  Test-Override der Server-URL: `?server=ws://localhost:8080`

## Lokal entwickeln

- Client: `cd client && python3 -m http.server 8000` → http://localhost:8000
- Server: `cd server && cargo run` (lauscht auf Port 8080, überschreibbar via `PORT`)
