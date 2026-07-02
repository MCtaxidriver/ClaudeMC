// Strukturen: Dörfer (Pfade, Betten, Truhen, Türen), Portal-Ruinen, Festungen,
// Wüstenpyramiden (TNT-Falle), Pillager-Outposts, Dungeons, Mineshafts + Loot.
// Alles deterministisch aus Region-Hashes, damit Chunks unabhängig generierbar sind.
// ctx = { hash3(x,z,salt), terrainHeight(x,z), biomeAt(x,z) }

import { B } from './blocks.js';
import { I } from './items.js';
import { SEA_LEVEL } from './config.js';

// ============ Loot-Tabellen ============
// Einträge: { id, min, max, p } – p = Wahrscheinlichkeit, dass der Eintrag gewürfelt wird
export const LOOT_TABLES = {
  village: [
    { id: I.BREAD, min: 1, max: 3, p: 0.7 },
    { id: I.WHEAT, min: 2, max: 5, p: 0.6 },
    { id: I.APPLE, min: 1, max: 3, p: 0.5 },
    { id: I.IRON_INGOT, min: 1, max: 3, p: 0.35 },
    { id: I.EMERALD, min: 1, max: 2, p: 0.3 },
    { id: I.S_PICK, min: 1, max: 1, p: 0.2 },
    { id: I.S_AXE, min: 1, max: 1, p: 0.15 },
    { id: B.TORCH, min: 2, max: 6, p: 0.4 },
  ],
  pyramid: [
    { id: I.GOLD_INGOT, min: 2, max: 6, p: 0.7 },
    { id: I.DIAMOND, min: 1, max: 3, p: 0.35 },
    { id: I.EMERALD, min: 1, max: 4, p: 0.4 },
    { id: I.BONE, min: 2, max: 6, p: 0.6 },
    { id: I.GUNPOWDER, min: 2, max: 6, p: 0.6 },
    { id: I.GOLDEN_APPLE, min: 1, max: 1, p: 0.15 },
    { id: I.STRING, min: 1, max: 4, p: 0.4 },
  ],
  dungeon: [
    { id: I.STRING, min: 1, max: 4, p: 0.6 },
    { id: I.GUNPOWDER, min: 1, max: 4, p: 0.5 },
    { id: I.IRON_INGOT, min: 1, max: 3, p: 0.4 },
    { id: I.BREAD, min: 1, max: 2, p: 0.5 },
    { id: I.GOLDEN_APPLE, min: 1, max: 1, p: 0.1 },
    { id: I.ENDER_PEARL, min: 1, max: 1, p: 0.15 },
    { id: B.WEB, min: 1, max: 3, p: 0.3 },
  ],
  mineshaft: [
    { id: I.COAL, min: 2, max: 6, p: 0.6 },
    { id: I.IRON_INGOT, min: 1, max: 4, p: 0.5 },
    { id: I.GOLD_INGOT, min: 1, max: 3, p: 0.3 },
    { id: I.DIAMOND, min: 1, max: 2, p: 0.15 },
    { id: I.BREAD, min: 1, max: 2, p: 0.4 },
    { id: B.RAIL, min: 2, max: 8, p: 0.5 },
    { id: B.TORCH, min: 2, max: 8, p: 0.5 },
  ],
  outpost: [
    { id: I.ARROW, min: 4, max: 12, p: 0.8 },
    { id: I.BOW, min: 1, max: 1, p: 0.4 },
    { id: I.STRING, min: 1, max: 4, p: 0.5 },
    { id: I.IRON_INGOT, min: 1, max: 3, p: 0.4 },
    { id: B.DARK_LOG, min: 2, max: 6, p: 0.5 },
    { id: I.EMERALD, min: 1, max: 3, p: 0.3 },
  ],
};

// Würfelt einen Truhen-Inhalt (27 Slots, Items zufällig verteilt)
export function rollLoot(tableName, rand) {
  const table = LOOT_TABLES[tableName] || [];
  const slots = new Array(27).fill(null);
  for (const e of table) {
    if (rand() > e.p) continue;
    const count = e.min + Math.floor(rand() * (e.max - e.min + 1));
    let slot = Math.floor(rand() * 27);
    for (let tries = 0; tries < 27 && slots[slot]; tries++) slot = (slot + 7) % 27;
    slots[slot] = { id: e.id, count };
  }
  return slots;
}

// ============ Dörfer ============
export const VILLAGE_REGION = 128;

export function villageInRegion(ctx, rx, rz) {
  if (ctx.hash3(rx, rz, 101) > 0.3) return null;
  const cx = rx * VILLAGE_REGION + 24 + ((ctx.hash3(rx, rz, 102) * (VILLAGE_REGION - 48)) | 0);
  const cz = rz * VILLAGE_REGION + 24 + ((ctx.hash3(rx, rz, 103) * (VILLAGE_REGION - 48)) | 0);
  const baseY = ctx.terrainHeight(cx, cz);
  if (baseY < SEA_LEVEL + 2 || baseY > SEA_LEVEL + 20) return null; // nicht im Wasser / Gebirge

  const houses = [];
  const n = 3 + ((ctx.hash3(rx, rz, 104) * 4) | 0); // 3-6 Häuser
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + ctx.hash3(rx, rz, 110 + i) * 0.8;
    const dist = 10 + ctx.hash3(rx, rz, 120 + i) * 10;
    const hx = Math.round(cx + Math.cos(ang) * dist);
    const hz = Math.round(cz + Math.sin(ang) * dist);
    const w = 5 + ((ctx.hash3(rx, rz, 130 + i) * 3) | 0); // 5-7
    const d = 5 + ((ctx.hash3(rx, rz, 140 + i) * 3) | 0);
    const doorSide = (ctx.hash3(rx, rz, 150 + i) * 4) | 0;
    const wall = ctx.hash3(rx, rz, 160 + i);
    const hy = ctx.terrainHeight(hx, hz);
    const house = {
      x: hx - (w >> 1), z: hz - (d >> 1), w, d, doorSide,
      y: hy,
      wallMat: wall < 0.5 ? B.PLANKS : wall < 0.8 ? B.COBBLE : B.BIRCH_LOG,
      tall: ctx.hash3(rx, rz, 170 + i) < 0.3, // höhere Variante
    };
    // Abgeleitete Positionen (für Türen, Betten, Truhen, Villager-KI, Loot)
    const midX = house.x + (house.w >> 1), midZ = house.z + (house.d >> 1);
    house.door =
      house.doorSide === 0 ? { x: midX, z: house.z } :
      house.doorSide === 1 ? { x: midX, z: house.z + house.d - 1 } :
      house.doorSide === 2 ? { x: house.x, z: midZ } :
      { x: house.x + house.w - 1, z: midZ };
    house.bed = { x: house.x + house.w - 3, z: house.z + 1 };
    house.chest = { x: house.x + 1, z: house.z + house.d - 2 };
    houses.push(house);
  }
  const radius = 30;
  return { cx, cz, baseY, houses, radius };
}

export function rasterizeHouse(h, put) {
  const y0 = h.y + 1;              // Fussboden-Ebene (begehbar)
  const wallH = h.tall ? 4 : 3;
  for (let x = h.x; x < h.x + h.w; x++) {
    for (let z = h.z; z < h.z + h.d; z++) {
      const edgeX = x === h.x || x === h.x + h.w - 1;
      const edgeZ = z === h.z || z === h.z + h.d - 1;
      const corner = edgeX && edgeZ;
      // Fundament + Boden
      for (let y = y0 - 5; y < y0; y++) put(x, y, z, y === y0 - 1 ? B.PLANKS : B.COBBLE);
      for (let dy = 0; dy < wallH; dy++) {
        const y = y0 + dy;
        if (corner) put(x, y, z, B.LOG);
        else if (edgeX || edgeZ) {
          const isDoor = x === h.door.x && z === h.door.z && dy < 2;
          const isWindow = dy === 1 && !isDoor && ((edgeX ? z : x) % 2 === 0);
          if (isDoor) put(x, y, z, dy === 0 ? B.DOOR_L : B.DOOR_U);
          else if (isWindow) put(x, y, z, B.GLASS);
          else put(x, y, z, h.wallMat);
        } else {
          put(x, y, z, B.AIR); // Innenraum
        }
      }
      // Dach
      put(x, y0 + wallH, z, B.PLANKS);
      for (let dy = 1; dy <= 3; dy++) put(x, y0 + wallH + dy, z, B.AIR);
    }
  }
  // Einrichtung: Werkbank, Bett, Truhe, Fackel
  put(h.x + 1, y0, h.z + 1, B.CRAFTING_TABLE);
  put(h.bed.x, y0, h.bed.z, B.BED_FOOT);
  put(h.bed.x + 1, y0, h.bed.z, B.BED_HEAD);
  put(h.chest.x, y0, h.chest.z, B.CHEST);
  put(h.x + h.w - 2, y0, h.z + h.d - 2, B.TORCH);
  // Vorplatz vor der Tür freiräumen
  const dx = h.door.x === h.x ? -1 : h.door.x === h.x + h.w - 1 ? 1 : 0;
  const dz = h.door.z === h.z ? -1 : h.door.z === h.z + h.d - 1 ? 1 : 0;
  put(h.door.x + dx, y0, h.door.z + dz, B.AIR);
  put(h.door.x + dx, y0 + 1, h.door.z + dz, B.AIR);
}

// Pfade + Brunnen + Heuballen (eigener Raster-Schritt, unter den Häusern hindurch geclippt)
export function rasterizeVillageExtras(ctx, v, put) {
  const inHouse = (x, z) => v.houses.some(h => x >= h.x && x < h.x + h.w && z >= h.z && z < h.z + h.d);
  // Pfade: L-förmig vom Zentrum zu jeder Haustür
  for (const h of v.houses) {
    const tx = h.door.x, tz = h.door.z;
    let x = v.cx, z = v.cz;
    const step = (nx, nz) => {
      if (!inHouse(nx, nz)) {
        const y = ctx.terrainHeight(nx, nz);
        put(nx, y, nz, B.PATH);
        put(nx, y + 1, nz, B.AIR);
        put(nx, y + 2, nz, B.AIR);
      }
    };
    while (x !== tx) { x += Math.sign(tx - x); step(x, z); }
    while (z !== tz) { z += Math.sign(tz - z); step(x, z); }
  }
  // Brunnen im Zentrum
  const wy = v.baseY;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const wall = Math.abs(dx) === 1 || Math.abs(dz) === 1;
      put(v.cx + dx, wy + 1, v.cz + dz, wall ? B.COBBLE : B.AIR);
      put(v.cx + dx, wy, v.cz + dz, wall ? B.COBBLE : B.WATER);
      put(v.cx + dx, wy - 1, v.cz + dz, wall ? B.COBBLE : B.WATER);
      put(v.cx + dx, wy - 2, v.cz + dz, B.COBBLE);
    }
  }
  // Heuballen
  for (let i = 0; i < 3; i++) {
    if (ctx.hash3(v.cx, v.cz, 180 + i) > 0.7) continue;
    const hx = v.cx + Math.round((ctx.hash3(v.cx, v.cz, 190 + i) - 0.5) * 24);
    const hz = v.cz + Math.round((ctx.hash3(v.cx, v.cz, 200 + i) - 0.5) * 24);
    if (inHouse(hx, hz)) continue;
    const hy = ctx.terrainHeight(hx, hz);
    put(hx, hy + 1, hz, B.HAY);
    if (ctx.hash3(hx, hz, 210) < 0.4) put(hx, hy + 2, hz, B.HAY);
  }
}

// ============ Portal-Ruinen ============
export const PORTAL_REGION = 160;

export function ruinedPortalInRegion(ctx, rx, rz) {
  if (ctx.hash3(rx, rz, 201) > 0.55) return null;
  const px = rx * PORTAL_REGION + 20 + ((ctx.hash3(rx, rz, 202) * (PORTAL_REGION - 40)) | 0);
  const pz = rz * PORTAL_REGION + 20 + ((ctx.hash3(rx, rz, 203) * (PORTAL_REGION - 40)) | 0);
  const baseY = ctx.terrainHeight(px, pz);
  if (baseY < SEA_LEVEL) return null;
  const axis = ctx.hash3(rx, rz, 204) < 0.5 ? 'x' : 'z';
  return { x: px, z: pz, baseY, axis };
}

export function rasterizePortalFrame(x, y, z, axis, put, active = false) {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 5; j++) {
      const frame = i === 0 || i === 3 || j === 0 || j === 4;
      const wx = axis === 'x' ? x + i : x;
      const wz = axis === 'x' ? z : z + i;
      put(wx, y + j, wz, frame ? B.OBSIDIAN : (active ? B.PORTAL : B.AIR));
    }
  }
}

export function rasterizeRuinedPortal(p, put) {
  const y = p.baseY + 1;
  for (let dx = -2; dx <= 4; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const wx = p.axis === 'x' ? p.x + dx : p.x + dz;
      const wz = p.axis === 'x' ? p.z + dz : p.z + dx;
      put(wx, p.baseY, wz, (dx + dz) % 3 === 0 ? B.NETHERRACK : B.COBBLE);
    }
  }
  for (let i = -1; i < 5; i++) {
    for (let j = 0; j < 6; j++) {
      for (let k = -2; k <= 2; k++) {
        const wx = p.axis === 'x' ? p.x + i : p.x + k;
        const wz = p.axis === 'x' ? p.z + k : p.z + i;
        if (k !== 0 || i < 0 || i > 3) put(wx, y + j, wz, B.AIR);
      }
    }
  }
  rasterizePortalFrame(p.x, y, p.z, p.axis, put, false);
}

// ============ Festung (End-Portal) ============
export const STRONGHOLD_REGION = 384;

export function strongholdInRegion(ctx, rx, rz) {
  if (ctx.hash3(rx, rz, 401) > 0.5) return null;
  const sx = rx * STRONGHOLD_REGION + 48 + ((ctx.hash3(rx, rz, 402) * (STRONGHOLD_REGION - 96)) | 0);
  const sz = rz * STRONGHOLD_REGION + 48 + ((ctx.hash3(rx, rz, 403) * (STRONGHOLD_REGION - 96)) | 0);
  const surface = ctx.terrainHeight(sx, sz);
  const baseY = Math.max(6, Math.min(surface - 14, 30));
  return { x: sx, z: sz, baseY };
}

export function rasterizeStronghold(s, put) {
  const y0 = s.baseY;
  const half = 7;
  for (let dx = -half; dx <= half; dx++) {
    for (let dz = -half; dz <= half; dz++) {
      const edge = Math.abs(dx) === half || Math.abs(dz) === half;
      put(s.x + dx, y0, s.z + dz, B.STONE_BRICKS);
      put(s.x + dx, y0 + 6, s.z + dz, B.STONE_BRICKS);
      for (let dy = 1; dy <= 5; dy++) {
        put(s.x + dx, y0 + dy, s.z + dz, edge ? B.STONE_BRICKS : B.AIR);
      }
    }
  }
  for (const [ex, ez] of [[-half + 1, -half + 1], [-half + 1, half - 1], [half - 1, -half + 1], [half - 1, half - 1]]) {
    put(s.x + ex, y0 + 5, s.z + ez, B.GLOWSTONE);
  }
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const ring = Math.max(Math.abs(dx), Math.abs(dz)) === 2;
      const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
      if (ring && !corner) put(s.x + dx, y0 + 1, s.z + dz, B.END_FRAME);
    }
  }
}

// ============ Wüstenpyramide (mit TNT-Falle) ============
export const PYRAMID_REGION = 288;

export function pyramidInRegion(ctx, rx, rz) {
  if (ctx.hash3(rx, rz, 501) > 0.5) return null;
  const px = rx * PYRAMID_REGION + 40 + ((ctx.hash3(rx, rz, 502) * (PYRAMID_REGION - 80)) | 0);
  const pz = rz * PYRAMID_REGION + 40 + ((ctx.hash3(rx, rz, 503) * (PYRAMID_REGION - 80)) | 0);
  if (ctx.biomeAt(px, pz) !== 'desert') return null;
  const baseY = ctx.terrainHeight(px, pz);
  if (baseY < SEA_LEVEL) return null;
  return { x: px, z: pz, baseY };
}

export function rasterizePyramid(p, put) {
  const y0 = p.baseY + 1;
  // Stufenpyramide 17x17
  for (let lvl = 0; lvl <= 8; lvl++) {
    const half = 8 - lvl;
    for (let dx = -half; dx <= half; dx++) {
      for (let dz = -half; dz <= half; dz++) {
        put(p.x + dx, y0 + lvl, p.z + dz, B.SANDSTONE);
      }
    }
  }
  // Innenraum aushöhlen
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      for (let dy = 1; dy <= 4; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + dy < 12) put(p.x + dx, y0 + dy, p.z + dz, B.AIR);
      }
    }
  }
  // Boden + Eingang (Südseite)
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) put(p.x + dx, y0, p.z + dz, B.SANDSTONE);
  for (let dy = 1; dy <= 2; dy++) { put(p.x, y0 + dy, p.z + 8, B.AIR); put(p.x, y0 + dy, p.z + 7, B.AIR); }
  // Fackeln innen
  for (const [tx, tz] of [[-5, -5], [-5, 5], [5, -5], [5, 5]]) put(p.x + tx, y0 + 1, p.z + tz, B.TORCH);

  // Verstecktes Grab: Schacht in der Mitte, Truhen + TNT-Falle
  for (let dy = 1; dy <= 6; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const wall = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        put(p.x + dx, y0 - dy, p.z + dz, wall ? B.SANDSTONE : B.AIR);
      }
    }
  }
  // Blauer "Köder"-Block in der Bodenmitte (Wolle) – darunter geht es runter
  put(p.x, y0, p.z, B.WOOL);
  // Truhen an den vier Wänden, Druckplatte in der Mitte, TNT darunter
  put(p.x + 1, y0 - 5, p.z, B.CHEST);
  put(p.x - 1, y0 - 5, p.z, B.CHEST);
  put(p.x, y0 - 5, p.z + 1, B.CHEST);
  put(p.x, y0 - 5, p.z - 1, B.CHEST);
  put(p.x, y0 - 5, p.z, B.PRESSURE_PLATE);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      put(p.x + dx, y0 - 6, p.z + dz, B.TNT);
      put(p.x + dx, y0 - 7, p.z + dz, B.TNT);
    }
  }
}

export function pyramidChests(p) {
  const y = p.baseY + 1 - 5;
  return [
    [p.x + 1, y, p.z], [p.x - 1, y, p.z], [p.x, y, p.z + 1], [p.x, y, p.z - 1],
  ];
}

// ============ Pillager-Outpost ============
export const OUTPOST_REGION = 320;

export function outpostInRegion(ctx, rx, rz) {
  if (ctx.hash3(rx, rz, 601) > 0.45) return null;
  const px = rx * OUTPOST_REGION + 40 + ((ctx.hash3(rx, rz, 602) * (OUTPOST_REGION - 80)) | 0);
  const pz = rz * OUTPOST_REGION + 40 + ((ctx.hash3(rx, rz, 603) * (OUTPOST_REGION - 80)) | 0);
  const baseY = ctx.terrainHeight(px, pz);
  if (baseY < SEA_LEVEL + 1) return null;
  return { x: px, z: pz, baseY };
}

export function rasterizeOutpost(o, put) {
  const y0 = o.baseY + 1;
  const H_TOWER = 11;
  // Turmschaft 5x5 aus Schwarzeiche
  for (let dy = 0; dy < H_TOWER; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        put(o.x + dx, y0 + dy, o.z + dz, edge ? B.DARK_LOG : B.AIR);
      }
    }
  }
  // Innen: Wendel-"Treppe" aus Brettern
  const spiral = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  for (let dy = 0; dy < H_TOWER - 1; dy++) {
    const [sx, sz] = spiral[dy % spiral.length];
    put(o.x + sx, y0 + dy, o.z + sz, B.PLANKS);
  }
  // Plattform oben 7x7 mit Brüstung + Truhe + Fackeln
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      put(o.x + dx, y0 + H_TOWER, o.z + dz, B.PLANKS);
      const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3;
      put(o.x + dx, y0 + H_TOWER + 1, o.z + dz, edge ? B.DARK_LOG : B.AIR);
      put(o.x + dx, y0 + H_TOWER + 2, o.z + dz, B.AIR);
      put(o.x + dx, y0 + H_TOWER + 3, o.z + dz, B.AIR);
    }
  }
  put(o.x + 2, y0 + H_TOWER + 1, o.z + 2, B.CHEST);
  put(o.x - 2, y0 + H_TOWER + 1, o.z - 2, B.TORCH);
  put(o.x + 2, y0 + H_TOWER + 1, o.z - 2, B.TORCH);
  put(o.x - 2, y0 + H_TOWER + 1, o.z + 2, B.TORCH);
  // Eingang unten
  put(o.x + 2, y0, o.z, B.AIR);
  put(o.x + 2, y0 + 1, o.z, B.AIR);
}

export function outpostChest(o) {
  return [o.x + 2, o.baseY + 1 + 12, o.z + 2];
}

// ============ Dungeon (Spawner + Loot) ============
export const DUNGEON_REGION = 96;

export function dungeonInRegion(ctx, rx, rz) {
  if (ctx.hash3(rx, rz, 701) > 0.5) return null;
  const dx = rx * DUNGEON_REGION + 16 + ((ctx.hash3(rx, rz, 702) * (DUNGEON_REGION - 32)) | 0);
  const dz = rz * DUNGEON_REGION + 16 + ((ctx.hash3(rx, rz, 703) * (DUNGEON_REGION - 32)) | 0);
  const surface = ctx.terrainHeight(dx, dz);
  const y = 8 + ((ctx.hash3(rx, rz, 704) * Math.max(4, surface - 22)) | 0);
  const mob = ctx.hash3(rx, rz, 705) < 0.5 ? 'zombie' : 'skeleton';
  return { x: dx, z: dz, y, mob };
}

export function rasterizeDungeon(d, put) {
  const half = 3;
  for (let dx = -half; dx <= half; dx++) {
    for (let dz = -half; dz <= half; dz++) {
      const edge = Math.abs(dx) === half || Math.abs(dz) === half;
      put(d.x + dx, d.y, d.z + dz, (dx + dz) % 2 === 0 ? B.MOSSY_COBBLE : B.COBBLE);
      put(d.x + dx, d.y + 4, d.z + dz, B.COBBLE);
      for (let dy = 1; dy <= 3; dy++) {
        put(d.x + dx, d.y + dy, d.z + dz, edge ? ((dx * 3 + dz + dy) % 3 === 0 ? B.MOSSY_COBBLE : B.COBBLE) : B.AIR);
      }
    }
  }
  put(d.x, d.y + 1, d.z, B.SPAWNER);
  put(d.x + 2, d.y + 1, d.z + 2, B.CHEST);
  put(d.x - 2, d.y + 1, d.z - 2, B.CHEST);
}

export function dungeonChests(d) {
  return [[d.x + 2, d.y + 1, d.z + 2], [d.x - 2, d.y + 1, d.z - 2]];
}

// ============ Mineshaft ============
export const MINESHAFT_REGION = 256;

export function mineshaftInRegion(ctx, rx, rz) {
  if (ctx.hash3(rx, rz, 801) > 0.55) return null;
  const mx = rx * MINESHAFT_REGION + 48 + ((ctx.hash3(rx, rz, 802) * (MINESHAFT_REGION - 96)) | 0);
  const mz = rz * MINESHAFT_REGION + 48 + ((ctx.hash3(rx, rz, 803) * (MINESHAFT_REGION - 96)) | 0);
  const y = 14 + ((ctx.hash3(rx, rz, 804) * 10) | 0);
  // Arme: gewundene Korridore (deterministische Segmentpfade)
  const arms = [];
  const nArms = 3 + ((ctx.hash3(rx, rz, 805) * 3) | 0);
  const chests = [];
  for (let a = 0; a < nArms; a++) {
    let dir = ((ctx.hash3(rx, rz, 810 + a) * 8) | 0) * Math.PI / 4;
    let x = mx, z = mz;
    const cells = [];
    const segs = 4 + ((ctx.hash3(rx, rz, 820 + a) * 4) | 0);
    for (let s = 0; s < segs; s++) {
      const len = 6 + ((ctx.hash3(rx, rz, 830 + a * 8 + s) * 6) | 0);
      const sx = Math.round(Math.cos(dir)), sz = Math.round(Math.sin(dir));
      for (let i = 0; i < len; i++) {
        x += sx; z += sz;
        cells.push([x, z, sx !== 0]); // true = Korridor läuft in X-Richtung
      }
      dir += (ctx.hash3(rx, rz, 870 + a * 8 + s) < 0.5 ? -1 : 1) * Math.PI / 4;
      // Truhe am Segmentende?
      if (ctx.hash3(rx, rz, 900 + a * 8 + s) < 0.18) chests.push([x, y + 1, z]);
    }
    arms.push(cells);
  }
  return { x: mx, z: mz, y, arms, chests };
}

export function rasterizeMineshaft(m, put, hash3) {
  const y = m.y;
  for (const cells of m.arms) {
    for (let ci = 0; ci < cells.length; ci++) {
      const [x, z, alongX] = cells[ci];
      const px = alongX ? 0 : 1, pz = alongX ? 1 : 0; // Querrichtung
      for (let o = -1; o <= 1; o++) {
        const wx = x + px * o, wz = z + pz * o;
        put(wx, y, wz, B.PLANKS);                     // Boden
        for (let dy = 1; dy <= 3; dy++) put(wx, y + dy, wz, B.AIR);
      }
      // Stützrahmen alle 5 Zellen
      if (ci % 5 === 2) {
        put(x + px, y + 1, z + pz, B.LOG); put(x + px, y + 2, z + pz, B.LOG);
        put(x - px, y + 1, z - pz, B.LOG); put(x - px, y + 2, z - pz, B.LOG);
        for (let o = -1; o <= 1; o++) put(x + px * o, y + 3, z + pz * o, B.PLANKS);
        if (hash3(x, z, 910) < 0.35) put(x + px, y + 3, z + pz, B.TORCH);
      }
      // Schienen + Spinnennetze
      if (hash3(x, z, 911) < 0.6) put(x, y + 1, z, B.RAIL);
      if (hash3(x, z, 912) < 0.05) put(x + px, y + 1, z + pz, B.WEB);
      if (hash3(x, z, 913) < 0.04) put(x - px, y + 2, z - pz, B.WEB);
    }
  }
  for (const [cx, cy, cz] of m.chests) put(cx, cy, cz, B.CHEST);
}

// ============ Loot-Zuordnung: welche Truhe gehört zu welcher Struktur? ============
// Wird beim ersten Öffnen einer Welt-Truhe aufgerufen (deterministisch rekonstruierbar).
export function lootTableAt(ctx, x, y, z) {
  const check = (regionSize, finder, spots, table) => {
    const rx0 = Math.floor((x - regionSize) / regionSize), rx1 = Math.floor((x + regionSize) / regionSize);
    const rz0 = Math.floor((z - regionSize) / regionSize), rz1 = Math.floor((z + regionSize) / regionSize);
    for (let rx = rx0; rx <= rx1; rx++) {
      for (let rz = rz0; rz <= rz1; rz++) {
        const s = finder(ctx, rx, rz);
        if (!s) continue;
        for (const [sx, sy, sz] of spots(s)) {
          if (sx === x && sy === y && sz === z) return table;
        }
      }
    }
    return null;
  };

  return (
    check(VILLAGE_REGION, villageInRegion, v => v.houses.map(h => [h.chest.x, h.y + 1, h.chest.z]), 'village') ||
    check(PYRAMID_REGION, pyramidInRegion, pyramidChests, 'pyramid') ||
    check(OUTPOST_REGION, outpostInRegion, o => [outpostChest(o)], 'outpost') ||
    check(DUNGEON_REGION, dungeonInRegion, dungeonChests, 'dungeon') ||
    check(MINESHAFT_REGION, mineshaftInRegion, m => m.chests, 'mineshaft')
  );
}
