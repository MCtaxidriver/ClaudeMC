# ClaudeMC

Browserbasiertes Minecraft-Multiplayer-Spiel (Vanilla JS + Three.js, ohne Build-Tools) mit Rust-WebSocket-Backend.

## Struktur

| Pfad | Inhalt | Deployment |
|---|---|---|
| `/client` | Das komplette Spiel (index.html, js/, vendor/, texturepack/) | GitHub Pages: https://mctaxidriver.github.io/ClaudeMC/ |
| `/server` | Rust-WebSocket-Server (tokio + tokio-tungstenite) | Render.com: wss://claudemc.onrender.com |

## Deployment

- **Frontend:** Der Workflow `.github/workflows/pages.yml` deployt bei jedem Push auf `main` den Inhalt von `/client` nach GitHub Pages. Voraussetzung: In den Repo-Einstellungen unter *Settings → Pages → Source* muss **GitHub Actions** gewählt sein.
- **Backend:** Render baut den Rust-Service aus `/server` (Root Directory in Render auf `server` setzen). Der Server liest den Port aus `std::env::var("PORT")`. Der Render-Server ist der **offizielle offene Server** (ohne `server-config.json` darf jeder beitreten).

## Eigenen Server hosten (wie bei Minecraft)

Der Server ist ein einzelnes Binary, das **das Spiel gleich mitliefert**: Er
serviert den `/client`-Ordner per HTTP und ist auf demselben Port der
WebSocket-Hub. Deine Freunde brauchen nichts zu installieren — sie öffnen
einfach deine Adresse im Browser.

1. Repo klonen, [Rust installieren](https://rustup.rs), dann:
   ```
   cd server
   cargo run --release
   ```
2. Optional konfigurieren: `server-config.example.json` nach
   `server-config.json` kopieren und anpassen:
   ```json
   {
     "open": false,
     "seed": "meine-welt-2026",
     "whitelist": { "fionn": "geheimes-passwort", "freund1": "anderes-passwort" }
   }
   ```
   - `open: true` (oder keine Config-Datei) = jeder darf beitreten; der erste
     Beitritt mit einem Namen legt dessen Passwort fest.
   - `open: false` = nur Spieler aus der `whitelist` (Namen case-insensitiv),
     das Passwort pro Spieler steht in der Config.
   - `seed`: Zahl oder Text; fehlt er, würfelt der Server beim Start.
3. Freunde beitreten lassen: `http://<deine-ip>:8080/` im Browser öffnen —
   fertig. Im LAN reicht die lokale IP; übers Internet musst du den Port in
   deinem Router freigeben (Port-Forwarding), wie bei einem Minecraft-Server.

Env-Variablen: `PORT` (Standard 8080), `CONFIG_PATH` (Standard
`server-config.json`), `CLIENT_DIR` (Standard: `./client` bzw. `../client`),
`WORLD_SEED` (Fallback, wenn die Config keinen Seed setzt).

**Server-Adresse im Spiel:** Das Multiplayer-Menü hat ein Server-Feld
(leer = Standard). Eingaben wie `192.168.1.5:8080` werden zu `ws://…`,
Domains zu `wss://…`. Wichtig: Von der GitHub-Pages-Seite (HTTPS) aus
blockieren Browser unverschlüsselte `ws://`-Verbindungen zu fremden IPs
(Mixed Content) — nutzt für selbst gehostete Server deshalb direkt die vom
Server ausgelieferte Seite (`http://<ip>:port/`); dort ist der eigene Host
automatisch der Standard-Server.

## Multiplayer-Protokoll (JSON über WebSocket)

Der Server ist ein autoritativer Hub: Er hält Seed, Weltzeit und das Block-Edit-Journal
(identisches Format wie `World.serializeEdits()` im Client). Terrain wird nie übertragen —
Clients generieren es deterministisch aus dem Seed.

**Client → Server**

| Nachricht | Bedeutung |
|---|---|
| `{"t":"join","name":"…","pass":"…"}` | Beitritt; erster Join legt den Account an, danach schützt das Passwort den Namen (case-insensitiv). Antwort: `welcome` oder `deny` |
| `{"t":"pos","d":"over","x":…,"y":…,"z":…,"yw":…,"pt":…}` | Position/Blick, max. 10 Hz |
| `{"t":"set","d":…,"x":…,"y":…,"z":…,"id":…}` | Blockänderung |
| `{"t":"chat","msg":"…"}` | Chat-Nachricht (max. 200 Zeichen) |
| `{"t":"state","data":{…}}` | Spielerzustand (Inventar, Position, HP …) für den Account speichern; der Client sendet alle 10 s sowie beim Verlassen |
| `{"t":"hit","target":…,"dmg":…,"kx":…,"kz":…,"r":…}` | PvP-Treffer melden; Server prüft Dimension + Reichweite (Nahkampf 8, Pfeil `r` 80 Blöcke), deckelt `dmg` auf 12 und relayt nur ans Ziel |
| `{"t":"died","by":…}` | Vom Opfer gemeldeter Tod → Server broadcastet die Todesmeldung |
| `{"t":"ping","ts":…}` | Keepalive/Latenz |

**Server → Client**

| Nachricht | Bedeutung |
|---|---|
| `welcome` | `pid`, `seed`, `time`, Spielerliste, komplettes Edit-Journal, gespeicherter Account-`state` (oder `null`) |
| `deny` | Beitritt abgelehnt (falsches Passwort / Name gerade online) |
| `snap` | Positions-Snapshot aller Spieler, 10 Hz |
| `set` | Blockänderung eines Mitspielers (`by` = pid) |
| `chat` | Chat-Broadcast (`pid`, `name`, `msg`) an alle inkl. Absender |
| `hit` | Eingehender PvP-Treffer (`from`, `dmg`, `kx`, `kz`); das Ziel wendet den Schaden inkl. eigener Rüstungsberechnung an |
| `sys` | System-Chatzeile (z. B. „⚔ A wurde von B besiegt") |
| `pjoin` / `pleave` | Spieler kommt/geht |
| `time` | Weltzeit-Sync (~alle 10 s) |
| `pong` | Antwort auf `ping` |

Im Spiel öffnet **T** den Chat (Enter sendet, Esc schliesst). Accounts und
Zustand liegen wie das Journal im RAM des Servers.

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
