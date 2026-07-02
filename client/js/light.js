// Licht-Engine: Skylight (Spalten + Ausbreitung) und Blocklicht (Fackeln etc.).
// Pro Chunk wird ein gepacktes Licht-Array berechnet: (sky << 4) | block.
// Berechnung mit Rand (Licht aus Nachbarchunks fliesst herein), BFS-Flutung mit Abfall 1.

import { CHUNK_SIZE as CS, WORLD_HEIGHT as H } from './config.js';
import { B, BLOCK_INFO } from './blocks.js';

const M = 12;             // Rand um den Chunk, aus dem Licht hereinfliessen kann
const RX = CS + 2 * M;    // Regionsbreite

export const DEFAULT_LIGHT = 0xF0; // volle Sonne, kein Blocklicht

export function packLight(sky, block) { return (sky << 4) | block; }
export function skyOf(v) { return v >> 4; }
export function blockOf(v) { return v & 15; }

// Berechnet c.light für einen Chunk neu (liest Nachbardaten über world.getBlock)
export function relightChunk(world, c) {
  const baseX = c.cx * CS - M;
  const baseZ = c.cz * CS - M;
  const size = RX * H * RX;
  const sky = new Uint8Array(size);
  const blk = new Uint8Array(size);
  const opaque = new Uint8Array(size);
  const idx = (x, y, z) => (y * RX + z) * RX + x;

  // Queue als Ringpuffer (x,y,z gepackt)
  const queue = new Int32Array(size);
  let qh = 0, qt = 0;
  const push = i => { queue[qt++] = i; };

  // 1) Spalten-Scan: Skylight von oben, Emissionsquellen sammeln, Opazität cachen
  for (let z = 0; z < RX; z++) {
    for (let x = 0; x < RX; x++) {
      let open = true;
      for (let y = H - 1; y >= 0; y--) {
        const id = world.getBlock(baseX + x, y, baseZ + z);
        const info = BLOCK_INFO[id];
        const i = idx(x, y, z);
        if (info.opaque && id !== B.AIR) { opaque[i] = 1; open = false; }
        if (open) { sky[i] = 15; }
        if (info.light > 0) { blk[i] = info.light; push(i); }
      }
    }
  }

  // 2) Blocklicht-BFS
  const spread = (arr) => {
    while (qh < qt) {
      const i = queue[qh++];
      const l = arr[i] - 1;
      if (l <= 0) continue;
      const y = (i / (RX * RX)) | 0;
      const rem = i - y * RX * RX;
      const z = (rem / RX) | 0;
      const x = rem - z * RX;
      // 6 Nachbarn
      if (x > 0) { const n = i - 1; if (!opaque[n] && arr[n] < l) { arr[n] = l; queue[qt++] = n; } }
      if (x < RX - 1) { const n = i + 1; if (!opaque[n] && arr[n] < l) { arr[n] = l; queue[qt++] = n; } }
      if (z > 0) { const n = i - RX; if (!opaque[n] && arr[n] < l) { arr[n] = l; queue[qt++] = n; } }
      if (z < RX - 1) { const n = i + RX; if (!opaque[n] && arr[n] < l) { arr[n] = l; queue[qt++] = n; } }
      if (y > 0) { const n = i - RX * RX; if (!opaque[n] && arr[n] < l) { arr[n] = l; queue[qt++] = n; } }
      if (y < H - 1) { const n = i + RX * RX; if (!opaque[n] && arr[n] < l) { arr[n] = l; queue[qt++] = n; } }
      if (qt > size - 8) { // Ringpuffer-Kompaktierung (selten)
        queue.copyWithin(0, qh, qt);
        qt -= qh; qh = 0;
      }
    }
  };
  spread(blk);

  // 3) Skylight-BFS: alle voll beleuchteten Zellen als Quellen (Ausbreitung in Höhlen)
  qh = 0; qt = 0;
  for (let i = 0; i < size; i++) if (sky[i] === 15) queue[qt++] = i;
  spread(sky);

  // 4) Inneres Chunk-Gebiet in gepacktes Array kopieren
  const out = c.light && c.light.length === CS * H * CS ? c.light : new Uint8Array(CS * H * CS);
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < CS; z++) {
      for (let x = 0; x < CS; x++) {
        const i = idx(x + M, y, z + M);
        out[(y * CS + z) * CS + x] = (sky[i] << 4) | blk[i];
      }
    }
  }
  c.light = out;
  c.lightDirty = false;
}
