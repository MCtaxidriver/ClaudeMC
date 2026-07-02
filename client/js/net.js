// Multiplayer-Transport: WebSocket-Verbindung zum ClaudeMC-Hub.
// Reines Protokoll/Transport-Modul ohne THREE- oder Spiel-Abhängigkeiten;
// die Integration (Remote-Spieler, Block-Anwendung) übernimmt main.js.

export const DEFAULT_SERVER = 'wss://claudemc.onrender.com';

const POS_INTERVAL = 0.1;   // s zwischen Positions-Paketen (10 Hz)
const PING_INTERVAL = 15;   // s zwischen Keepalive-Pings

export class Net {
  constructor() {
    this.ws = null;
    this.active = false;        // true sobald Welcome empfangen wurde
    this.applyingRemote = false; // unterdrückt Echo beim Anwenden von Remote-Sets
    this.pid = null;
    this.handlers = {};
    this.posTimer = 0;
    this.pingTimer = 0;
    this.lastPos = null;
    this.latency = null;
  }

  // handlers: { onWelcome, onSet, onSnap, onJoin, onLeave, onTime, onClose, onError }
  connect(url, name, handlers) {
    this.handlers = handlers;
    let settled = false;
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      handlers.onError?.('Verbindung fehlgeschlagen');
      return;
    }
    this.ws.addEventListener('open', () => {
      this.send({ t: 'join', name });
    });
    this.ws.addEventListener('message', ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      this.dispatch(msg, () => { settled = true; });
    });
    this.ws.addEventListener('close', () => {
      const wasActive = this.active;
      this.reset();
      if (wasActive) this.handlers.onClose?.();
      else if (!settled) this.handlers.onError?.('Server nicht erreichbar');
    });
    this.ws.addEventListener('error', () => { /* close-Event folgt */ });
  }

  dispatch(msg, markSettled) {
    const h = this.handlers;
    switch (msg.t) {
      case 'welcome':
        this.pid = msg.pid;
        this.active = true;
        markSettled();
        h.onWelcome?.(msg);
        break;
      case 'set': h.onSet?.(msg); break;
      case 'snap': h.onSnap?.(msg.p); break;
      case 'pjoin': if (msg.pid !== this.pid) h.onJoin?.(msg); break;
      case 'pleave': h.onLeave?.(msg); break;
      case 'time': h.onTime?.(msg.v); break;
      case 'pong': this.latency = performance.now() - msg.ts; break;
    }
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  sendSet(d, x, y, z, id) {
    if (!this.active) return;
    this.send({ t: 'set', d, x, y, z, id });
  }

  // Pro Frame aufrufen: drosselt Positions-Updates auf 10 Hz und pingt.
  tick(dt, d, x, y, z, yw, pt) {
    if (!this.active) return;
    this.posTimer -= dt;
    if (this.posTimer <= 0) {
      this.posTimer = POS_INTERVAL;
      const lp = this.lastPos;
      if (!lp || lp.d !== d || Math.abs(lp.x - x) > 0.001 || Math.abs(lp.y - y) > 0.001 ||
          Math.abs(lp.z - z) > 0.001 || Math.abs(lp.yw - yw) > 0.001 || Math.abs(lp.pt - pt) > 0.001) {
        this.lastPos = { d, x, y, z, yw, pt };
        this.send({ t: 'pos', d, x, y, z, yw, pt });
      }
    }
    this.pingTimer -= dt;
    if (this.pingTimer <= 0) {
      this.pingTimer = PING_INTERVAL;
      this.send({ t: 'ping', ts: performance.now() });
    }
  }

  disconnect() {
    const ws = this.ws;
    this.reset();
    this.handlers = {};
    if (ws) {
      try { ws.close(); } catch { /* bereits zu */ }
    }
  }

  reset() {
    this.ws = null;
    this.active = false;
    this.pid = null;
    this.lastPos = null;
    this.posTimer = 0;
    this.pingTimer = 0;
    this.latency = null;
  }
}
