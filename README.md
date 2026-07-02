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

## Lokal entwickeln

- Client: `cd client && python3 -m http.server 8000` → http://localhost:8000
- Server: `cd server && cargo run` (lauscht auf Port 8080, überschreibbar via `PORT`)
