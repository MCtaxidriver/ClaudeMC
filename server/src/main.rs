// ClaudeMC Multiplayer-Server
//
// Ein Binary = ein kompletter Spielserver, wie bei Minecraft selbst hostbar:
//  - HTTP: liefert das Spiel (den /client-Ordner) direkt aus -> Freunde öffnen
//    einfach http://<deine-ip>:<port>/ im Browser
//  - WebSocket (gleicher Port, Upgrade auf beliebigem Pfad): der Multiplayer-Hub
//  - server-config.json: offener Server oder Whitelist mit Passwort pro Spieler
//
// Der Hub ist autoritativ für Seed, Weltzeit und das Block-Edit-Journal
// (dasselbe Format wie World.serializeEdits() im Client); Terrain generieren
// die Clients deterministisch aus dem Seed.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::SystemTime;

use axum::extract::ws::{Message as WsMessage, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::http::{header, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::Router;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, Mutex};

const CHUNK_SIZE: i32 = 16;
const WORLD_HEIGHT: i32 = 96;
const DAY_LENGTH: f64 = 480.0; // Sekunden pro Tag/Nacht-Zyklus (wie client/js/config.js)
const SNAP_INTERVAL_MS: u64 = 100; // 10 Hz Positions-Broadcast
const TIME_SYNC_EVERY: u32 = 100; // alle 100 Snap-Ticks (~10 s) Zeit synchronisieren

// ============ Server-Konfiguration ============

// server-config.json (Pfad via CONFIG_PATH übersteuerbar):
// {
//   "open": false,                       // false = nur Whitelist-Spieler
//   "seed": 1337,                        // Zahl oder Text; fehlt -> zufällig
//   "whitelist": { "fionn": "geheim" }   // Name (case-insensitiv) -> Passwort
// }
#[derive(Deserialize, Default)]
struct FileConfig {
    open: Option<bool>,
    seed: Option<serde_json::Value>,
    whitelist: Option<HashMap<String, String>>,
}

struct ServerConfig {
    open: bool,
    whitelist: HashMap<String, String>, // Schlüssel kleingeschrieben
}

fn load_config() -> (ServerConfig, Option<u32>) {
    let path = std::env::var("CONFIG_PATH").unwrap_or_else(|_| "server-config.json".into());
    let file: FileConfig = match std::fs::read_to_string(&path) {
        Ok(text) => match serde_json::from_str(&text) {
            Ok(cfg) => {
                println!("Konfiguration geladen: {path}");
                cfg
            }
            Err(e) => {
                eprintln!("WARNUNG: {path} ist kein gültiges JSON ({e}) – Server läuft offen");
                FileConfig::default()
            }
        },
        Err(_) => {
            println!("Keine {path} gefunden – Server läuft offen (jeder darf beitreten)");
            FileConfig::default()
        }
    };
    let seed = file.seed.as_ref().and_then(|v| match v {
        serde_json::Value::Number(n) => n.as_u64().map(|n| n as u32),
        serde_json::Value::String(s) => Some(
            s.parse::<u32>().unwrap_or_else(|_| hash_seed(s)),
        ),
        _ => None,
    });
    let mut whitelist: HashMap<String, String> = file
        .whitelist
        .unwrap_or_default()
        .into_iter()
        .map(|(k, v)| (k.to_lowercase(), v))
        .collect();
    let mut open = file.open.unwrap_or(true);

    // Env-Überschreibungen (für Render & Co., wo man keine Dateien pflegt):
    //   WHITELIST="fionn:pass1,anna:pass2"  -> Einträge ergänzen, Server implizit zu
    //   SERVER_OPEN=true|false              -> expliziter Modus (gewinnt immer)
    if let Ok(v) = std::env::var("WHITELIST") {
        for pair in v.split(',') {
            if let Some((n, p)) = pair.split_once(':') {
                let (n, p) = (n.trim().to_lowercase(), p.trim());
                if !n.is_empty() && !p.is_empty() {
                    whitelist.insert(n, p.to_string());
                }
            }
        }
        open = false;
    }
    if let Ok(v) = std::env::var("SERVER_OPEN") {
        open = matches!(v.to_lowercase().as_str(), "true" | "1" | "yes" | "ja");
    }

    (ServerConfig { open, whitelist }, seed)
}

fn hash_seed(s: &str) -> u32 {
    // Gleiche Text-Seed-Hash-Logik wie das Client-Menü (menu.js)
    let mut seed: u32 = 0;
    for ch in s.chars() {
        seed = seed.wrapping_mul(31).wrapping_add(ch as u32);
    }
    seed
}

// ============ Protokoll ============

#[derive(Deserialize)]
#[serde(tag = "t", rename_all = "lowercase")]
enum ClientMsg {
    Join {
        name: String,
        #[serde(default)]
        pass: String,
    },
    Pos { d: String, x: f64, y: f64, z: f64, yw: f64, pt: f64 },
    Set { d: String, x: i32, y: i32, z: i32, id: u16 },
    Chat { msg: String },
    State { data: serde_json::Value },
    // PvP: Angreifer meldet Treffer; r = Fernkampf (Pfeil, grössere Reichweite)
    Hit {
        target: u32,
        dmg: f64,
        kx: f64,
        kz: f64,
        #[serde(default)]
        r: bool,
    },
    // Vom Opfer gemeldet: Tod (by = Angreifer-pid oder eigene pid bei Umgebungstod)
    Died { by: u32 },
    Ping { ts: f64 },
}

#[derive(Serialize, Clone)]
struct PlayerInfo {
    pid: u32,
    name: String,
    d: String,
    x: f64,
    y: f64,
    z: f64,
    yw: f64,
    pt: f64,
}

#[derive(Serialize)]
#[serde(tag = "t", rename_all = "lowercase")]
enum ServerMsg<'a> {
    Welcome {
        pid: u32,
        seed: u32,
        time: f64,
        players: Vec<PlayerInfo>,
        // dim -> chunkKey -> [[idx, blockId], ...]
        edits: HashMap<String, HashMap<String, Vec<(u32, u16)>>>,
        // Zuletzt gespeicherter Spielerzustand dieses Accounts (Inventar, Position …)
        state: Option<serde_json::Value>,
    },
    PJoin { pid: u32, name: &'a str },
    PLeave { pid: u32 },
    Snap { p: Vec<(u32, &'a str, f64, f64, f64, f64, f64)> },
    Set { d: &'a str, x: i32, y: i32, z: i32, id: u16, by: u32 },
    Chat { pid: u32, name: &'a str, msg: &'a str },
    Hit { from: u32, dmg: f64, kx: f64, kz: f64 },
    Sys { msg: &'a str },
    Deny { msg: &'a str },
    Time { v: f64 },
    Pong { ts: f64 },
}

// ============ Zustand ============

struct Player {
    info: PlayerInfo,
    account: String, // Schlüssel in Hub.accounts (Name in Kleinbuchstaben)
    tx: mpsc::UnboundedSender<String>,
}

// Account: Name (case-insensitiv) + Passwort (bei Whitelist aus der Config,
// sonst beim ersten Join frei gewählt). Der Zustand (Inventar, Position, HP …)
// ist ein vom Client definiertes JSON-Blob.
struct Account {
    pass: String,
    state: Option<serde_json::Value>,
}

struct Hub {
    config: ServerConfig,
    seed: u32,
    time: f64,
    next_pid: u32,
    players: HashMap<u32, Player>,
    accounts: HashMap<String, Account>,
    // dim -> chunkKey -> localIndex -> blockId
    edits: HashMap<String, HashMap<String, HashMap<u32, u16>>>,
}

impl Hub {
    fn new(config: ServerConfig, seed: u32) -> Self {
        Hub {
            config,
            seed,
            time: 0.05, // Morgen, wie ein frischer Singleplayer-Start
            next_pid: 0,
            players: HashMap::new(),
            accounts: HashMap::new(),
            edits: HashMap::new(),
        }
    }

    fn apply_edit(&mut self, dim: &str, x: i32, y: i32, z: i32, id: u16) -> bool {
        if y < 1 || y >= WORLD_HEIGHT {
            return false;
        }
        let cx = x.div_euclid(CHUNK_SIZE);
        let cz = z.div_euclid(CHUNK_SIZE);
        let lx = x - cx * CHUNK_SIZE;
        let lz = z - cz * CHUNK_SIZE;
        let idx = ((y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx) as u32;
        let key = format!("{cx},{cz}");
        self.edits
            .entry(dim.to_string())
            .or_default()
            .entry(key)
            .or_default()
            .insert(idx, id);
        true
    }

    fn edits_snapshot(&self) -> HashMap<String, HashMap<String, Vec<(u32, u16)>>> {
        self.edits
            .iter()
            .map(|(dim, chunks)| {
                let c = chunks
                    .iter()
                    .map(|(k, m)| (k.clone(), m.iter().map(|(i, id)| (*i, *id)).collect()))
                    .collect();
                (dim.clone(), c)
            })
            .collect()
    }

    fn broadcast(&self, msg: &ServerMsg, except: Option<u32>) {
        let text = match serde_json::to_string(msg) {
            Ok(t) => t,
            Err(_) => return,
        };
        for (pid, p) in &self.players {
            if Some(*pid) == except {
                continue;
            }
            let _ = p.tx.send(text.clone());
        }
    }
}

type SharedHub = Arc<Mutex<Hub>>;

#[derive(Clone)]
struct AppState {
    hub: SharedHub,
    client_dir: PathBuf,
}

// ============ Main ============

#[tokio::main]
async fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{port}");

    let (config, cfg_seed) = load_config();
    let seed = cfg_seed
        .or_else(|| {
            std::env::var("WORLD_SEED")
                .ok()
                .map(|s| s.parse::<u32>().unwrap_or_else(|_| hash_seed(&s)))
        })
        .unwrap_or_else(|| {
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .map(|d| d.subsec_nanos() ^ d.as_secs() as u32)
                .unwrap_or(1337)
        });

    let client_dir = find_client_dir();
    let mode = if config.open {
        "offen".to_string()
    } else {
        format!("Whitelist ({} Spieler)", config.whitelist.len())
    };
    println!("ClaudeMC Server · Seed {seed} · Modus: {mode}");
    match &client_dir {
        Some(dir) => println!("Spiel-Client wird ausgeliefert aus: {}", dir.display()),
        None => println!("Kein Client-Ordner gefunden (CLIENT_DIR setzen) – nur WebSocket aktiv"),
    }
    println!("Lausche auf {addr} – Spieler verbinden sich im Browser via http://<deine-ip>:{port}/");

    let hub: SharedHub = Arc::new(Mutex::new(Hub::new(config, seed)));

    // Snapshot-/Zeit-Task: 10 Hz Positions-Broadcast, ~0.1 s Zeitfortschritt
    {
        let hub = hub.clone();
        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(std::time::Duration::from_millis(SNAP_INTERVAL_MS));
            let mut tick: u32 = 0;
            loop {
                interval.tick().await;
                let mut h = hub.lock().await;
                h.time = (h.time + SNAP_INTERVAL_MS as f64 / 1000.0 / DAY_LENGTH) % 1.0;
                if h.players.is_empty() {
                    continue;
                }
                let snap: Vec<_> = h
                    .players
                    .values()
                    .map(|p| {
                        let i = &p.info;
                        (i.pid, i.d.as_str(), i.x, i.y, i.z, i.yw, i.pt)
                    })
                    .collect();
                h.broadcast(&ServerMsg::Snap { p: snap }, None);
                tick = tick.wrapping_add(1);
                if tick % TIME_SYNC_EVERY == 0 {
                    let v = h.time;
                    h.broadcast(&ServerMsg::Time { v }, None);
                }
            }
        });
    }

    let state = AppState {
        hub,
        client_dir: client_dir.unwrap_or_else(|| PathBuf::from("../client")),
    };
    let app = Router::new().fallback(root_handler).with_state(state);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind address");
    axum::serve(listener, app).await.expect("Server failed");
}

// Client-Ordner: CLIENT_DIR, sonst ./client bzw. ../client (Repo-Layout)
fn find_client_dir() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("CLIENT_DIR") {
        let p = PathBuf::from(dir);
        return p.is_dir().then_some(p);
    }
    for cand in ["client", "../client"] {
        let p = PathBuf::from(cand);
        if p.join("index.html").is_file() {
            return Some(p);
        }
    }
    None
}

// Ein Handler für alles: WebSocket-Upgrade (beliebiger Pfad) oder statische Datei
async fn root_handler(
    State(st): State<AppState>,
    ws: Option<WebSocketUpgrade>,
    uri: Uri,
) -> Response {
    if let Some(ws) = ws {
        return ws.on_upgrade(move |socket| handle_ws(socket, st.hub));
    }
    serve_static(&st.client_dir, uri.path()).await
}

fn content_type(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" | "mcmeta" => "application/json",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "ogg" => "audio/ogg",
        "mp3" => "audio/mpeg",
        "wasm" => "application/wasm",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

async fn serve_static(dir: &Path, path: &str) -> Response {
    let rel = path.trim_start_matches('/');
    let rel = if rel.is_empty() { "index.html" } else { rel };
    // Pfad-Traversal verhindern
    if rel.split('/').any(|seg| seg == ".." || seg.is_empty() || seg.contains('\\')) {
        return (StatusCode::FORBIDDEN, "Ungültiger Pfad").into_response();
    }
    match tokio::fs::read(dir.join(rel)).await {
        Ok(bytes) => (
            [(header::CONTENT_TYPE, content_type(rel))],
            bytes,
        )
            .into_response(),
        Err(_) => (
            StatusCode::NOT_FOUND,
            "Nicht gefunden. Läuft der Server neben dem client/-Ordner (oder ist CLIENT_DIR gesetzt)?",
        )
            .into_response(),
    }
}

// ============ WebSocket-Verbindung ============

async fn handle_ws(socket: WebSocket, hub: SharedHub) {
    let (mut write, mut read) = socket.split();

    // Ausgehender Kanal: alle Sende-Pfade (Hub-Broadcasts + direkte Antworten)
    // laufen über diese Queue, ein Writer-Task leert sie in den Socket.
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    let writer = tokio::spawn(async move {
        while let Some(text) = rx.recv().await {
            if write.send(WsMessage::Text(text)).await.is_err() {
                break;
            }
        }
    });

    let mut my_pid: Option<u32> = None;

    while let Some(msg) = read.next().await {
        let text = match msg {
            Ok(WsMessage::Text(t)) => t,
            Ok(WsMessage::Close(_)) | Err(_) => break,
            _ => continue,
        };
        let parsed: ClientMsg = match serde_json::from_str(&text) {
            Ok(m) => m,
            Err(_) => continue, // unbekannte/kaputte Nachrichten ignorieren
        };

        match parsed {
            ClientMsg::Join { name, pass } => {
                if my_pid.is_some() {
                    continue; // doppeltes Join ignorieren
                }
                let name: String = name.chars().take(16).collect();
                let account = name.to_lowercase();
                let mut h = hub.lock().await;

                // Zutritt: Whitelist (falls aktiv), kein Doppel-Login, Account-Passwort.
                // Auf Whitelist-Servern gilt das Whitelist-Passwort als Account-Passwort.
                let deny = if !h.config.open && !h.config.whitelist.contains_key(&account) {
                    Some("Du stehst nicht auf der Whitelist dieses Servers.")
                } else if !h.config.open
                    && h.config.whitelist.get(&account).map(|p| p != &pass).unwrap_or(true)
                {
                    Some("Falsches Passwort (Whitelist).")
                } else if h.players.values().any(|p| p.account == account) {
                    Some("Dieser Name spielt gerade schon.")
                } else {
                    match h.accounts.get(&account) {
                        Some(acc) if acc.pass != pass => {
                            Some("Falsches Passwort für diesen Namen.")
                        }
                        _ => None,
                    }
                };
                if let Some(msg) = deny {
                    if let Ok(t) = serde_json::to_string(&ServerMsg::Deny { msg }) {
                        let _ = tx.send(t);
                    }
                    break;
                }
                let acc = h
                    .accounts
                    .entry(account.clone())
                    .or_insert(Account { pass, state: None });
                let state = acc.state.clone();

                let pid = h.next_pid;
                h.next_pid += 1;
                my_pid = Some(pid);

                let others: Vec<PlayerInfo> =
                    h.players.values().map(|p| p.info.clone()).collect();
                let welcome = ServerMsg::Welcome {
                    pid,
                    seed: h.seed,
                    time: h.time,
                    players: others,
                    edits: h.edits_snapshot(),
                    state,
                };
                if let Ok(t) = serde_json::to_string(&welcome) {
                    let _ = tx.send(t);
                }

                h.broadcast(&ServerMsg::PJoin { pid, name: &name }, None);
                let info = PlayerInfo {
                    pid,
                    name,
                    d: "over".into(),
                    x: 0.0,
                    y: 0.0,
                    z: 0.0,
                    yw: 0.0,
                    pt: 0.0,
                };
                println!("[+] Spieler {} ({}) verbunden", info.name, pid);
                h.players.insert(pid, Player { info, account, tx: tx.clone() });
            }
            ClientMsg::Pos { d, x, y, z, yw, pt } => {
                let Some(pid) = my_pid else { continue };
                let mut h = hub.lock().await;
                if let Some(p) = h.players.get_mut(&pid) {
                    p.info.d = d;
                    p.info.x = x;
                    p.info.y = y;
                    p.info.z = z;
                    p.info.yw = yw;
                    p.info.pt = pt;
                }
            }
            ClientMsg::Set { d, x, y, z, id } => {
                let Some(pid) = my_pid else { continue };
                if d != "over" && d != "nether" && d != "end" {
                    continue;
                }
                let mut h = hub.lock().await;
                if h.apply_edit(&d, x, y, z, id) {
                    h.broadcast(&ServerMsg::Set { d: &d, x, y, z, id, by: pid }, Some(pid));
                }
            }
            ClientMsg::Chat { msg } => {
                let Some(pid) = my_pid else { continue };
                let msg: String = msg.chars().take(200).collect();
                if msg.trim().is_empty() {
                    continue;
                }
                let h = hub.lock().await;
                if let Some(p) = h.players.get(&pid) {
                    // An alle inkl. Absender (einheitliche Darstellung im Chat-Log)
                    h.broadcast(&ServerMsg::Chat { pid, name: &p.info.name, msg: &msg }, None);
                }
            }
            ClientMsg::State { data } => {
                let Some(pid) = my_pid else { continue };
                let mut h = hub.lock().await;
                let Some(p) = h.players.get(&pid) else { continue };
                let account = p.account.clone();
                if let Some(acc) = h.accounts.get_mut(&account) {
                    acc.state = Some(data);
                }
            }
            ClientMsg::Hit { target, dmg, kx, kz, r } => {
                let Some(pid) = my_pid else { continue };
                if pid == target || !dmg.is_finite() || dmg <= 0.0 {
                    continue;
                }
                let dmg = dmg.min(12.0);
                let kx = if kx.is_finite() { kx.clamp(-12.0, 12.0) } else { 0.0 };
                let kz = if kz.is_finite() { kz.clamp(-12.0, 12.0) } else { 0.0 };
                let h = hub.lock().await;
                let (Some(att), Some(tgt)) = (h.players.get(&pid), h.players.get(&target))
                else {
                    continue;
                };
                // Plausibilität: gleiche Dimension, Reichweite (Nahkampf 8, Pfeil 80)
                if att.info.d != tgt.info.d {
                    continue;
                }
                let dist = ((att.info.x - tgt.info.x).powi(2)
                    + (att.info.y - tgt.info.y).powi(2)
                    + (att.info.z - tgt.info.z).powi(2))
                .sqrt();
                if dist > if r { 80.0 } else { 8.0 } {
                    continue;
                }
                if let Ok(t) = serde_json::to_string(&ServerMsg::Hit { from: pid, dmg, kx, kz }) {
                    let _ = tgt.tx.send(t);
                }
            }
            ClientMsg::Died { by } => {
                let Some(pid) = my_pid else { continue };
                let h = hub.lock().await;
                let Some(victim) = h.players.get(&pid) else { continue };
                let msg = match h.players.get(&by) {
                    Some(killer) if by != pid => {
                        format!("⚔ {} wurde von {} besiegt", victim.info.name, killer.info.name)
                    }
                    _ => format!("☠ {} ist gestorben", victim.info.name),
                };
                h.broadcast(&ServerMsg::Sys { msg: &msg }, None);
            }
            ClientMsg::Ping { ts } => {
                if let Ok(t) = serde_json::to_string(&ServerMsg::Pong { ts }) {
                    let _ = tx.send(t);
                }
            }
        }
    }

    // Aufräumen bei Disconnect
    if let Some(pid) = my_pid {
        let mut h = hub.lock().await;
        if let Some(p) = h.players.remove(&pid) {
            println!("[-] Spieler {} ({}) getrennt", p.info.name, pid);
        }
        h.broadcast(&ServerMsg::PLeave { pid }, None);
    }
    // Writer-Task sauber auslaufen lassen: erst wenn alle Sender weg sind,
    // endet rx.recv() – so werden gepufferte Nachrichten (z. B. Deny) noch gesendet.
    drop(tx);
    let _ = writer.await;
}
