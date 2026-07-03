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

## Eigenen Server erstellen (auf Render, kostenlos)

Jeder kann sich seinen eigenen Server klicken und Freunde treten dann direkt
von der GitHub-Pages-Seite aus bei — dank Render-TLS (`wss://…`) ohne
Browser-Hürden:

1. **Dieses Repo forken** (GitHub-Account nötig).
2. Auf [render.com](https://render.com): **New + → Blueprint** → den eigenen
   Fork wählen. Render liest die `render.yaml` und fragt die Einstellungen ab:
   - `WHITELIST` = `name:passwort,name2:passwort2` → nur diese Spieler dürfen
     beitreten (Namen case-insensitiv). Leer lassen = offener Server.
   - `WORLD_SEED` = Zahl oder Text (optional, sonst zufällig).
   - `SERVER_OPEN` = `true` erzwingt einen offenen Server trotz Whitelist.

   (Ohne Blueprint geht es auch manuell: New Web Service → Fork wählen →
   Root Directory `server`, Build `cargo build --release`,
   Start `./target/release/claudemc-ws`, Env-Variablen wie oben.)
3. Fertig — die Adresse (z. B. `meinserver.onrender.com`) an die Freunde
   geben. Die tragen sie unter https://mctaxidriver.github.io/ClaudeMC/ →
   **Multiplayer → Server-Adresse** ein (wird automatisch zu `wss://…`).

Hinweis Free-Tier: Der Server schläft nach ~15 min Inaktivität ein (erster
Beitritt danach dauert ~1 min) und **vergisst dabei Welt & Accounts** (alles
liegt im RAM). Mit gesetztem `WORLD_SEED` bleibt wenigstens das Terrain
identisch, nur Bauten/Inventare beginnen frisch.

## Alternativ: lokal hosten (LAN)

Der Server liefert das Spiel auch selbst aus — für LAN-Partys ohne Cloud:
[Rust installieren](https://rustup.rs), dann `cd server && cargo run
--release`. Freunde öffnen `http://<deine-ip>:8080/` im Browser; der eigene
Host ist dort automatisch der Standard-Server. Konfiguriert wird per
`server-config.json` (siehe `server-config.example.json`) oder denselben
Env-Variablen wie oben; zusätzlich: `PORT`, `CONFIG_PATH`, `CLIENT_DIR`.
Achtung: Von der HTTPS-GitHub-Pages-Seite aus sind unverschlüsselte
`ws://LAN-IP`-Server nicht erreichbar (Mixed Content) — darum immer die vom
Server ausgelieferte Seite nutzen.

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
