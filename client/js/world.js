// Chunk-Verwaltung, Generatoren (Overworld mit 8 Biomen / Nether / End),
// Meshing mit AO, Licht-Vertexattributen, Fluid-Höhen und Spezial-Shapes.

import * as THREE from 'three';
import { CHUNK_SIZE as CS, WORLD_HEIGHT as H, SEA_LEVEL, DEEPSLATE_Y } from './config.js';
import { SETTINGS } from './settings.js';
import { Noise } from './noise.js';
import { B, BLOCK_INFO, tileUV, isWater, isLava, fluidLevel } from './blocks.js';
import { relightChunk, DEFAULT_LIGHT } from './light.js';
import {
  VILLAGE_REGION, villageInRegion, rasterizeHouse, rasterizeVillageExtras,
  PORTAL_REGION, ruinedPortalInRegion, rasterizeRuinedPortal,
  STRONGHOLD_REGION, strongholdInRegion, rasterizeStronghold,
  PYRAMID_REGION, pyramidInRegion, rasterizePyramid,
  OUTPOST_REGION, outpostInRegion, rasterizeOutpost,
  DUNGEON_REGION, dungeonInRegion, rasterizeDungeon,
  MINESHAFT_REGION, mineshaftInRegion, rasterizeMineshaft,
} from './structures.js';

// Das End: zentrale Exit-Portal-Struktur (Portal-Zellen werden erst nach dem
// Drachen-Tod gefüllt), Ankunftsplattform am Inselrand, Obsidiansäulen-Ring.
export const END_EXIT = {
  portalY: 46,
  cells: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
  egg: [0, 50, 0],
  perch: { x: 0.5, y: 50, z: 0.5 },
};
export const END_SPAWN = { x: 43.5, y: 46.01, z: 0.5 };
export const END_PILLARS = [];
for (let k = 0; k < 6; k++) {
  const ang = (k / 6) * Math.PI * 2;
  END_PILLARS.push({ x: Math.round(Math.cos(ang) * 28), z: Math.round(Math.sin(ang) * 28), top: 56 });
}

// Reihenfolge: -X, +X, -Y, +Y, -Z, +Z (CCW von aussen betrachtet)
const FACES = [
  {
    dir: [-1, 0, 0],
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
  },
  {
    dir: [1, 0, 0],
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
  },
  {
    dir: [0, -1, 0],
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  {
    dir: [0, 1, 0],
    corners: [
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 0] },
    ],
  },
  {
    dir: [0, 0, -1],
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 1] },
    ],
  },
  {
    dir: [0, 0, 1],
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
    ],
  },
];

// AO-Nachbaroffsets pro Ecke vorberechnen
for (const face of FACES) {
  const [dx, dy, dz] = face.dir;
  const axis = dx !== 0 ? 0 : dy !== 0 ? 1 : 2;
  const others = [0, 1, 2].filter(a => a !== axis);
  for (const corner of face.corners) {
    const s1 = [dx, dy, dz], s2 = [dx, dy, dz], cc = [dx, dy, dz];
    const d1 = corner.pos[others[0]] === 1 ? 1 : -1;
    const d2 = corner.pos[others[1]] === 1 ? 1 : -1;
    s1[others[0]] += d1; cc[others[0]] += d1;
    s2[others[1]] += d2; cc[others[1]] += d2;
    corner.ao = [s1, s2, cc];
  }
}

const FACE_SHADE = [0.72, 0.72, 0.5, 1.0, 0.85, 0.85];
const AO_CURVE = [0.45, 0.62, 0.8, 1.0];

// Deepslate-Varianten der Erze
const DS_VARIANT = {
  [B.COAL_ORE]: B.DS_COAL, [B.IRON_ORE]: B.DS_IRON, [B.GOLD_ORE]: B.DS_GOLD,
  [B.DIAMOND_ORE]: B.DS_DIAMOND, [B.EMERALD_ORE]: B.DS_EMERALD,
};

export class World {
  // dimension: 'over' | 'nether' | 'end'
  constructor(scene, opaqueMaterial, transMaterial, seed, dimension = 'over') {
    this.scene = scene;
    this.opaqueMaterial = opaqueMaterial;
    this.transMaterial = transMaterial;
    this.seed = seed >>> 0;
    this.dimension = dimension;
    this.noise = new Noise(this.seed + (dimension === 'nether' ? 7777 : dimension === 'end' ? 8888 : 0));
    this.chunks = new Map();
    this.edits = new Map();    // chunkKey -> Map(localIndex -> blockId)
    this.frame = 0;
    this.spawners = new Map(); // "x,y,z" -> { x, y, z }
    this.onBlockChange = null; // Callback (x,y,z,newId) für Fluide/Gravity

    this.structCtx = {
      hash3: (x, z, salt) => this.hash3(x, z, salt),
      terrainHeight: (x, z) => this.terrainHeight(x, z),
      biomeAt: (x, z) => this.biomeAt(x, z),
    };

    this.setRenderDistance(SETTINGS.renderDistance);
  }

  setRenderDistance(r) {
    this.R = r;
    this.offsets = [];
    for (let dx = -(r + 1); dx <= r + 1; dx++) {
      for (let dz = -(r + 1); dz <= r + 1; dz++) {
        const d2 = dx * dx + dz * dz;
        this.offsets.push({ dx, dz, d2, mesh: d2 <= r * r });
      }
    }
    this.offsets.sort((a, b) => a.d2 - b.d2);
  }

  key(cx, cz) { return cx + ',' + cz; }
  idx(x, y, z) { return (y * CS + z) * CS + x; }

  hash3(x, z, salt) {
    let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(salt, 2246822519) ^ this.seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  hash2(x, z) { return this.hash3(x, z, 0); }

  // --- Overworld: Biome + Terrain ---
  mountainNoise(wx, wz) {
    return this.noise.fbm2(wx * 0.004 + 9000, wz * 0.004 + 9000, 3);
  }

  terrainHeight(wx, wz) {
    const cont = this.noise.fbm2(wx * 0.0016 + 100, wz * 0.0016 + 100, 3);
    const hills = this.noise.fbm2(wx * 0.012, wz * 0.012, 4);
    let h = SEA_LEVEL + 4 + cont * 18 + hills * 8;
    // Berge: steile Aufwölbung, wo das Berg-Rauschen hoch ist
    const m = this.mountainNoise(wx, wz);
    if (m > 0.22) {
      const t = Math.min(1, (m - 0.22) / 0.3);
      h += t * t * 38 + hills * 6 * t;
    }
    return Math.max(3, Math.min(H - 8, Math.floor(h)));
  }

  biomeAt(wx, wz) {
    if (this.mountainNoise(wx, wz) > 0.3) return 'mountains';
    const temp = this.noise.fbm2(wx * 0.0022 + 5000, wz * 0.0022 + 5000, 2);
    const moist = this.noise.fbm2(wx * 0.0022 - 5000, wz * 0.0022 - 5000, 2);
    if (temp > 0.28 && moist < 0.1) return 'desert';
    if (temp > 0.18 && moist < 0.28) return 'savanna';
    if (temp < -0.3) return 'snowy';
    if (moist > 0.3) return 'darkforest';
    if (moist > 0.12) return temp < -0.05 ? 'birchforest' : 'forest';
    return 'plains';
  }

  treeDensity(biome) {
    switch (biome) {
      case 'forest': return 0.03;
      case 'birchforest': return 0.028;
      case 'darkforest': return 0.05;
      case 'savanna': return 0.007;
      case 'snowy': return 0.012;
      case 'plains': return 0.004;
      default: return 0;
    }
  }

  treeAt(wx, wz) {
    const d = this.treeDensity(this.biomeAt(wx, wz));
    return d > 0 && this.hash2(wx, wz) < d;
  }

  // Erz-Verteilung: kleine Adern (2er-Zellen), reicher in der Tiefe
  oreAt(wx, y, wz, deep) {
    const cell = (salt) => this.hash3(wx >> 1, ((wz >> 1) * 97 + (y >> 1)) | 0, salt);
    const one = salt => this.hash3(wx, wz * 97 + y, salt);
    const depthBoost = 1 + Math.max(0, (34 - y)) / 40; // tiefer = mehr
    let ore = 0;
    if (y <= 72 && cell(71) < 0.011) ore = B.COAL_ORE;
    else if (y <= 56 && cell(72) < 0.008 * depthBoost) ore = B.IRON_ORE;
    else if (y <= 52 && cell(76) < 0.008) ore = B.GRAVEL;
    else if (y <= 30 && one(73) < 0.0045 * depthBoost) ore = B.GOLD_ORE;
    else if (y <= 18 && one(74) < 0.005 * depthBoost) ore = B.DIAMOND_ORE;
    else if (y <= 34 && one(75) < 0.0018) ore = B.EMERALD_ORE;
    if (!ore) return deep ? B.DEEPSLATE : B.STONE;
    if (ore === B.GRAVEL) return B.GRAVEL;
    return deep ? DS_VARIANT[ore] : ore;
  }

  // Höhlen: "Käse"-Kavernen (grösser in der Tiefe) + gewundene Spaghetti-Tunnel
  carved(wx, y, wz) {
    const cheese = this.noise.perlin3(wx * 0.045, y * 0.08, wz * 0.045);
    const thrC = 0.58 - Math.max(0, (40 - y)) * 0.004; // tiefer = grösser
    if (cheese > thrC) return true;
    const s1 = this.noise.perlin3(wx * 0.03 + 300, y * 0.05, wz * 0.03 + 300);
    const s2 = this.noise.perlin3(wx * 0.03 - 300, y * 0.05, wz * 0.03 - 300);
    return Math.abs(s1) < 0.055 && Math.abs(s2) < 0.055;
  }

  generateChunkData(cx, cz) {
    const data = this.dimension === 'nether' ? this.genNether(cx, cz)
      : this.dimension === 'end' ? this.genEnd(cx, cz)
      : this.genOverworld(cx, cz);

    const em = this.edits.get(this.key(cx, cz));
    if (em) for (const [i, id] of em) data[i] = id;
    return data;
  }

  // put-Helfer: schreibt nur, wenn die Weltkoordinate in diesem Chunk liegt
  makePut(data, baseX, baseZ) {
    return (wx, wy, wz, id, onlyAir = false) => {
      const lx = wx - baseX, lz = wz - baseZ;
      if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || wy < 0 || wy >= H) return;
      const i = (wy * CS + lz) * CS + lx;
      if (onlyAir && data[i] !== B.AIR) return;
      data[i] = id;
    };
  }

  genOverworld(cx, cz) {
    const data = new Uint8Array(CS * H * CS);
    const baseX = cx * CS, baseZ = cz * CS;

    for (let z = 0; z < CS; z++) {
      for (let x = 0; x < CS; x++) {
        const wx = baseX + x, wz = baseZ + z;
        const h = this.terrainHeight(wx, wz);
        const biome = this.biomeAt(wx, wz);
        const beach = h <= SEA_LEVEL + 1;

        let top, fill;
        if (beach || biome === 'desert') { top = B.SAND; fill = B.SAND; }
        else if (biome === 'mountains') { top = h >= SEA_LEVEL + 30 ? B.SNOW_BLOCK : B.STONE; fill = B.STONE; }
        else if (biome === 'snowy') { top = B.SNOWY_GRASS; fill = B.DIRT; }
        else if (biome === 'savanna' && this.hash3(wx, wz, 58) < 0.3) { top = B.COARSE_DIRT; fill = B.DIRT; }
        else { top = B.GRASS; fill = B.DIRT; }

        const deepJitter = ((this.hash3(wx, wz, 59) * 3) | 0);
        const sealed = h <= SEA_LEVEL + 2; // unter Ozeanen nicht bis zur Oberfläche höhlen

        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = B.BEDROCK;
          else if (y === h) id = top;
          else if (y >= h - 3) id = biome === 'desert' && y < h - 1 ? B.SANDSTONE : fill;
          else id = B.STONE;

          if (id === B.STONE) {
            const deep = y < DEEPSLATE_Y + deepJitter;
            const limit = sealed ? h - 5 : h - 3;
            if (y > 2 && y < limit && this.carved(wx, y, wz)) {
              id = y <= 11 ? B.LAVA : B.AIR;
            } else {
              id = this.oreAt(wx, y, wz, deep);
            }
          }
          data[(y * CS + z) * CS + x] = id;
        }
        for (let y = h + 1; y <= SEA_LEVEL; y++) data[(y * CS + z) * CS + x] = B.WATER;

        // Oberflächen-Deko: Kakteen, tote Büsche, Gras, Blumen
        const topIdx = ((h + 1) * CS + z) * CS + x;
        if (h + 1 < H && data[topIdx] === B.AIR) {
          if (biome === 'desert' && !beach) {
            if (this.hash3(wx, wz, 55) < 0.007) {
              const ch = 2 + ((this.hash3(wx, wz, 56) * 2) | 0);
              for (let dy = 1; dy <= ch && h + dy < H; dy++) data[((h + dy) * CS + z) * CS + x] = B.CACTUS;
            } else if (this.hash3(wx, wz, 57) < 0.01) {
              data[topIdx] = B.DEAD_BUSH;
            }
          } else if ((top === B.GRASS || top === B.COARSE_DIRT) && !beach) {
            const r = this.hash3(wx, wz, 61);
            if (biome === 'savanna' && r < 0.015) data[topIdx] = B.DEAD_BUSH;
            else if (r < 0.07) data[topIdx] = B.TALL_GRASS;
            else if (r < 0.082) data[topIdx] = this.hash3(wx, wz, 62) < 0.5 ? B.FLOWER_YELLOW : B.FLOWER_RED;
          }
        }
      }
    }

    // Bäume (mit Rand für überhängende Kronen)
    for (let tz = -3; tz < CS + 3; tz++) {
      for (let tx = -3; tx < CS + 3; tx++) {
        const wx = baseX + tx, wz = baseZ + tz;
        if (!this.treeAt(wx, wz)) continue;
        const h = this.terrainHeight(wx, wz);
        if (h < SEA_LEVEL + 2 || h > SEA_LEVEL + 26) continue;
        const biome = this.biomeAt(wx, wz);
        this.growTree(data, tx, h, tz, biome, wx, wz);
      }
    }

    // Strukturen
    const put = this.makePut(data, baseX, baseZ);
    this.forEachRegion(baseX, baseZ, VILLAGE_REGION, 44, (rx, rz) => {
      const v = villageInRegion(this.structCtx, rx, rz);
      if (!v) return;
      rasterizeVillageExtras(this.structCtx, v, put);
      for (const house of v.houses) rasterizeHouse(house, put);
    });
    this.forEachRegion(baseX, baseZ, PORTAL_REGION, 12, (rx, rz) => {
      const p = ruinedPortalInRegion(this.structCtx, rx, rz);
      if (p) rasterizeRuinedPortal(p, put);
    });
    this.forEachRegion(baseX, baseZ, STRONGHOLD_REGION, 12, (rx, rz) => {
      const s = strongholdInRegion(this.structCtx, rx, rz);
      if (s) rasterizeStronghold(s, put);
    });
    this.forEachRegion(baseX, baseZ, PYRAMID_REGION, 20, (rx, rz) => {
      const p = pyramidInRegion(this.structCtx, rx, rz);
      if (p) rasterizePyramid(p, put);
    });
    this.forEachRegion(baseX, baseZ, OUTPOST_REGION, 12, (rx, rz) => {
      const o = outpostInRegion(this.structCtx, rx, rz);
      if (o) rasterizeOutpost(o, put);
    });
    this.forEachRegion(baseX, baseZ, DUNGEON_REGION, 8, (rx, rz) => {
      const d = dungeonInRegion(this.structCtx, rx, rz);
      if (d) rasterizeDungeon(d, put);
    });
    this.forEachRegion(baseX, baseZ, MINESHAFT_REGION, 64, (rx, rz) => {
      const m = mineshaftInRegion(this.structCtx, rx, rz);
      if (m) rasterizeMineshaft(m, put, (x, z, salt) => this.hash3(x, z, salt));
    });

    return data;
  }

  // Baumformen pro Biom
  growTree(data, tx, h, tz, biome, wx, wz) {
    const put = (lx, ly, lz, id, onlyAir) => {
      if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || ly < 0 || ly >= H) return;
      const i = (ly * CS + lz) * CS + lx;
      if (onlyAir && data[i] !== B.AIR) return;
      data[i] = id;
    };
    const rnd = salt => this.hash3(wx, wz, salt);

    if (biome === 'darkforest') {
      // Schwarzeiche: kurzer dicker Stamm, breite flache Krone
      const trunkH = 4 + ((rnd(60) * 2) | 0);
      for (let dy = 1; dy <= trunkH; dy++) put(tx, h + dy, tz, B.DARK_LOG, false);
      for (let dy = trunkH - 1; dy <= trunkH + 1; dy++) {
        const rad = dy === trunkH + 1 ? 1 : 3;
        for (let ox = -rad; ox <= rad; ox++) {
          for (let oz = -rad; oz <= rad; oz++) {
            if (Math.abs(ox) === rad && Math.abs(oz) === rad && rad > 1) continue;
            put(tx + ox, h + dy, tz + oz, B.DARK_LEAVES, true);
          }
        }
      }
      return;
    }
    if (biome === 'savanna') {
      // Akazie: hoher Stamm, flache Schirm-Krone
      const trunkH = 5 + ((rnd(60) * 2) | 0);
      for (let dy = 1; dy <= trunkH; dy++) put(tx, h + dy, tz, B.ACACIA_LOG, false);
      for (let ox = -2; ox <= 2; ox++) {
        for (let oz = -2; oz <= 2; oz++) {
          if (Math.abs(ox) === 2 && Math.abs(oz) === 2) continue;
          put(tx + ox, h + trunkH, tz + oz, B.ACACIA_LEAVES, true);
          if (Math.abs(ox) <= 1 && Math.abs(oz) <= 1) put(tx + ox, h + trunkH + 1, tz + oz, B.ACACIA_LEAVES, true);
        }
      }
      return;
    }
    // Eiche / Birke
    const isBirch = biome === 'birchforest' || (biome === 'forest' && rnd(63) < 0.2);
    const log = isBirch ? B.BIRCH_LOG : B.LOG;
    const leaves = isBirch ? B.BIRCH_LEAVES : B.LEAVES;
    const trunkH = (isBirch ? 5 : 4) + ((rnd(60) * 3) | 0);
    for (let dy = 1; dy <= trunkH; dy++) put(tx, h + dy, tz, log, false);
    for (let dy = trunkH - 2; dy <= trunkH + 1; dy++) {
      const rad = dy <= trunkH - 1 ? 2 : 1;
      for (let ox = -rad; ox <= rad; ox++) {
        for (let oz = -rad; oz <= rad; oz++) {
          if (ox === 0 && oz === 0 && dy <= trunkH) continue;
          if (rad === 2 && Math.abs(ox) === 2 && Math.abs(oz) === 2) continue;
          if (dy === trunkH + 1 && Math.abs(ox) + Math.abs(oz) > 1) continue;
          put(tx + ox, h + dy, tz + oz, leaves, true);
        }
      }
    }
  }

  genNether(cx, cz) {
    const data = new Uint8Array(CS * H * CS);
    const baseX = cx * CS, baseZ = cz * CS;
    const mid = H / 2;

    for (let z = 0; z < CS; z++) {
      for (let x = 0; x < CS; x++) {
        const wx = baseX + x, wz = baseZ + z;
        for (let y = 0; y < H; y++) {
          let id = B.AIR;
          if (y === 0 || y === H - 1) id = B.BEDROCK;
          else {
            const thr = 0.28 - (Math.abs(y - mid) / mid) * 0.5;
            if (this.noise.perlin3(wx * 0.045, y * 0.05, wz * 0.045) > thr) id = B.NETHERRACK;
            else if (y <= 14) id = B.LAVA;
          }
          data[(y * CS + z) * CS + x] = id;
        }
        // Glowstone unter Decken
        for (let y = mid; y < H - 2; y++) {
          const i = (y * CS + z) * CS + x;
          const above = ((y + 1) * CS + z) * CS + x;
          if (data[i] === B.AIR && data[above] === B.NETHERRACK &&
              this.hash3(wx, wz * 31 + y, 7) < 0.02) {
            data[i] = B.GLOWSTONE;
          }
        }
      }
    }

    return data;
  }

  genEnd(cx, cz) {
    const data = new Uint8Array(CS * H * CS);
    const baseX = cx * CS, baseZ = cz * CS;

    for (let z = 0; z < CS; z++) {
      for (let x = 0; x < CS; x++) {
        const wx = baseX + x, wz = baseZ + z;
        const r = Math.hypot(wx, wz);
        const island = Math.max(0, 1 - r / 60);
        if (island <= 0) continue;
        const n = this.noise.fbm2(wx * 0.03, wz * 0.03, 3);
        const thick = island * (12 + n * 5);
        if (thick <= 0.5) continue;
        const top = Math.floor(40 + thick * 0.25 + n * 2);
        const bottom = Math.max(1, Math.floor(40 - thick * 0.75));
        for (let y = bottom; y <= Math.min(H - 2, top); y++) {
          data[(y * CS + z) * CS + x] = B.END_STONE;
        }
      }
    }

    const put = this.makePut(data, baseX, baseZ);

    for (const p of END_PILLARS) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (dx * dx + dz * dz > 5) continue;
          for (let y = 38; y <= p.top; y++) put(p.x + dx, y, p.z + dz, B.OBSIDIAN);
        }
      }
    }

    // Zentrale Exit-Portal-Struktur (Portal-Zellen bleiben leer bis zum Drachen-Tod)
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        for (let y = 42; y <= 45; y++) put(dx, y, dz, B.END_STONE);
        for (let y = 46; y <= 55; y++) put(dx, y, dz, B.AIR);
      }
    }
    for (let y = 46; y <= 49; y++) put(0, y, 0, B.BEDROCK);

    // Ankunftsplattform (Obsidian) am Inselrand
    for (let dx = 41; dx <= 45; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        put(dx, 45, dz, B.OBSIDIAN);
        for (let dy = 1; dy <= 4; dy++) put(dx, 45 + dy, dz, B.AIR);
      }
    }

    return data;
  }

  forEachRegion(baseX, baseZ, regionSize, margin, cb) {
    const rx0 = Math.floor((baseX - margin) / regionSize);
    const rx1 = Math.floor((baseX + CS + margin) / regionSize);
    const rz0 = Math.floor((baseZ - margin) / regionSize);
    const rz1 = Math.floor((baseZ + CS + margin) / regionSize);
    for (let rx = rx0; rx <= rx1; rx++) {
      for (let rz = rz0; rz <= rz1; rz++) cb(rx, rz);
    }
  }

  // --- Chunk-Verwaltung ---
  createChunk(cx, cz) {
    const c = {
      cx, cz, data: this.generateChunkData(cx, cz),
      mesh: null, transMesh: null, dirty: false, version: 0,
      light: null, lightDirty: true,
    };
    this.chunks.set(this.key(cx, cz), c);
    // Spawner registrieren
    const baseX = cx * CS, baseZ = cz * CS;
    for (let y = 0; y < H; y++) {
      for (let z = 0; z < CS; z++) {
        for (let x = 0; x < CS; x++) {
          if (c.data[(y * CS + z) * CS + x] === B.SPAWNER) {
            const wx = baseX + x, wz = baseZ + z;
            this.spawners.set(wx + ',' + y + ',' + wz, { x: wx, y, z: wz });
          }
        }
      }
    }
    return c;
  }

  ensureChunk(cx, cz) {
    return this.chunks.get(this.key(cx, cz)) || this.createChunk(cx, cz);
  }

  pregenerate(wx, wz, radius) {
    const pcx = Math.floor(wx / CS), pcz = Math.floor(wz / CS);
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) this.ensureChunk(pcx + dx, pcz + dz);
    }
  }

  hasData(wx, wz) {
    return this.chunks.has(this.key(Math.floor(wx / CS), Math.floor(wz / CS)));
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= H) return B.AIR;
    const cx = Math.floor(wx / CS), cz = Math.floor(wz / CS);
    const c = this.chunks.get(this.key(cx, cz));
    if (!c) return B.AIR;
    return c.data[this.idx(wx - cx * CS, wy, wz - cz * CS)];
  }

  // Gepacktes Licht (sky<<4 | block) an Weltkoordinate
  getLight(wx, wy, wz) {
    if (wy >= H) return DEFAULT_LIGHT;
    if (wy < 0) return 0;
    const cx = Math.floor(wx / CS), cz = Math.floor(wz / CS);
    const c = this.chunks.get(this.key(cx, cz));
    if (!c || !c.light) return DEFAULT_LIGHT;
    return c.light[this.idx(wx - cx * CS, wy, wz - cz * CS)];
  }

  setBlock(wx, wy, wz, id) {
    if (wy < 1 || wy >= H) return false;
    const cx = Math.floor(wx / CS), cz = Math.floor(wz / CS);
    const k = this.key(cx, cz);
    const c = this.chunks.get(k) || this.createChunk(cx, cz);
    const lx = wx - cx * CS, lz = wz - cz * CS;
    const i = this.idx(lx, wy, lz);
    if (c.data[i] === id || c.data[i] === B.BEDROCK) return false;
    const old = c.data[i];
    c.data[i] = id;

    let em = this.edits.get(k);
    if (!em) { em = new Map(); this.edits.set(k, em); }
    em.set(i, id);

    // Spawner-Registry pflegen
    if (old === B.SPAWNER) this.spawners.delete(wx + ',' + wy + ',' + wz);
    if (id === B.SPAWNER) this.spawners.set(wx + ',' + wy + ',' + wz, { x: wx, y: wy, z: wz });

    c.dirty = true;
    c.lightDirty = true;
    const mark = (ncx, ncz) => {
      const n = this.chunks.get(this.key(ncx, ncz));
      if (n) { if (n.mesh) n.dirty = true; n.lightDirty = true; }
    };
    // Licht reicht bis 14 Blöcke: Nachbarn grosszügig neu beleuchten/mesher
    if (lx <= 13) mark(cx - 1, cz);
    if (lx >= CS - 14) mark(cx + 1, cz);
    if (lz <= 13) mark(cx, cz - 1);
    if (lz >= CS - 14) mark(cx, cz + 1);
    if (lx <= 13 && lz <= 13) mark(cx - 1, cz - 1);
    if (lx <= 13 && lz >= CS - 14) mark(cx - 1, cz + 1);
    if (lx >= CS - 14 && lz <= 13) mark(cx + 1, cz - 1);
    if (lx >= CS - 14 && lz >= CS - 14) mark(cx + 1, cz + 1);

    if (this.onBlockChange) this.onBlockChange(wx, wy, wz, id, old);
    return true;
  }

  findGround(wx, wz) {
    for (let y = H - 1; y >= 0; y--) {
      if (BLOCK_INFO[this.getBlock(wx, y, wz)].solid) return y;
    }
    return 0;
  }

  findFloor(wx, wz, fromY = H - 2) {
    for (let y = Math.min(fromY, H - 3); y >= 1; y--) {
      if (BLOCK_INFO[this.getBlock(wx, y, wz)].solid &&
          !BLOCK_INFO[this.getBlock(wx, y + 1, wz)].solid &&
          !BLOCK_INFO[this.getBlock(wx, y + 2, wz)].solid) return y;
    }
    return -1;
  }

  serializeEdits() {
    const out = {};
    for (const [k, em] of this.edits) out[k] = [...em];
    return out;
  }

  loadEdits(obj) {
    this.edits.clear();
    if (!obj) return;
    for (const k of Object.keys(obj)) {
      this.edits.set(k, new Map(obj[k]));
    }
  }

  neighborsHaveData(cx, cz) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (!this.chunks.has(this.key(cx + dx, cz + dz))) return false;
      }
    }
    return true;
  }

  update(px, pz) {
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);
    const R = this.R;

    let rebuilds = 0;
    for (const c of this.chunks.values()) {
      if (c.dirty && rebuilds < 6) { this.buildMesh(c); rebuilds++; }
    }

    let dataBudget = 6, meshBudget = 2;
    for (const o of this.offsets) {
      if (dataBudget <= 0 && meshBudget <= 0) break;
      const cx = pcx + o.dx, cz = pcz + o.dz;
      let c = this.chunks.get(this.key(cx, cz));
      if (!c) {
        if (dataBudget <= 0) continue;
        c = this.createChunk(cx, cz);
        dataBudget--;
      }
      if (o.mesh && !c.mesh && meshBudget > 0 && this.neighborsHaveData(cx, cz)) {
        this.buildMesh(c);
        meshBudget--;
      }
    }

    if (++this.frame % 90 === 0) {
      for (const [k, c] of this.chunks) {
        if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > R + 2) {
          this.disposeChunk(k, c);
        }
      }
    }
  }

  disposeChunk(k, c) {
    if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); }
    if (c.transMesh) { this.scene.remove(c.transMesh); c.transMesh.geometry.dispose(); }
    const baseX = c.cx * CS, baseZ = c.cz * CS;
    for (const key of [...this.spawners.keys()]) {
      const [sx, , sz] = key.split(',').map(Number);
      if (sx >= baseX && sx < baseX + CS && sz >= baseZ && sz < baseZ + CS) this.spawners.delete(key);
    }
    this.chunks.delete(k);
  }

  disposeAll() {
    for (const [k, c] of [...this.chunks]) this.disposeChunk(k, c);
  }

  buildMesh(c) {
    if (c.lightDirty) relightChunk(this, c);
    const { cx, cz, data } = c;
    const baseX = cx * CS, baseZ = cz * CS;
    // o = opak (mit AlphaTest), t = transluzent (Wasser/Glas/Portal)
    const o = { pos: [], col: [], uv: [], lit: [], ind: [] };
    const t = { pos: [], col: [], uv: [], lit: [], ind: [] };

    const get = (lx, ly, lz) => {
      if (ly < 0 || ly >= H) return B.AIR;
      if (lx >= 0 && lx < CS && lz >= 0 && lz < CS) return data[(ly * CS + lz) * CS + lx];
      return this.getBlock(baseX + lx, ly, baseZ + lz);
    };
    const opq = (lx, ly, lz) => BLOCK_INFO[get(lx, ly, lz)].opaque;
    const getL = (lx, ly, lz) => {
      if (ly >= H) return DEFAULT_LIGHT;
      if (ly < 0) return 0;
      if (lx >= 0 && lx < CS && lz >= 0 && lz < CS && c.light) return c.light[(ly * CS + lz) * CS + lx];
      return this.getLight(baseX + lx, ly, baseZ + lz);
    };

    // Quad-Helfer: 4 Ecken [x,y,z,u,v], Licht gepackt, doppelseitig optional
    const quad = (tgt, corners, tile, shade, litPacked, alpha, doubleSide = false) => {
      const sky = (litPacked >> 4) / 15, blk = (litPacked & 15) / 15;
      const vi = tgt.pos.length / 3;
      for (const [px2, py, pz2, u, v] of corners) {
        tgt.pos.push(px2, py, pz2);
        const [uu, vv] = tileUV(tile, u, v);
        tgt.uv.push(uu, vv);
        if (tgt === t) tgt.col.push(shade, shade, shade, alpha);
        else tgt.col.push(shade, shade, shade);
        tgt.lit.push(sky, blk);
      }
      tgt.ind.push(vi, vi + 1, vi + 2, vi + 2, vi + 1, vi + 3);
      if (doubleSide) tgt.ind.push(vi + 2, vi + 1, vi, vi + 3, vi + 1, vi + 2);
    };

    // Achsenparallele Box (für Fackel/Tür/Bett): bounds in Blockkoordinaten 0..1
    const emitBox = (tgt, x, y, z, x0, y0, z0, x1, y1, z1, tiles, litPacked, alpha = 1) => {
      for (let f = 0; f < 6; f++) {
        const face = FACES[f];
        const tile = f === 3 ? tiles.top : f === 2 ? tiles.bottom : tiles.side;
        const shade = FACE_SHADE[f];
        const cs = face.corners.map(cn => [
          x + (cn.pos[0] ? x1 : x0),
          y + (cn.pos[1] ? y1 : y0),
          z + (cn.pos[2] ? z1 : z0),
          cn.uv[0], cn.uv[1],
        ]);
        quad(tgt, cs, tile, shade, litPacked, alpha);
      }
    };

    for (let y = 0; y < H; y++) {
      for (let z = 0; z < CS; z++) {
        for (let x = 0; x < CS; x++) {
          const id = data[(y * CS + z) * CS + x];
          if (id === B.AIR) continue;
          const info = BLOCK_INFO[id];
          const ownLight = getL(x, y, z);

          // --- Spezial-Shapes ---
          if (info.type === 'cross') {
            const tl = info.tiles.side;
            quad(o, [[x, y + 1, z, 0, 1], [x, y, z, 0, 0], [x + 1, y + 1, z + 1, 1, 1], [x + 1, y, z + 1, 1, 0]], tl, 1, ownLight, 1, true);
            quad(o, [[x + 1, y + 1, z, 0, 1], [x + 1, y, z, 0, 0], [x, y + 1, z + 1, 1, 1], [x, y, z + 1, 1, 0]], tl, 1, ownLight, 1, true);
            continue;
          }
          if (info.type === 'torch') {
            emitBox(o, x, y, z, 0.4375, 0, 0.4375, 0.5625, 0.65, 0.5625, info.tiles, ownLight);
            continue;
          }
          if (info.type === 'flat') {
            const tl = info.tiles.side;
            quad(o, [[x, y + 0.06, z + 1, 1, 1], [x + 1, y + 0.06, z + 1, 0, 1], [x, y + 0.06, z, 1, 0], [x + 1, y + 0.06, z, 0, 0]], tl, 1, ownLight, 1, true);
            continue;
          }
          if (info.type === 'door') {
            const open = id === B.DOOR_L_OPEN || id === B.DOOR_U_OPEN;
            if (open) emitBox(o, x, y, z, 0, 0, 0, 0.1875, 1, 1, info.tiles, ownLight);
            else emitBox(o, x, y, z, 0, 0, 0, 1, 1, 0.1875, info.tiles, ownLight);
            continue;
          }
          if (info.type === 'bed') {
            emitBox(o, x, y, z, 0, 0, 0, 1, 0.5625, 1, info.tiles, ownLight);
            continue;
          }
          if (info.type === 'fluid') {
            const kind = info.fluid.kind;
            const sameKind = kind === 'water' ? isWater : isLava;
            const lvl = fluidLevel(id);
            const hgt = 0.875 * lvl / 8 + 0.06;
            const tgt = info.trans ? t : o;
            const tl = info.tiles.side;
            const shadeTop = FACE_SHADE[3];
            const above = get(x, y + 1, z);
            const topLight = getL(x, y + 1, z);
            if (!sameKind(above)) {
              quad(tgt, [[x, y + hgt, z + 1, 1, 1], [x + 1, y + hgt, z + 1, 0, 1], [x, y + hgt, z, 1, 0], [x + 1, y + hgt, z, 0, 0]], tl, shadeTop, topLight, info.alpha, true);
            }
            // Seiten + Boden
            for (let f = 0; f < 6; f++) {
              if (f === 3) continue;
              const face = FACES[f];
              const nb = get(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
              if (sameKind(nb) || BLOCK_INFO[nb].opaque) continue;
              const lit = getL(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
              const cs = face.corners.map(cn => [
                x + cn.pos[0], y + (cn.pos[1] ? hgt : 0), z + cn.pos[2],
                cn.uv[0], cn.uv[1],
              ]);
              quad(tgt, cs, tl, FACE_SHADE[f], lit, info.alpha, info.trans);
            }
            continue;
          }

          // --- Transluzente Würfel (Glas, Portal) ---
          if (info.trans) {
            for (let f = 0; f < 6; f++) {
              const face = FACES[f];
              const nb = get(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
              if (nb === id || BLOCK_INFO[nb].opaque) continue;
              const lit = getL(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
              const tile = f === 3 ? info.tiles.top : f === 2 ? info.tiles.bottom : info.tiles.side;
              const cs = face.corners.map(cn => [x + cn.pos[0], y + cn.pos[1], z + cn.pos[2], cn.uv[0], cn.uv[1]]);
              quad(t, cs, tile, FACE_SHADE[f], lit, info.alpha, true);
            }
            continue;
          }

          // --- Opake Würfel mit AO ---
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nb = get(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
            if (BLOCK_INFO[nb].opaque) continue;

            const tile = f === 3 ? info.tiles.top : f === 2 ? info.tiles.bottom : info.tiles.side;
            const shade = FACE_SHADE[f];
            const lit = getL(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
            const sky = (lit >> 4) / 15, blk = (lit & 15) / 15;
            const vi = o.pos.length / 3;
            const ao = [0, 0, 0, 0];

            for (let ci = 0; ci < 4; ci++) {
              const corner = face.corners[ci];
              o.pos.push(x + corner.pos[0], y + corner.pos[1], z + corner.pos[2]);
              const [u, v] = tileUV(tile, corner.uv[0], corner.uv[1]);
              o.uv.push(u, v);
              const oo = corner.ao;
              const s1 = opq(x + oo[0][0], y + oo[0][1], z + oo[0][2]) ? 1 : 0;
              const s2 = opq(x + oo[1][0], y + oo[1][1], z + oo[1][2]) ? 1 : 0;
              const cnr = opq(x + oo[2][0], y + oo[2][1], z + oo[2][2]) ? 1 : 0;
              const a = (s1 && s2) ? 0 : 3 - (s1 + s2 + cnr);
              ao[ci] = a;
              const b = shade * AO_CURVE[a];
              o.col.push(b, b, b);
              o.lit.push(sky, blk);
            }
            if (ao[0] + ao[3] > ao[1] + ao[2]) o.ind.push(vi, vi + 1, vi + 3, vi, vi + 3, vi + 2);
            else o.ind.push(vi, vi + 1, vi + 2, vi + 2, vi + 1, vi + 3);
          }
        }
      }
    }

    if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
    if (c.transMesh) { this.scene.remove(c.transMesh); c.transMesh.geometry.dispose(); c.transMesh = null; }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
    geo.setAttribute('aLight', new THREE.Float32BufferAttribute(o.lit, 2));
    geo.setIndex(o.ind);
    const mesh = new THREE.Mesh(geo, this.opaqueMaterial);
    mesh.position.set(baseX, 0, baseZ);
    this.scene.add(mesh);
    c.mesh = mesh;

    if (t.pos.length) {
      const tgeo = new THREE.BufferGeometry();
      tgeo.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3));
      tgeo.setAttribute('color', new THREE.Float32BufferAttribute(t.col, 4));
      tgeo.setAttribute('uv', new THREE.Float32BufferAttribute(t.uv, 2));
      tgeo.setAttribute('aLight', new THREE.Float32BufferAttribute(t.lit, 2));
      tgeo.setIndex(t.ind);
      const tmesh = new THREE.Mesh(tgeo, this.transMaterial);
      tmesh.position.set(baseX, 0, baseZ);
      this.scene.add(tmesh);
      c.transMesh = tmesh;
    }

    c.dirty = false;
    c.version++;
  }

  // Voxel-Raycast (DDA); trifft solide und anvisierbare Blöcke (Fackeln, Türen...)
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tmx = dx !== 0 ? (dx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity;
    let tmy = dy !== 0 ? (dy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity;
    let tmz = dz !== 0 ? (dz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
    let t = 0, nx = 0, ny = 0, nz = 0;

    while (t <= maxDist) {
      if (tmx < tmy && tmx < tmz) { x += stepX; t = tmx; tmx += tdx; nx = -stepX; ny = 0; nz = 0; }
      else if (tmy < tmz) { y += stepY; t = tmy; tmy += tdy; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -stepZ; }
      if (t > maxDist) break;
      const id = this.getBlock(x, y, z);
      const info = BLOCK_INFO[id];
      if (info.solid || info.ray) return { x, y, z, nx, ny, nz, id, dist: t };
    }
    return null;
  }
}
