// Entities: generische Physik, Mobs (Modelle + KI + Pack-Skins), Item-Drops,
// Projektile, TNT, fallende Blöcke, Eisengolem, End-Kristalle und der Enderdrache.
// Mob-Texturen: offizielles Skin-Layout wird auf die Box-Modelle gemappt;
// fehlt eine Textur im aktiven Pack, gibt es das Magenta-Schachbrett.

import * as THREE from 'three';
import { B, BLOCK_INFO, isWater } from './blocks.js';
import { GRAVITY, WORLD_HEIGHT } from './config.js';
import { I, itemIcon, dropsForBlock } from './items.js';
import { getEntitySkin } from './texpack.js';

const EPS = 1e-3;

// --- Generische AABB-Kollision (Füsse = pos, x/z = Mitte) ---
function axisMove(world, e, axis, d) {
  if (d === 0) return;
  const p = e.pos;
  const hw = e.w / 2;
  if (axis === 0) p.x += d;
  else if (axis === 1) p.y += d;
  else p.z += d;

  const x0 = Math.floor(p.x - hw), x1 = Math.floor(p.x + hw);
  const y0 = Math.max(0, Math.floor(p.y)), y1 = Math.min(WORLD_HEIGHT - 1, Math.floor(p.y + e.h));
  const z0 = Math.floor(p.z - hw), z1 = Math.floor(p.z + hw);

  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (!BLOCK_INFO[world.getBlock(x, y, z)].solid) continue;
        if (d > 0) {
          if (axis === 0) p.x = x - hw - EPS;
          else if (axis === 1) p.y = y - e.h - EPS;
          else p.z = z - hw - EPS;
        } else {
          if (axis === 0) p.x = x + 1 + hw + EPS;
          else if (axis === 1) { p.y = y + 1 + EPS; e.onGround = true; }
          else p.z = z + 1 + hw + EPS;
        }
        if (axis === 0) { e.vel.x = 0; e.hitWall = true; }
        else if (axis === 1) e.vel.y = 0;
        else { e.vel.z = 0; e.hitWall = true; }
        return;
      }
    }
  }
}

export function moveWithCollision(world, e, dt) {
  e.onGround = false;
  e.hitWall = false;
  const mx = e.vel.x * dt, my = e.vel.y * dt, mz = e.vel.z * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(my), Math.abs(mz)) / 0.4));
  for (let i = 0; i < steps; i++) {
    axisMove(world, e, 1, my / steps);
    axisMove(world, e, 0, mx / steps);
    axisMove(world, e, 2, mz / steps);
  }
}

export class Entity {
  constructor(x, y, z, w, h) {
    this.pos = { x, y, z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.w = w;
    this.h = h;
    this.onGround = false;
    this.hitWall = false;
    this.dead = false;
    this.age = 0;
    this.group = null;
    this.hittable = false;
  }

  inWater(world) {
    return isWater(world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + this.h * 0.5), Math.floor(this.pos.z)));
  }

  distTo(p) {
    return Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
  }

  dispose(scene) {
    if (this.group) scene.remove(this.group);
  }
}

// ============ Texturen: Skin-Mapping ============

const skinTexCache = new Map();
function skinTexture(type) {
  if (skinTexCache.has(type)) return skinTexCache.get(type);
  const skin = getEntitySkin(type);
  let entry = null;
  if (skin) {
    const tex = new THREE.CanvasTexture(skin.canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    entry = { tex, w: skin.canvas.width, h: skin.canvas.height };
  }
  // Fehlt der Skin im Pack (z. B. Blaze in modernen Packs), bleibt entry null
  // und buildModel nutzt das prozedurale Farbmodell statt des Magenta-Platzhalters.
  skinTexCache.set(type, entry);
  return entry;
}
export function clearSkinCache() { skinTexCache.clear(); }

// UV-Rechtecke im Minecraft-Skin-Layout auf eine BoxGeometry mappen
// (u,v) = obere linke Ecke, (sx,sy,sz) = Boxgrösse in Texturpixeln
function mapBoxUV(geo, texW, texH, u, v, sx, sy, sz) {
  const rects = [
    [u + sx + sz, v + sz, sz, sy],       // +X
    [u, v + sz, sz, sy],                 // -X
    [u + sz, v, sx, sz],                 // +Y (oben)
    [u + sz + sx, v, sx, sz],            // -Y (unten)
    [u + sz, v + sz, sx, sy],            // +Z (vorne)
    [u + 2 * sz + sx, v + sz, sx, sy],   // -Z (hinten)
  ];
  const uv = geo.getAttribute('uv');
  for (let f = 0; f < 6; f++) {
    const [rx, ry, rw, rh] = rects[f];
    const u0 = rx / texW, u1 = (rx + rw) / texW;
    const v1 = 1 - ry / texH, v0 = 1 - (ry + rh) / texH;
    const o = f * 4;
    uv.setXY(o + 0, u0, v1);
    uv.setXY(o + 1, u1, v1);
    uv.setXY(o + 2, u0, v0);
    uv.setXY(o + 3, u1, v0);
  }
  uv.needsUpdate = true;
}

// Skin-Teilspezifikationen (u,v,sx,sy,sz) pro Mob-Typ
const SKIN_PARTS = {
  zombie: { head: [0, 0, 8, 8, 8], body: [16, 16, 8, 12, 4], arm: [40, 16, 4, 12, 4], leg: [0, 16, 4, 12, 4] },
  skeleton: { head: [0, 0, 8, 8, 8], body: [16, 16, 8, 12, 4], arm: [40, 16, 2, 12, 2], leg: [0, 16, 2, 12, 2] },
  villager: { head: [0, 0, 8, 10, 8], body: [16, 20, 8, 12, 6], arm: [44, 22, 4, 8, 4], leg: [0, 22, 4, 12, 4] },
  creeper: { head: [0, 0, 8, 8, 8], body: [16, 16, 8, 12, 4], leg: [0, 16, 4, 6, 4] },
  enderman: { head: [0, 0, 8, 8, 8], body: [32, 16, 8, 12, 4], arm: [56, 0, 2, 30, 2], leg: [56, 0, 2, 30, 2] },
  cow: { head: [0, 0, 8, 8, 6], body: [18, 4, 12, 18, 10], leg: [0, 16, 4, 12, 4] },
  sheep: { head: [0, 0, 8, 6, 6], body: [28, 8, 8, 16, 6], leg: [0, 16, 4, 12, 4] },
  golem: { head: [0, 0, 8, 10, 8], body: [0, 40, 18, 12, 11], arm: [60, 21, 4, 30, 6], leg: [37, 0, 6, 16, 5] },
  blaze: { head: [0, 0, 8, 8, 8], body: [0, 16, 2, 8, 2], leg: [0, 16, 2, 8, 2] },
};

// --- Item-Drop-Sprites ---
const spriteMatCache = new Map();
function spriteMaterialFor(itemId, atlasCanvas) {
  if (spriteMatCache.has(itemId)) return spriteMatCache.get(itemId);
  const tex = new THREE.CanvasTexture(itemIcon(itemId, atlasCanvas));
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  spriteMatCache.set(itemId, mat);
  return mat;
}
export function clearSpriteCache() { spriteMatCache.clear(); }

export class ItemDrop extends Entity {
  constructor(itemId, count, x, y, z, atlasCanvas, dur = undefined) {
    super(x, y, z, 0.25, 0.25);
    this.itemId = itemId;
    this.count = count;
    this.dur = dur;
    this.pickupDelay = 0.5;   // Sekunden bis aufsammelbar (Q-Drop: 1.5)
    this.vel.x = (Math.random() - 0.5) * 3;
    this.vel.y = 4 + Math.random() * 2;
    this.vel.z = (Math.random() - 0.5) * 3;
    this.group = new THREE.Sprite(spriteMaterialFor(itemId, atlasCanvas));
    this.group.scale.set(0.4, 0.4, 0.4);
  }

  tick(dt, game) {
    this.age += dt;
    if (this.age > 300) { this.dead = true; return; }
    this.vel.y += GRAVITY * 0.7 * dt;
    this.vel.x *= 1 - Math.min(1, 4 * dt);
    this.vel.z *= 1 - Math.min(1, 4 * dt);
    if (this.inWater(game.world)) this.vel.y = Math.max(this.vel.y, 1.5);
    moveWithCollision(game.world, this, dt);
    // Magnet zum Spieler (erst nach Ablauf des Pickup-Cooldowns)
    const p = game.player;
    if (!p.dead && this.age > this.pickupDelay) {
      const dx = p.pos.x - this.pos.x, dy = (p.pos.y + 0.8) - this.pos.y, dz = p.pos.z - this.pos.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 1.8 && d > 0.01) {
        this.pos.x += (dx / d) * 5 * dt;
        this.pos.y += (dy / d) * 5 * dt;
        this.pos.z += (dz / d) * 5 * dt;
      }
    }
    this.group.position.set(this.pos.x, this.pos.y + 0.25 + Math.sin(this.age * 2.5) * 0.06, this.pos.z);
  }
}

// --- Pfeil (Skelett ODER Spieler) ---
export class Arrow extends Entity {
  constructor(x, y, z, vx, vy, vz, fromPlayer = false) {
    super(x, y, z, 0.1, 0.1);
    this.vel = { x: vx, y: vy, z: vz };
    this.fromPlayer = fromPlayer;
    const geo = new THREE.BoxGeometry(0.06, 0.06, 0.55);
    const mat = new THREE.MeshLambertMaterial({ color: 0x6b5a3e });
    this.group = new THREE.Mesh(geo, mat);
  }

  tick(dt, game) {
    this.age += dt;
    if (this.age > 8) { this.dead = true; return; }
    this.vel.y -= 12 * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;
    if (BLOCK_INFO[game.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z))].solid) {
      this.dead = true;
      return;
    }
    if (this.fromPlayer) {
      // Trifft Mobs
      for (const e of game.entities) {
        if (!e.hittable || e.dead) continue;
        const hw = e.w / 2 + 0.15;
        if (Math.abs(this.pos.x - e.pos.x) < hw && Math.abs(this.pos.z - e.pos.z) < hw &&
            this.pos.y > e.pos.y - 0.1 && this.pos.y < e.pos.y + e.h + 0.2) {
          const d = Math.hypot(this.vel.x, this.vel.z) || 1;
          e.hurt(6, this.vel.x / d * 5, this.vel.z / d * 5, game);
          if (game.sound) game.sound.mobHurt();
          this.dead = true;
          return;
        }
      }
    } else {
      const p = game.player;
      if (!p.dead && !p.creative &&
          Math.abs(this.pos.x - p.pos.x) < 0.45 &&
          Math.abs(this.pos.z - p.pos.z) < 0.45 &&
          this.pos.y > p.pos.y && this.pos.y < p.pos.y + p.h) {
        const d = Math.hypot(this.vel.x, this.vel.z) || 1;
        p.hurt(3, this.vel.x / d * 4, this.vel.z / d * 4);
        this.dead = true;
        return;
      }
    }
    this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.group.lookAt(this.pos.x + this.vel.x, this.pos.y + this.vel.y, this.pos.z + this.vel.z);
  }
}

// --- Feuerball (Blaze) ---
export class Fireball extends Entity {
  constructor(x, y, z, vx, vy, vz) {
    super(x, y, z, 0.3, 0.3);
    this.vel = { x: vx, y: vy, z: vz };
    this.group = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffa020 })
    );
  }

  tick(dt, game) {
    this.age += dt;
    if (this.age > 6) { this.dead = true; return; }
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;
    if (BLOCK_INFO[game.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z))].solid) {
      this.dead = true;
      return;
    }
    const p = game.player;
    if (!p.dead && !p.creative &&
        Math.abs(this.pos.x - p.pos.x) < 0.5 &&
        Math.abs(this.pos.z - p.pos.z) < 0.5 &&
        this.pos.y > p.pos.y - 0.2 && this.pos.y < p.pos.y + p.h + 0.2) {
      const d = Math.hypot(this.vel.x, this.vel.z) || 1;
      p.hurt(5, this.vel.x / d * 5, this.vel.z / d * 5);
      this.dead = true;
      return;
    }
    const s = 1 + Math.sin(this.age * 20) * 0.15;
    this.group.scale.set(s, s, s);
    this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
  }
}

// --- Fliegendes Enderauge ---
export class EyeFlyer extends Entity {
  constructor(x, y, z, dx, dz, atlasCanvas) {
    super(x, y, z, 0.2, 0.2);
    const d = Math.hypot(dx, dz) || 1;
    this.vel = { x: dx / d * 7, y: 3, z: dz / d * 7 };
    this.group = new THREE.Sprite(spriteMaterialFor(I.ENDER_EYE, atlasCanvas));
    this.group.scale.set(0.35, 0.35, 0.35);
  }

  tick(dt) {
    this.age += dt;
    if (this.age > 3) { this.dead = true; return; }
    if (this.age > 1) this.vel.y = 0.5;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;
    this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
  }
}

// --- Explosionseffekt (rein visuell) ---
export class Explosion extends Entity {
  constructor(x, y, z, radius) {
    super(x, y, z, 0, 0);
    this.radius = radius;
    this.life = 0.35;
    this.group = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.85 })
    );
    this.group.position.set(x, y, z);
  }

  tick(dt) {
    this.age += dt;
    const t = this.age / this.life;
    if (t >= 1) { this.dead = true; return; }
    const s = 0.3 + t * this.radius * 1.3;
    this.group.scale.set(s, s, s);
    this.group.material.opacity = 0.85 * (1 - t);
  }
}

// --- Fallender Block (Sand/Kies) ---
export class FallingBlock extends Entity {
  constructor(blockId, x, y, z, blockMaterialFor) {
    super(x + 0.5, y, z + 0.5, 0.98, 0.98);
    this.blockId = blockId;
    this.group = blockMaterialFor(blockId);
    this.group.position.set(this.pos.x, this.pos.y + 0.5, this.pos.z);
  }

  tick(dt, game) {
    this.age += dt;
    this.vel.y += GRAVITY * dt;
    this.vel.y = Math.max(this.vel.y, -30);
    moveWithCollision(game.world, this, dt);
    if (this.onGround || this.age > 10) {
      this.dead = true;
      const bx = Math.floor(this.pos.x), by = Math.round(this.pos.y), bz = Math.floor(this.pos.z);
      const cur = game.world.getBlock(bx, by, bz);
      if (!BLOCK_INFO[cur].solid) {
        game.world.setBlock(bx, by, bz, this.blockId);
      } else {
        // kein Platz: als Item droppen
        for (const d of dropsForBlock(this.blockId)) game.spawnDrop(d.id, d.count, this.pos.x, this.pos.y + 0.5, this.pos.z);
      }
      return;
    }
    this.group.position.set(this.pos.x, this.pos.y + 0.49, this.pos.z);
  }
}

// --- Gezündetes TNT ---
export class PrimedTNT extends Entity {
  constructor(x, y, z, blockMaterialFor, fuse = 3) {
    super(x + 0.5, y, z + 0.5, 0.98, 0.98);
    this.fuse = fuse;
    this.group = blockMaterialFor(B.TNT);
    this.vel.y = 3;
  }

  tick(dt, game) {
    this.age += dt;
    this.fuse -= dt;
    this.vel.y += GRAVITY * dt;
    moveWithCollision(game.world, this, dt);
    if (this.fuse <= 0) {
      this.dead = true;
      game.explode(this.pos.x, this.pos.y + 0.5, this.pos.z, 4);
      return;
    }
    // Blinken
    const flash = Math.sin(this.fuse * 12) > 0;
    const s = flash ? 1.05 : 0.95;
    this.group.scale.set(s, s, s);
    this.group.position.set(this.pos.x, this.pos.y + 0.49, this.pos.z);
  }
}

// ============ Mob-Definitionen ============
export const MOB_TYPES = {
  zombie: {
    name: 'Zombie', w: 0.6, h: 1.9, hp: 20, speed: 2.3, hostile: true,
    damage: 4, attackRange: 1.7, aggro: 22, targetsVillagers: true,
    drops: [{ id: I.FLESH, min: 0, max: 2 }],
  },
  skeleton: {
    name: 'Skelett', w: 0.6, h: 1.9, hp: 20, speed: 2.2, hostile: true, ranged: true,
    aggro: 24,
    drops: [{ id: I.BONE, min: 0, max: 2 }, { id: I.ARROW, min: 0, max: 2 }],
  },
  creeper: {
    name: 'Creeper', w: 0.6, h: 1.7, hp: 20, speed: 2.6, hostile: true, exploder: true,
    aggro: 20,
    drops: [{ id: I.GUNPOWDER, min: 0, max: 2 }],
  },
  sheep: {
    name: 'Schaf', w: 0.9, h: 1.3, hp: 8, speed: 1.7, hostile: false,
    drops: [{ id: I.MUTTON, min: 1, max: 2 }, { id: B.WOOL, min: 1, max: 2 }],
  },
  cow: {
    name: 'Kuh', w: 0.9, h: 1.4, hp: 10, speed: 1.6, hostile: false,
    drops: [{ id: I.BEEF, min: 1, max: 3 }, { id: I.LEATHER, min: 0, max: 2 }],
  },
  villager: {
    name: 'Dorfbewohner', w: 0.6, h: 1.9, hp: 20, speed: 2.0, hostile: false, persist: true, villager: true,
    drops: [{ id: I.EMERALD, min: 0, max: 1 }],
  },
  golem: {
    name: 'Eisengolem', w: 1.2, h: 2.6, hp: 80, speed: 1.7, hostile: false, persist: true, golem: true,
    damage: 12, attackRange: 2.2,
    drops: [{ id: I.IRON_INGOT, min: 3, max: 5 }],
  },
  enderman: {
    name: 'Enderman', w: 0.6, h: 2.9, hp: 40, speed: 4.0, hostile: false, enderman: true,
    damage: 7, attackRange: 1.9,
    drops: [{ id: I.ENDER_PEARL, min: 1, max: 2 }],
  },
  blaze: {
    name: 'Lohe', w: 0.6, h: 1.8, hp: 20, speed: 2.0, hostile: true, blaze: true,
    aggro: 28,
    drops: [{ id: I.BLAZE_ROD, min: 1, max: 2 }],
  },
};

// --- Gesichter für den Farb-Fallback (8x8 Pixel) ---
const FACE_ART = {
  zombie: {
    bg: '#4a7a3a',
    p: { e: '#1a1a1a', m: '#2e4a24' },
    rows: ['........', '.ee..ee.', '.ee..ee.', '........', '...mm...', '..mmmm..', '..m..m..', '........'],
  },
  skeleton: {
    bg: '#c8c8c8',
    p: { e: '#3a3a3a', n: '#8a8a8a', m: '#5a5a5a' },
    rows: ['........', 'ee.ee.ee', 'ee.ee.ee', '...nn...', '........', 'm.m.m.m.', '........', '........'],
  },
  creeper: {
    bg: '#4fa04a',
    p: { e: '#111', m: '#0a2a0a' },
    rows: ['........', '.ee..ee.', '.ee..ee.', '...mm...', '..mmmm..', '..mmmm..', '..m..m..', '........'],
  },
  sheep: {
    bg: '#e8dccb',
    p: { e: '#222', n: '#d8a8a8' },
    rows: ['........', '........', '.e....e.', '........', '...nn...', '...nn...', '........', '........'],
  },
  cow: {
    bg: '#6e4a32',
    p: { e: '#222', n: '#d8c8b8', h: '#dddddd' },
    rows: ['h......h', 'h......h', '.e....e.', '........', 'nnnnnnnn', 'nn.nn.nn', 'nnnnnnnn', '........'],
  },
  villager: {
    bg: '#c8956c',
    p: { e: '#3a5c28', n: '#a8744a', b: '#6e4226' },
    rows: ['bbbbbbbb', '........', '.e....e.', '...nn...', '...nn...', '...nn...', '........', '........'],
  },
  golem: {
    bg: '#c8c4bc',
    p: { e: '#8a2a2a', n: '#7a766e', v: '#5a8a4a' },
    rows: ['........', '.e....e.', '........', '...nn...', '...nn...', '..vnnv..', '..v..v..', '........'],
  },
  enderman: {
    bg: '#101014',
    p: { e: '#d76eff', l: '#a12cc9' },
    rows: ['........', '........', 'eeee.eee', 'llll.lll', '........', '........', '........', '........'],
  },
  blaze: {
    bg: '#e8a53a',
    p: { e: '#2a1a08', m: '#c47a18' },
    rows: ['........', '.ee..ee.', '.ee..ee.', '........', '..mmmm..', '........', '........', '........'],
  },
  dragon: {
    bg: '#1c1c26',
    p: { e: '#d76eff', n: '#3a3a4a' },
    rows: ['........', '.ee..ee.', '.ee..ee.', '........', '.n....n.', '.nnnnnn.', '........', '........'],
  },
};

function faceTexture(type) {
  const art = FACE_ART[type];
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = art.bg;
  g.fillRect(0, 0, 8, 8);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const ch = art.rows[y][x];
      if (ch === '.' || !art.p[ch]) continue;
      g.fillStyle = art.p[ch];
      g.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

// Box-Teil: entweder Skin-gemappt (Pack) oder einfarbig mit optionalem Gesicht
function part(w, h, d, color, faceTex = null, skin = null, uvSpec = null) {
  const geo = new THREE.BoxGeometry(w, h, d);
  let mesh;
  if (skin && uvSpec) {
    mapBoxUV(geo, skin.w, skin.h, uvSpec[0], uvSpec[1], uvSpec[2], uvSpec[3], uvSpec[4]);
    const mat = new THREE.MeshLambertMaterial({ map: skin.tex, alphaTest: 0.1 });
    mesh = new THREE.Mesh(geo, mat);
  } else {
    const base = new THREE.MeshLambertMaterial({ color });
    if (faceTex) {
      const face = new THREE.MeshLambertMaterial({ color: 0xffffff, map: faceTex });
      mesh = new THREE.Mesh(geo, [base, base, base, base, face, base]);
    } else {
      mesh = new THREE.Mesh(geo, base);
    }
  }
  return mesh;
}

// Modelle: Ursprung an den Füssen, Blickrichtung +Z
function buildModel(type) {
  const g = new THREE.Group();
  const parts = { legs: [], arms: [], rods: [], bow: null };
  const skin = skinTexture(type);
  const spec = SKIN_PARTS[type] || null;
  const P = (w, h, d, color, face, key) =>
    part(w, h, d, color, face, skin && spec && spec[key] ? skin : null, spec ? spec[key] : null);

  if (type === 'zombie' || type === 'skeleton' || type === 'villager') {
    const skinCol = type === 'zombie' ? 0x4a7a3a : type === 'villager' ? 0xc8956c : 0xc8c8c8;
    const cloth = type === 'zombie' ? 0x3a5a8a : type === 'villager' ? 0x6e4226 : 0xa8a8a8;
    const limb = type === 'skeleton' ? 0.16 : 0.24;
    for (const side of [-1, 1]) {
      const leg = P(limb, 0.75, limb, cloth, null, 'leg');
      leg.geometry.translate(0, -0.375, 0);
      leg.position.set(side * 0.14, 0.75, 0);
      g.add(leg);
      parts.legs.push(leg);
      const arm = P(limb, 0.7, limb, type === 'villager' ? cloth : skinCol, null, 'arm');
      arm.geometry.translate(0, -0.3, 0);
      arm.position.set(side * (0.25 + limb / 2), 1.4, 0);
      if (type === 'zombie') arm.rotation.x = -Math.PI / 2;
      g.add(arm);
      parts.arms.push(arm);
    }
    const body = P(0.5, 0.65, 0.26, cloth, null, 'body');
    body.position.set(0, 1.08, 0);
    g.add(body);
    const head = P(0.5, 0.5, 0.5, skinCol, skin ? null : faceTexture(type), 'head');
    head.position.set(0, 1.65, 0);
    g.add(head);
    if (type === 'villager' && !skin) {
      const nose = part(0.1, 0.2, 0.1, 0xa8744a);
      nose.position.set(0, 1.6, 0.28);
      g.add(nose);
    }
    if (type === 'skeleton') {
      // Bogen in der Hand
      const bow = new THREE.Group();
      const stave = part(0.06, 0.7, 0.06, 0x6e4f26);
      stave.rotation.z = 0.4;
      const string = part(0.02, 0.62, 0.02, 0xe8e8e8);
      string.position.set(0.12, 0, 0);
      string.rotation.z = 0.4;
      bow.add(stave, string);
      bow.position.set(0.25 + limb / 2, 1.05, 0.3);
      g.add(bow);
      parts.bow = bow;
    }
  } else if (type === 'golem') {
    const col = 0xc8c4bc;
    for (const side of [-1, 1]) {
      const leg = P(0.35, 1.0, 0.35, 0xb0aca4, null, 'leg');
      leg.geometry.translate(0, -0.5, 0);
      leg.position.set(side * 0.25, 1.0, 0);
      g.add(leg);
      parts.legs.push(leg);
      const arm = P(0.3, 1.3, 0.3, col, null, 'arm');
      arm.geometry.translate(0, -0.55, 0);
      arm.position.set(side * 0.75, 2.15, 0);
      g.add(arm);
      parts.arms.push(arm);
    }
    const body = P(1.2, 0.95, 0.6, col, null, 'body');
    body.position.set(0, 1.75, 0);
    g.add(body);
    const head = P(0.45, 0.55, 0.45, col, skin ? null : faceTexture('golem'), 'head');
    head.position.set(0, 2.55, 0.05);
    g.add(head);
  } else if (type === 'enderman') {
    const skinCol = 0x101014;
    for (const side of [-1, 1]) {
      const leg = P(0.14, 1.45, 0.14, skinCol, null, 'leg');
      leg.geometry.translate(0, -0.725, 0);
      leg.position.set(side * 0.12, 1.45, 0);
      g.add(leg);
      parts.legs.push(leg);
      const arm = P(0.12, 1.3, 0.12, skinCol, null, 'arm');
      arm.geometry.translate(0, -0.6, 0);
      arm.position.set(side * 0.32, 2.35, 0);
      g.add(arm);
      parts.arms.push(arm);
    }
    const body = P(0.5, 0.85, 0.24, skinCol, null, 'body');
    body.position.set(0, 1.95, 0);
    g.add(body);
    const head = P(0.45, 0.45, 0.45, skinCol, skin ? null : faceTexture('enderman'), 'head');
    head.position.set(0, 2.6, 0);
    g.add(head);
  } else if (type === 'blaze') {
    const skinCol = 0xe8a53a;
    const body = P(0.35, 0.7, 0.35, 0xc47a18, null, 'body');
    body.position.set(0, 0.9, 0);
    g.add(body);
    const head = P(0.45, 0.45, 0.45, skinCol, skin ? null : faceTexture('blaze'), 'head');
    head.position.set(0, 1.5, 0);
    g.add(head);
    for (let i = 0; i < 4; i++) {
      const rod = part(0.12, 0.5, 0.12, 0xf5c542);
      rod.userData.orbit = (i / 4) * Math.PI * 2;
      rod.position.set(Math.cos(rod.userData.orbit) * 0.45, 0.7, Math.sin(rod.userData.orbit) * 0.45);
      g.add(rod);
      parts.rods.push(rod);
    }
  } else if (type === 'creeper') {
    const skinCol = 0x4fa04a;
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const leg = P(0.22, 0.35, 0.22, skinCol, null, 'leg');
      leg.geometry.translate(0, -0.175, 0);
      leg.position.set(sx * 0.14, 0.35, sz * 0.2);
      g.add(leg);
      parts.legs.push(leg);
    }
    const body = P(0.45, 0.85, 0.3, skinCol, null, 'body');
    body.position.set(0, 0.78, 0);
    g.add(body);
    const head = P(0.5, 0.5, 0.5, skinCol, skin ? null : faceTexture('creeper'), 'head');
    head.position.set(0, 1.45, 0);
    g.add(head);
  } else {
    // Vierbeiner: Schaf / Kuh
    const bodyCol = type === 'sheep' ? 0xe8dccb : 0x6e4a32;
    const legCol = type === 'sheep' ? 0xcfc3b2 : 0x5a3c28;
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const leg = P(0.18, 0.55, 0.18, legCol, null, 'leg');
      leg.geometry.translate(0, -0.275, 0);
      leg.position.set(sx * 0.22, 0.55, sz * 0.32);
      g.add(leg);
      parts.legs.push(leg);
    }
    const body = P(0.65, 0.55, 1.05, bodyCol, null, 'body');
    body.position.set(0, 0.82, 0);
    g.add(body);
    const head = P(0.4, 0.4, 0.4, bodyCol, skin ? null : faceTexture(type), 'head');
    head.position.set(0, 1.15, 0.62);
    g.add(head);
  }

  g.traverse(m => {
    if (m.isMesh) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) mat.userData.baseColor = mat.color.clone();
    }
  });

  return { group: g, parts };
}

function applyFlashTo(group, on, state) {
  if (state._flashOn === on) return;
  state._flashOn = on;
  group.traverse(m => {
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (on) mat.color.setRGB(1, 0.35, 0.35);
      else if (mat.userData.baseColor) mat.color.copy(mat.userData.baseColor);
    }
  });
}

export class Mob extends Entity {
  constructor(type, x, y, z) {
    const def = MOB_TYPES[type];
    super(x, y, z, def.w, def.h);
    this.type = type;
    this.def = def;
    this.hp = def.hp;
    this.hittable = true;
    this.yaw = Math.random() * Math.PI * 2;
    this.wanderTimer = 0;
    this.wanderDir = null;
    this.attackTimer = 0;
    this.shootTimer = 1.5;
    this.burst = 0;
    this.fuse = 0;
    this.fleeTimer = 0;
    this.flashTimer = 0;
    this.walkPhase = 0;
    this.angry = false;
    // Villager-Zustand
    this.sleeping = false;
    this.bedTarget = null;
    this.openedDoor = null;   // { x, y, z, timer }
    const m = buildModel(type);
    this.group = m.group;
    this.parts = m.parts;
  }

  hurt(dmg, kx = 0, kz = 0, game = null) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flashTimer = 0.25;
    this.vel.x += kx;
    this.vel.z += kz;
    this.vel.y = Math.max(this.vel.y, 4.5);
    this.sleeping = false;
    if (this.def.enderman) {
      this.angry = true;
      if (game && Math.random() < 0.4) this.teleport(game.world);
    } else if (!this.def.hostile && !this.def.golem) {
      this.fleeTimer = 5;
    }
    if (this.hp <= 0 && game) this.die(game);
  }

  die(game) {
    this.dead = true;
    for (const d of this.def.drops) {
      const n = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
      for (let i = 0; i < n; i++) {
        game.spawnDrop(d.id, 1, this.pos.x, this.pos.y + 0.5, this.pos.z);
      }
    }
  }

  teleport(world) {
    for (let i = 0; i < 12; i++) {
      const nx = Math.floor(this.pos.x + (Math.random() - 0.5) * 20);
      const nz = Math.floor(this.pos.z + (Math.random() - 0.5) * 20);
      const ny = world.findFloor(nx, nz, Math.min(WORLD_HEIGHT - 4, Math.floor(this.pos.y) + 8));
      if (ny > 0 && world.getBlock(nx, ny + 3, nz) === B.AIR) {
        this.pos = { x: nx + 0.5, y: ny + 1.01, z: nz + 0.5 };
        this.vel = { x: 0, y: 0, z: 0 };
        return true;
      }
    }
    return false;
  }

  // Tür vor dem Mob öffnen (Villager/Golem)
  handleDoors(game, moveX, moveZ) {
    const w = game.world;
    // Geöffnete Tür wieder schliessen
    if (this.openedDoor) {
      this.openedDoor.timer -= 1 / 60;
      const d = this.openedDoor;
      if (this.openedDoor.timer <= 0 && Math.hypot(this.pos.x - d.x - 0.5, this.pos.z - d.z - 0.5) > 1.6) {
        if (w.getBlock(d.x, d.y, d.z) === B.DOOR_L_OPEN) {
          w.setBlock(d.x, d.y, d.z, B.DOOR_L);
          w.setBlock(d.x, d.y + 1, d.z, B.DOOR_U);
        }
        this.openedDoor = null;
      }
    }
    if (!moveX && !moveZ) return;
    const fx = Math.floor(this.pos.x + Math.sign(moveX) * 0.6);
    const fz = Math.floor(this.pos.z + Math.sign(moveZ) * 0.6);
    const fy = Math.floor(this.pos.y + 0.2);
    for (const [bx, bz] of [[fx, Math.floor(this.pos.z)], [Math.floor(this.pos.x), fz]]) {
      const id = w.getBlock(bx, fy, bz);
      if (id === B.DOOR_L) {
        w.setBlock(bx, fy, bz, B.DOOR_L_OPEN);
        w.setBlock(bx, fy + 1, bz, B.DOOR_U_OPEN);
        this.openedDoor = { x: bx, y: fy, z: bz, timer: 2 };
        if (game.sound) game.sound.door();
      }
    }
  }

  tick(dt, game) {
    this.age += dt;
    const player = game.player;
    const def = this.def;
    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    let moveX = 0, moveZ = 0, speedMul = 0;
    let flying = false;

    // Enderman: wird wütend, wenn man ihn anschaut
    if (def.enderman && !this.angry && !player.dead && !player.creative && game.look && dist < 24) {
      const hx = this.pos.x - game.look.x;
      const hy = (this.pos.y + this.h * 0.85) - game.look.y;
      const hz = this.pos.z - game.look.z;
      const len = Math.hypot(hx, hy, hz) || 1;
      const dot = (hx / len) * game.look.dx + (hy / len) * game.look.dy + (hz / len) * game.look.dz;
      if (dot > 0.995) this.angry = true;
    }

    // Villager: Tagesablauf (Pfade am Tag, nachts ins Bett)
    if (def.villager) {
      const v = game.village;
      if (this.sleeping) {
        if (!game.isNight) { this.sleeping = false; }
        this.vel.x = 0; this.vel.z = 0;
        this.group.position.set(this.pos.x, this.pos.y + 0.15, this.pos.z);
        this.group.rotation.set(-Math.PI / 2, this.yaw, 0);
        return;
      }
      if (game.isNight && v) {
        if (!this.bedTarget) {
          const house = v.houses[Math.floor(Math.abs(this.pos.x * 7 + this.pos.z * 13)) % v.houses.length];
          this.bedTarget = { x: house.bed.x + 0.5, y: house.y + 1, z: house.bed.z + 0.5 };
        }
        const bx = this.bedTarget.x - this.pos.x, bz = this.bedTarget.z - this.pos.z;
        const bd = Math.hypot(bx, bz);
        if (bd < 0.9) {
          this.sleeping = true;
          this.pos.x = this.bedTarget.x; this.pos.z = this.bedTarget.z;
          this.vel = { x: 0, y: 0, z: 0 };
        } else {
          moveX = bx / bd; moveZ = bz / bd; speedMul = 1;
          this.yaw = Math.atan2(moveX, moveZ);
        }
      } else {
        this.bedTarget = null;
        // Tagsüber: wandern, aber ans Dorf gebunden
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 2 + Math.random() * 4;
          this.wanderDir = Math.random() < 0.5 ? null : Math.random() * Math.PI * 2;
        }
        if (v && Math.hypot(v.cx - this.pos.x, v.cz - this.pos.z) > v.radius) {
          const tx = v.cx - this.pos.x, tz = v.cz - this.pos.z;
          const td = Math.hypot(tx, tz) || 1;
          moveX = tx / td; moveZ = tz / td; speedMul = 0.7;
          this.yaw = Math.atan2(moveX, moveZ);
        } else if (this.wanderDir !== null) {
          moveX = Math.sin(this.wanderDir);
          moveZ = Math.cos(this.wanderDir);
          speedMul = 0.5;
          this.yaw = this.wanderDir;
        }
      }
      if (this.fleeTimer > 0) {
        this.fleeTimer -= dt;
        // vor dem nächsten Monster fliehen
        let threat = null, tDist = 12;
        for (const e of game.entities) {
          if (e instanceof Mob && !e.dead && e.def.hostile) {
            const d = e.distTo(this.pos);
            if (d < tDist) { tDist = d; threat = e; }
          }
        }
        if (threat) {
          const tx = this.pos.x - threat.pos.x, tz = this.pos.z - threat.pos.z;
          const td = Math.hypot(tx, tz) || 1;
          moveX = tx / td; moveZ = tz / td; speedMul = 1.6;
          this.yaw = Math.atan2(moveX, moveZ);
        }
      }
      this.handleDoors(game, moveX, moveZ);
      this.applyMovement(dt, game, moveX, moveZ, speedMul, false);
      return;
    }

    // Eisengolem: verteidigt das Dorf gegen Monster
    if (def.golem) {
      let target = null, tDist = 20;
      for (const e of game.entities) {
        if (e instanceof Mob && !e.dead && e.def.hostile) {
          const d = e.distTo(this.pos);
          if (d < tDist) { tDist = d; target = e; }
        }
      }
      if (target) {
        const tx = target.pos.x - this.pos.x, tz = target.pos.z - this.pos.z;
        const td = Math.hypot(tx, tz) || 1;
        moveX = tx / td; moveZ = tz / td; speedMul = 1;
        this.yaw = Math.atan2(moveX, moveZ);
        this.attackTimer -= dt;
        if (td < def.attackRange && this.attackTimer <= 0) {
          this.attackTimer = 1.2;
          target.hurt(def.damage, tx / td * 4, tz / td * 4, game);
          target.vel.y = 9; // Golem-Uppercut
          if (game.sound) game.sound.mobHurt();
          // Arm-Schwung
          if (this.parts.arms.length) this.parts.arms[0].rotation.x = -2;
        }
      } else {
        const v = game.village;
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 3 + Math.random() * 4;
          this.wanderDir = Math.random() < 0.5 ? null : Math.random() * Math.PI * 2;
        }
        if (v && Math.hypot(v.cx - this.pos.x, v.cz - this.pos.z) > v.radius) {
          const tx = v.cx - this.pos.x, tz = v.cz - this.pos.z;
          const td = Math.hypot(tx, tz) || 1;
          moveX = tx / td; moveZ = tz / td; speedMul = 0.7;
          this.yaw = Math.atan2(moveX, moveZ);
        } else if (this.wanderDir !== null) {
          moveX = Math.sin(this.wanderDir);
          moveZ = Math.cos(this.wanderDir);
          speedMul = 0.4;
          this.yaw = this.wanderDir;
        }
      }
      // Arme zurückschwingen
      for (const arm of this.parts.arms) arm.rotation.x *= 1 - Math.min(1, 6 * dt);
      this.applyMovement(dt, game, moveX, moveZ, speedMul, false);
      return;
    }

    const hostileNow = (def.hostile || (def.enderman && this.angry));

    // Zombies greifen auch Dorfbewohner an
    let victim = null, victimDist = Infinity;
    if (def.targetsVillagers) {
      for (const e of game.entities) {
        if (e instanceof Mob && !e.dead && e.def.villager) {
          const d = e.distTo(this.pos);
          if (d < def.aggro && d < victimDist) { victimDist = d; victim = e; }
        }
      }
    }
    const playerValid = !player.dead && !player.creative && (def.enderman ? this.angry : dist < (def.aggro || 0));
    if (playerValid && dist <= victimDist) { victim = null; }
    const canTarget = hostileNow && (playerValid || victim);

    if (this.fleeTimer > 0 && !def.enderman) {
      this.fleeTimer -= dt;
      if (dist > 0.1) { moveX = -dx / dist; moveZ = -dz / dist; speedMul = 1.6; }
    } else if (canTarget) {
      const tgt = victim ? victim.pos : player.pos;
      const tx = tgt.x - this.pos.x, tz = tgt.z - this.pos.z;
      const tDist = Math.hypot(tx, tz);

      if (def.blaze) {
        flying = true;
        const targetY = player.pos.y + 3;
        this.vel.y += ((targetY - this.pos.y) * 1.5 - this.vel.y) * Math.min(1, 3 * dt);
        if (dist < 6) { moveX = -dx / dist; moveZ = -dz / dist; speedMul = 1; }
        else if (dist > 14) { moveX = dx / dist; moveZ = dz / dist; speedMul = 1; }
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && dist < 20) {
          this.burst = this.burst > 0 ? this.burst - 1 : 2;
          this.shootTimer = this.burst > 0 ? 0.35 : 3.2;
          const sx = this.pos.x, sy = this.pos.y + 1.4, sz = this.pos.z;
          const ax = player.pos.x - sx, ay = (player.pos.y + 1.2) - sy, az = player.pos.z - sz;
          const len = Math.hypot(ax, ay, az) || 1;
          const v = 11;
          game.spawnFireball(sx, sy, sz, ax / len * v, ay / len * v, az / len * v);
        }
        this.yaw = Math.atan2(dx, dz);
      } else if (def.ranged) {
        if (dist < 6) { moveX = -dx / dist; moveZ = -dz / dist; speedMul = 1; }
        else if (dist > 12) { moveX = dx / dist; moveZ = dz / dist; speedMul = 1; }
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && dist < 16) {
          this.shootTimer = 2.2;
          const sx = this.pos.x, sy = this.pos.y + 1.5, sz = this.pos.z;
          const drop = 0.023 * dist * dist;
          const ax = player.pos.x - sx, ay = (player.pos.y + 1.1 + drop) - sy, az = player.pos.z - sz;
          const len = Math.hypot(ax, ay, az) || 1;
          const v = 16;
          game.spawnArrow(sx, sy, sz,
            ax / len * v + (Math.random() - 0.5) * 0.6,
            ay / len * v,
            az / len * v + (Math.random() - 0.5) * 0.6);
        }
        this.yaw = Math.atan2(dx, dz);
      } else if (def.exploder) {
        if (dist < 2.8) {
          this.fuse += dt;
          if (this.fuse >= 1.5) {
            this.dead = true;
            game.explode(this.pos.x, this.pos.y + 0.8, this.pos.z, 3.2);
            return;
          }
        } else {
          this.fuse = Math.max(0, this.fuse - dt * 1.5);
          if (dist > 0.1) { moveX = dx / dist; moveZ = dz / dist; speedMul = 1; }
        }
        this.yaw = Math.atan2(dx, dz);
      } else {
        // Nahkampf: Spieler oder Dorfbewohner verfolgen
        if (tDist > 0.1) { moveX = tx / tDist; moveZ = tz / tDist; speedMul = 1; }
        this.yaw = Math.atan2(tx, tz);
        this.attackTimer -= dt;
        if (tDist < def.attackRange && this.attackTimer <= 0) {
          this.attackTimer = 1.0;
          const d = tDist || 1;
          if (victim) victim.hurt(def.damage, tx / d * 6, tz / d * 6, game);
          else player.hurt(def.damage, tx / d * 6, tz / d * 6);
        }
        if (def.enderman && dist > 12 && Math.random() < dt * 0.4) this.teleport(game.world);
      }
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2 + Math.random() * 4;
        this.wanderDir = Math.random() < 0.5 ? null : Math.random() * Math.PI * 2;
      }
      if (this.wanderDir !== null) {
        moveX = Math.sin(this.wanderDir);
        moveZ = Math.cos(this.wanderDir);
        speedMul = 0.5;
        this.yaw = this.wanderDir;
      }
      if (def.blaze) {
        flying = true;
        this.vel.y += (Math.sin(this.age * 1.5) * 0.6 - this.vel.y) * Math.min(1, 2 * dt);
      }
    }

    this.applyMovement(dt, game, moveX, moveZ, speedMul, flying);
  }

  applyMovement(dt, game, moveX, moveZ, speedMul, flying) {
    const def = this.def;
    const speed = def.speed * speedMul;
    const accel = this.onGround || flying ? 10 : 4;
    const t = Math.min(1, accel * dt);
    this.vel.x += (moveX * speed - this.vel.x) * t;
    this.vel.z += (moveZ * speed - this.vel.z) * t;

    const water = this.inWater(game.world);
    if (water && def.enderman) {
      this.hp -= dt * 2;
      if (this.hp <= 0) { this.die(game); return; }
      if (Math.random() < dt * 2) this.teleport(game.world);
    }
    if (!flying) {
      if (water) {
        this.vel.y += GRAVITY * 0.25 * dt + 8 * dt;
        this.vel.y = Math.min(Math.max(this.vel.y, -2.5), 3);
      } else {
        this.vel.y += GRAVITY * dt;
        this.vel.y = Math.max(this.vel.y, -40);
      }
    }

    moveWithCollision(game.world, this, dt);
    if (this.hitWall && this.onGround && speedMul > 0) this.vel.y = 8;
    if (this.hitWall && water) this.vel.y = Math.max(this.vel.y, 5);

    // Animation
    const horiz = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += horiz * dt * 2.6;
    const swing = Math.sin(this.walkPhase) * Math.min(1, horiz / 2) * 0.7;
    this.parts.legs.forEach((leg, i) => { leg.rotation.x = i % 2 === 0 ? swing : -swing; });
    if (this.type === 'skeleton' || this.type === 'enderman') {
      this.parts.arms.forEach((arm, i) => { arm.rotation.x = i % 2 === 0 ? -swing : swing; });
    }
    for (const rod of this.parts.rods) {
      const a = rod.userData.orbit + this.age * 3;
      rod.position.set(Math.cos(a) * 0.45, 0.7 + Math.sin(this.age * 4 + rod.userData.orbit) * 0.1, Math.sin(a) * 0.45);
    }

    let flash = this.flashTimer > 0;
    if (this.def.exploder && this.fuse > 0) {
      const pulse = 1 + this.fuse * 0.12;
      this.group.scale.set(pulse, pulse, pulse);
      if (Math.sin(this.fuse * 20) > 0) flash = true;
    }
    if (this.flashTimer > 0) this.flashTimer -= dt;
    applyFlashTo(this.group, flash, this);

    this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.group.rotation.set(0, this.yaw, 0);
  }
}

// --- End-Kristall ---
export class EndCrystal extends Entity {
  constructor(x, y, z) {
    super(x, y, z, 1, 1);
    this.hittable = true;
    this.group = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshBasicMaterial({ color: 0xe07adf, transparent: true, opacity: 0.5 })
    );
    const inner = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    this.group.add(outer, inner);
    this.outer = outer;
    this.inner = inner;
  }

  hurt(dmg, kx, kz, game) {
    if (this.dead) return;
    this.dead = true;
    if (game) game.explode(this.pos.x, this.pos.y, this.pos.z, 2.2);
  }

  tick(dt, game) {
    this.age += dt;
    this.outer.rotation.y += dt * 1.2;
    this.outer.rotation.x += dt * 0.7;
    this.inner.rotation.y -= dt * 2;
    if (game.dragon && !game.dragon.dead) {
      game.dragon.hp = Math.min(game.dragon.maxHp, game.dragon.hp + 0.5 * dt);
    }
    this.group.position.set(this.pos.x, this.pos.y + Math.sin(this.age * 2) * 0.1, this.pos.z);
  }
}

// --- Enderdrache (Boss) ---
export class Dragon extends Entity {
  constructor(x, y, z) {
    super(x, y, z, 3.0, 2.0);
    this.hittable = true;
    this.isDragon = true;
    this.maxHp = 150;
    this.hp = this.maxHp;
    this.state = 'circle';
    this.stateTimer = 8 + Math.random() * 6;
    this.angle = Math.random() * Math.PI * 2;
    this.contactTimer = 0;
    this.biteTimer = 0;
    this.flashTimer = 0;
    this.perched = false;
    this.yaw = 0;
    this.buildModel();
  }

  buildModel() {
    const g = new THREE.Group();
    const dark = 0x1c1c26, grey = 0x3a3a4a;
    const body = part(1.4, 1.1, 3.0, dark);
    body.position.set(0, 1.0, 0);
    g.add(body);
    const chest = part(1.0, 0.5, 1.6, grey);
    chest.position.set(0, 0.55, 0.4);
    g.add(chest);
    const neck1 = part(0.5, 0.5, 0.8, dark);
    neck1.position.set(0, 1.35, 1.8);
    g.add(neck1);
    const head = part(0.8, 0.6, 1.0, dark, faceTexture('dragon'));
    head.position.set(0, 1.5, 2.6);
    g.add(head);
    this.wings = [];
    for (const side of [-1, 1]) {
      const wing = part(3.6, 0.1, 1.8, grey);
      wing.geometry.translate(side * 1.8, 0, 0);
      wing.position.set(side * 0.7, 1.6, 0.2);
      g.add(wing);
      this.wings.push(wing);
    }
    let tz = -1.8;
    for (let i = 0; i < 3; i++) {
      const s = 0.5 - i * 0.12;
      const seg = part(s, s, 1.1, i % 2 ? grey : dark);
      seg.position.set(0, 1.1 - i * 0.08, tz);
      g.add(seg);
      tz -= 1.0;
    }
    g.traverse(m => {
      if (m.isMesh) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) mat.userData.baseColor = mat.color.clone();
      }
    });
    this.group = g;
  }

  hurt(dmg, kx = 0, kz = 0, game = null) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flashTimer = 0.25;
    if (this.perched && this.hp > 0) {
      if (Math.random() < 0.25) { this.state = 'circle'; this.perched = false; this.stateTimer = 10; }
    }
    if (this.hp <= 0) {
      this.dead = true;
      if (game && game.onDragonDeath) game.onDragonDeath(this.pos);
    }
  }

  tick(dt, game) {
    this.age += dt;
    const p = game.player;
    this.contactTimer -= dt;
    this.biteTimer -= dt;
    this.stateTimer -= dt;

    let target, speed;
    if (this.state === 'circle') {
      this.angle += dt * 0.35;
      target = {
        x: Math.cos(this.angle) * 26,
        y: 50 + Math.sin(this.angle * 2.3) * 3,
        z: Math.sin(this.angle) * 26,
      };
      speed = 10;
      if (this.stateTimer <= 0) {
        if (Math.random() < 0.55) { this.state = 'dive'; this.stateTimer = 6; if (game.sound) game.sound.dragon(); }
        else { this.state = 'perch'; this.stateTimer = 20; }
      }
    } else if (this.state === 'dive') {
      target = { x: p.pos.x, y: p.pos.y + 1, z: p.pos.z };
      speed = 15;
      const d3 = Math.hypot(target.x - this.pos.x, target.y - this.pos.y, target.z - this.pos.z);
      if (d3 < 2 || this.stateTimer <= 0) { this.state = 'circle'; this.stateTimer = 8 + Math.random() * 8; }
    } else {
      const perch = game.dragonPerch || { x: 0.5, y: 50, z: 0.5 };
      target = perch;
      speed = 10;
      const d3 = Math.hypot(target.x - this.pos.x, target.y - this.pos.y, target.z - this.pos.z);
      if (d3 < 1.2) {
        this.perched = true;
        this.vel = { x: 0, y: 0, z: 0 };
        this.pos = { ...perch };
        const pd = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
        if (pd < 4 && this.biteTimer <= 0 && !p.dead) {
          this.biteTimer = 1.4;
          const d = pd || 1;
          p.hurt(6, (p.pos.x - this.pos.x) / d * 7, (p.pos.z - this.pos.z) / d * 7);
        }
      }
      if (this.stateTimer <= 0) { this.state = 'circle'; this.perched = false; this.stateTimer = 10 + Math.random() * 6; }
    }

    if (!this.perched) {
      const tx = target.x - this.pos.x, ty = target.y - this.pos.y, tz = target.z - this.pos.z;
      const len = Math.hypot(tx, ty, tz) || 1;
      const lerp = Math.min(1, 2.5 * dt);
      this.vel.x += (tx / len * speed - this.vel.x) * lerp;
      this.vel.y += (ty / len * speed - this.vel.y) * lerp;
      this.vel.z += (tz / len * speed - this.vel.z) * lerp;
      this.pos.x += this.vel.x * dt;
      this.pos.y += this.vel.y * dt;
      this.pos.z += this.vel.z * dt;
      this.yaw = Math.atan2(this.vel.x, this.vel.z);
    }

    if (!p.dead && !p.creative && this.contactTimer <= 0) {
      const d3 = Math.hypot(p.pos.x - this.pos.x, (p.pos.y + 0.9) - (this.pos.y + 1), p.pos.z - this.pos.z);
      if (d3 < 2.8) {
        this.contactTimer = 1.0;
        const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) || 1;
        p.hurt(8, (p.pos.x - this.pos.x) / d * 10, (p.pos.z - this.pos.z) / d * 10);
      }
    }

    const flap = Math.sin(this.age * (this.perched ? 2 : 6)) * (this.perched ? 0.15 : 0.5);
    if (this.wings) {
      this.wings[0].rotation.z = flap;
      this.wings[1].rotation.z = -flap;
    }

    if (this.flashTimer > 0) this.flashTimer -= dt;
    applyFlashTo(this.group, this.flashTimer > 0, this);

    this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.group.rotation.y = this.yaw;
  }
}
