// Integrationstest: startet den echten Server-Binary und prüft mit zwei
// WebSocket-Clients Join/Welcome, Block-Relay, Snapshots und Late-Join-Journal.

use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::process::{Child, Command};
use std::time::Duration;
use tokio_tungstenite::tungstenite::Message;

struct ServerGuard(Child);
impl Drop for ServerGuard {
    fn drop(&mut self) {
        let _ = self.0.kill();
    }
}

type Ws = tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
>;

async fn connect(port: u16) -> Ws {
    for _ in 0..50 {
        if let Ok((ws, _)) =
            tokio_tungstenite::connect_async(format!("ws://127.0.0.1:{port}")).await
        {
            return ws;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    panic!("Server nicht erreichbar");
}

async fn send(ws: &mut Ws, v: Value) {
    ws.send(Message::Text(v.to_string())).await.unwrap();
}

// Nächste Nachricht mit t == want (überspringt andere, z. B. snap/time)
async fn recv_type(ws: &mut Ws, want: &str) -> Value {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
    loop {
        let msg = tokio::time::timeout_at(deadline, ws.next())
            .await
            .expect("Timeout beim Warten")
            .expect("Stream beendet")
            .expect("WS-Fehler");
        if let Message::Text(t) = msg {
            let v: Value = serde_json::from_str(&t).unwrap();
            if v["t"] == want {
                return v;
            }
        }
    }
}

#[tokio::test]
async fn join_set_snapshot_and_late_join() {
    let port = 39251;
    let server = Command::new(env!("CARGO_BIN_EXE_claudemc-ws"))
        .env("PORT", port.to_string())
        .env("WORLD_SEED", "4242")
        .spawn()
        .unwrap();
    let _guard = ServerGuard(server);

    // Client A tritt bei
    let mut a = connect(port).await;
    send(&mut a, json!({"t":"join","name":"Alice"})).await;
    let welcome_a = recv_type(&mut a, "welcome").await;
    assert_eq!(welcome_a["seed"], 4242);
    assert_eq!(welcome_a["players"].as_array().unwrap().len(), 0);
    let pid_a = welcome_a["pid"].as_u64().unwrap();

    // A meldet Position und setzt einen Block
    send(&mut a, json!({"t":"pos","d":"over","x":10.5,"y":45.0,"z":-3.5,"yw":1.0,"pt":0.0})).await;
    send(&mut a, json!({"t":"set","d":"over","x":10,"y":44,"z":-3,"id":1})).await;

    // Ungültige Dimension und y=0 (Bedrock) dürfen das Journal nicht erreichen
    send(&mut a, json!({"t":"set","d":"hack","x":0,"y":50,"z":0,"id":9})).await;
    send(&mut a, json!({"t":"set","d":"over","x":0,"y":0,"z":0,"id":9})).await;

    // Ping/Pong
    send(&mut a, json!({"t":"ping","ts":123.0})).await;
    assert_eq!(recv_type(&mut a, "pong").await["ts"], 123.0);

    // Client B: Late-Join → Welcome muss A + Edit-Journal enthalten
    let mut b = connect(port).await;
    send(&mut b, json!({"t":"join","name":"Bob"})).await;
    let welcome_b = recv_type(&mut b, "welcome").await;
    let players = welcome_b["players"].as_array().unwrap();
    assert_eq!(players.len(), 1);
    assert_eq!(players[0]["name"], "Alice");
    // Edit: x=10,y=44,z=-3 → Chunk 0,-1 · idx = (44*16 + (−3−(−16)))*16 + 10 = 11482
    let edits = &welcome_b["edits"]["over"]["0,-1"];
    assert_eq!(edits.as_array().unwrap().len(), 1);
    assert_eq!(edits[0][0], 11482);
    assert_eq!(edits[0][1], 1);
    assert!(welcome_b["edits"]["hack"].is_null());
    let pid_b = welcome_b["pid"].as_u64().unwrap();
    assert_ne!(pid_a, pid_b);

    // A bekommt PJoin für B
    let pjoin = recv_type(&mut a, "pjoin").await;
    assert_eq!(pjoin["name"], "Bob");

    // B setzt einen Block → nur A bekommt das Relay (mit by = B)
    send(&mut b, json!({"t":"set","d":"nether","x":-1,"y":30,"z":5,"id":21})).await;
    let set = recv_type(&mut a, "set").await;
    assert_eq!(set["d"], "nether");
    assert_eq!(set["x"], -1);
    assert_eq!(set["id"], 21);
    assert_eq!(set["by"].as_u64().unwrap(), pid_b);

    // Snapshots enthalten beide Spieler mit A's gemeldeter Position
    let snap = recv_type(&mut b, "snap").await;
    let arr = snap["p"].as_array().unwrap();
    assert_eq!(arr.len(), 2);
    let a_entry = arr.iter().find(|e| e[0].as_u64().unwrap() == pid_a).unwrap();
    assert_eq!(a_entry[1], "over");
    assert_eq!(a_entry[2], 10.5);
    assert_eq!(a_entry[4], -3.5);

    // A trennt → B bekommt PLeave
    a.close(None).await.unwrap();
    let pleave = recv_type(&mut b, "pleave").await;
    assert_eq!(pleave["pid"].as_u64().unwrap(), pid_a);
}

#[tokio::test]
async fn accounts_state_and_chat() {
    let port = 39252;
    let server = Command::new(env!("CARGO_BIN_EXE_claudemc-ws"))
        .env("PORT", port.to_string())
        .env("WORLD_SEED", "7")
        .spawn()
        .unwrap();
    let _guard = ServerGuard(server);

    // Erster Join legt den Account an; frischer Account hat keinen State
    let mut a = connect(port).await;
    send(&mut a, json!({"t":"join","name":"Fionn","pass":"geheim"})).await;
    let w = recv_type(&mut a, "welcome").await;
    assert!(w["state"].is_null());

    // Chat wird an alle (inkl. Absender) verteilt
    send(&mut a, json!({"t":"chat","msg":"Hallo Welt"})).await;
    let chat = recv_type(&mut a, "chat").await;
    assert_eq!(chat["name"], "Fionn");
    assert_eq!(chat["msg"], "Hallo Welt");

    // Doppel-Login mit gleichem Namen wird abgelehnt
    let mut dup = connect(port).await;
    send(&mut dup, json!({"t":"join","name":"FIONN","pass":"geheim"})).await;
    let deny = recv_type(&mut dup, "deny").await;
    assert!(deny["msg"].as_str().unwrap().contains("gerade"));

    // Zustand speichern und trennen
    send(&mut a, json!({"t":"state","data":{"hp":17,"inv":[[3,64]]}})).await;
    tokio::time::sleep(Duration::from_millis(200)).await;
    a.close(None).await.unwrap();
    tokio::time::sleep(Duration::from_millis(200)).await;

    // Falsches Passwort → Deny
    let mut wrong = connect(port).await;
    send(&mut wrong, json!({"t":"join","name":"fionn","pass":"falsch"})).await;
    let deny = recv_type(&mut wrong, "deny").await;
    assert!(deny["msg"].as_str().unwrap().contains("Passwort"));

    // Richtiges Passwort → State kommt zurück (Name case-insensitiv)
    let mut back = connect(port).await;
    send(&mut back, json!({"t":"join","name":"fionn","pass":"geheim"})).await;
    let w2 = recv_type(&mut back, "welcome").await;
    assert_eq!(w2["state"]["hp"], 17);
    assert_eq!(w2["state"]["inv"][0][1], 64);
}

#[tokio::test]
async fn pvp_hit_relay_and_death_message() {
    let port = 39253;
    let server = Command::new(env!("CARGO_BIN_EXE_claudemc-ws"))
        .env("PORT", port.to_string())
        .env("WORLD_SEED", "9")
        .spawn()
        .unwrap();
    let _guard = ServerGuard(server);

    let mut a = connect(port).await;
    send(&mut a, json!({"t":"join","name":"Att"})).await;
    let pid_a = recv_type(&mut a, "welcome").await["pid"].as_u64().unwrap();
    let mut b = connect(port).await;
    send(&mut b, json!({"t":"join","name":"Def"})).await;
    let pid_b = recv_type(&mut b, "welcome").await["pid"].as_u64().unwrap();

    // Beide nah beieinander in der Overworld
    send(&mut a, json!({"t":"pos","d":"over","x":0.0,"y":45.0,"z":0.0,"yw":0.0,"pt":0.0})).await;
    send(&mut b, json!({"t":"pos","d":"over","x":3.0,"y":45.0,"z":0.0,"yw":0.0,"pt":0.0})).await;
    tokio::time::sleep(Duration::from_millis(150)).await;

    // Nahkampftreffer: Schaden wird gedeckelt (20 -> 12) und nur ans Ziel relayt
    send(&mut a, json!({"t":"hit","target":pid_b,"dmg":20.0,"kx":6.0,"kz":0.0})).await;
    let hit = recv_type(&mut b, "hit").await;
    assert_eq!(hit["from"].as_u64().unwrap(), pid_a);
    assert_eq!(hit["dmg"], 12.0);

    // Zu weit weg für Nahkampf -> verworfen; als Fernkampf (r) -> erlaubt
    send(&mut b, json!({"t":"pos","d":"over","x":40.0,"y":45.0,"z":0.0,"yw":0.0,"pt":0.0})).await;
    tokio::time::sleep(Duration::from_millis(150)).await;
    send(&mut a, json!({"t":"hit","target":pid_b,"dmg":5.0,"kx":0.0,"kz":0.0})).await;
    send(&mut a, json!({"t":"hit","target":pid_b,"dmg":6.0,"kx":0.0,"kz":0.0,"r":true})).await;
    let hit2 = recv_type(&mut b, "hit").await;
    assert_eq!(hit2["dmg"], 6.0, "Nahkampf-Hit über 8 Blöcke muss verworfen werden");

    // Todesmeldung als System-Broadcast an alle
    send(&mut b, json!({"t":"died","by":pid_a})).await;
    let sys = recv_type(&mut a, "sys").await;
    let msg = sys["msg"].as_str().unwrap();
    assert!(msg.contains("Def") && msg.contains("Att") && msg.contains("besiegt"), "{msg}");
}
