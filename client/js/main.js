// Einstiegspunkt: Renderer, Game-States, Survival-Loop, Dimensionen, Mobs, HUD, Menüs

import * as THREE from 'three';
import {
  CHUNK_SIZE as CS, WORLD_HEIGHT as H, SEA_LEVEL,
  EYE_HEIGHT, PLAYER_WIDTH, PLAYER_HEIGHT, REACH,
  DAY_LENGTH, MOB_CAP_HOSTILE, MOB_CAP_PASSIVE, SPAWN_INTERVAL, DESPAWN_DIST,
  ATTACK_COOLDOWN, AUTOSAVE_INTERVAL, EAT_DURATION, DROP_PICKUP_DELAY,
} from './config.js';
import { SETTINGS, pixelRatioFor } from './settings.js';
import {
  B, BLOCK_INFO, CREATIVE_HOTBAR, createAtlasCanvas, tileUV,
  isWater, isLava, isFluid,
} from './blocks.js';
import { I, CREATIVE_ITEMS, itemInfo, itemIcon, dropsForBlock, SMELT, FUEL, maxDurOf } from './items.js';
import { World, END_EXIT, END_SPAWN, END_PILLARS } from './world.js';
import { skyOf, blockOf } from './light.js';
import { FluidSim } from './fluids.js';
import { Player } from './player.js';
import {
  Mob, MOB_TYPES, ItemDrop, Arrow, Fireball, EyeFlyer, Explosion, Dragon, EndCrystal,
  FallingBlock, PrimedTNT,
} from './entities.js';
import { Inventory, InventoryUI } from './inventory.js';
import { SLOT_COUNT, slotMeta, saveState, loadState, deleteSlot } from './save.js';
import {
  PORTAL_REGION, ruinedPortalInRegion,
  STRONGHOLD_REGION, strongholdInRegion,
  VILLAGE_REGION, villageInRegion,
  rasterizePortalFrame, lootTableAt, rollLoot,
} from './structures.js';
import { S, unlockAudio, applyVolume } from './sound.js';
import { loadTexturePack } from './texpack.js';
import { ViewModel, BreakOverlay } from './viewmodel.js';
import { Menus } from './menu.js';
import { Net, DEFAULT_SERVER } from './net.js';
import { RemotePlayer } from './remoteplayer.js';

// ============ Renderer & globale Ressourcen ============
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(SETTINGS.quality));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 900);
camera.rotation.order = 'YXZ';

const atlasCanvas = createAtlasCanvas();
const atlasTex = new THREE.CanvasTexture(atlasCanvas);
atlasTex.magFilter = THREE.NearestFilter;
atlasTex.minFilter = THREE.NearestFilter;
atlasTex.generateMipmaps = false;
atlasTex.colorSpace = THREE.SRGBColorSpace;

// Gemeinsames Tageslicht-Uniform: Vertex-Licht = max(Blocklicht, Skylight * uDayLight)
const dayLight = { value: 1 };
function lightShader(shader) {
  shader.uniforms.uDayLight = dayLight;
  shader.vertexShader = 'attribute vec2 aLight;\nvarying vec2 vLight;\n' +
    shader.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\n\tvLight = aLight;');
  shader.fragmentShader = 'uniform float uDayLight;\nvarying vec2 vLight;\n' +
    shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n\tfloat ccLight = max(vLight.y, vLight.x * uDayLight);\n\tdiffuseColor.rgb *= max(0.05, ccLight);');
}
const opaqueMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.5 });
opaqueMat.onBeforeCompile = lightShader;
const transMat = new THREE.MeshBasicMaterial({
  map: atlasTex, vertexColors: true, transparent: true,
  side: THREE.DoubleSide, depthWrite: false,
});
transMat.onBeforeCompile = lightShader;

// Material für Entity-Blöcke (fallender Sand, TNT) – ohne Licht-Attribut
const entityBlockMat = new THREE.MeshLambertMaterial({ map: atlasTex, alphaTest: 0.5 });
function blockMesh(id, size = 0.98) {
  const info = BLOCK_INFO[id];
  const geo = new THREE.BoxGeometry(size, size, size);
  if (info.tiles) {
    const uv = geo.getAttribute('uv');
    const tiles = [info.tiles.side, info.tiles.side, info.tiles.top, info.tiles.bottom, info.tiles.side, info.tiles.side];
    for (let f = 0; f < 6; f++) {
      const o = f * 4;
      const set = (i, u, v) => { const [uu, vv] = tileUV(tiles[f], u, v); uv.setXY(o + i, uu, vv); };
      set(0, 0, 1); set(1, 1, 1); set(2, 0, 0); set(3, 1, 0);
    }
    uv.needsUpdate = true;
  }
  return new THREE.Mesh(geo, entityBlockMat);
}

// Umgebungsfarben pro Dimension
const ENV = {
  over: { day: new THREE.Color(0x8fcdf0), night: new THREE.Color(0x0b1026), water: new THREE.Color(0x1c4b8f) },
  nether: { fixed: new THREE.Color(0x2a0d08), bright: 0.4 },
  end: { fixed: new THREE.Color(0x0e0a18), bright: 0.55 },
};

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 })
);
highlight.visible = false;

let viewModel = null;    // 3D-Hand (nach dem Pack-Load erstellt)
let breakOverlay = null; // Riss-Overlay
let menus = null;

// ============ DOM ============
const el = id => document.getElementById(id);
const overlay = el('overlay');
const debugEl = el('debug');
const hotbarEl = el('hotbar');
const heartsEl = el('hearts');
const hungerEl = el('hunger');
const armorEl = el('armor');
const airEl = el('air');
const bossbarEl = el('bossbar');
const bossbarFill = el('bossbar-fill');
const eatbarWrap = el('eatbar-wrap');
const eatbar = el('eatbar');
const toastEl = el('toast');

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 4000);
}

// ============ Spielzustand ============
let appState = 'menu';   // menu | playing | paused | inventory | dead
let game = null;
let selected = 0;
let mouseLeft = false;
let rightHeld = false;
let useRepeat = 0;
let mining = null;
let portalTimer = 0;
let portalLock = false;
let underwater = false;
let wasInWater = false;
let hurtFlashTimer = 0;
let debugMode = 1;       // 0 aus, 1 minimal, 2 voll
let eatProgress = 0;
let bowCharge = -1;      // -1 = nicht am Spannen
let lastJumpTap = -10;
let ambientTimer = 12;

const params = new URLSearchParams(location.search);

// ============ Multiplayer-Netzwerk ============
// Standard-Server: der offizielle Hub – ausser das Spiel wird gerade von einem
// selbst gehosteten Server ausgeliefert, dann ist dieser Host der Standard.
// ?server=… übersteuert alles (praktisch für Tests).
function defaultServerUrl() {
  if (params.get('server')) return params.get('server');
  if ((location.protocol === 'http:' || location.protocol === 'https:') &&
      location.host && !location.host.endsWith('github.io')) {
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  }
  return DEFAULT_SERVER;
}

// Eingaben wie "192.168.1.5:8080" oder "meinserver.de" in eine WS-URL wandeln
function normalizeServerUrl(input) {
  const s = (input || '').trim();
  if (!s) return defaultServerUrl();
  if (/^wss?:\/\//i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s.replace(/^http/i, 'ws');
  const host = s.split('/')[0].split(':')[0];
  const isLocal = host === 'localhost' || /^[0-9.]+$/.test(host) || host.endsWith('.local');
  return (isLocal ? 'ws://' : 'wss://') + s;
}

const net = new Net();
const remotePlayers = new Map(); // pid -> RemotePlayer

function makeScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 100, 200);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1.0);
  const sun = new THREE.DirectionalLight(0xffffff, 0.5);
  sun.position.set(0.4, 1, 0.6);
  scene.add(hemi, sun);
  return { scene, hemi, sun };
}

// Sonne/Mond/Sterne/Wolken (nur Overworld)
function makeSky(scene) {
  const sun = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshBasicMaterial({ color: 0xffdf6e, fog: false, side: THREE.DoubleSide })
  );
  const moon = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshBasicMaterial({ color: 0xdde4ee, fog: false, side: THREE.DoubleSide })
  );
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 350; i++) {
    const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1);
    starPos.push(Math.sin(b) * Math.cos(a) * 430, Math.abs(Math.cos(b)) * 430 + 20, Math.sin(b) * Math.sin(a) * 430);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 1.6, fog: false, transparent: true, opacity: 0, sizeAttenuation: false,
  }));

  // Scrollende Wolkenschicht
  const cc = document.createElement('canvas');
  cc.width = cc.height = 256;
  const cg = cc.getContext('2d');
  cg.clearRect(0, 0, 256, 256);
  let seed = 777;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  cg.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 42; i++) {
    const x = rnd() * 256, y = rnd() * 256;
    const w = 14 + rnd() * 36, h2 = 8 + rnd() * 14;
    cg.fillRect(x, y, w, h2);
    cg.fillRect(x + 6, y - 5, w * 0.6, h2 * 0.6);
  }
  const cloudTex = new THREE.CanvasTexture(cc);
  cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;
  cloudTex.repeat.set(3, 3);
  cloudTex.magFilter = THREE.NearestFilter;
  const clouds = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshBasicMaterial({
      map: cloudTex, transparent: true, opacity: 0.5, fog: false,
      depthWrite: false, side: THREE.DoubleSide,
    })
  );
  clouds.rotation.x = -Math.PI / 2;
  clouds.position.y = H + 26;

  scene.add(sun, moon, stars, clouds);
  return { sun, moon, stars, clouds, cloudTex };
}

function createDim(name) {
  const { scene, hemi, sun } = makeScene();
  const world = new World(scene, opaqueMat, transMat, game.seed, name);
  if (game.savedEdits && game.savedEdits[name]) world.loadEdits(game.savedEdits[name]);
  world.onBlockChange = (x, y, z, id) => onBlockChanged(name, x, y, z, id);
  const dim = {
    name, scene, world, entities: [], hemi, sun, sky: null,
    crystalsSpawned: false,
    fluids: new FluidSim(world),
    spawnerTimers: new Map(),
  };
  if (name === 'over') dim.sky = makeSky(scene);
  if (game.savedDrops && game.savedDrops[name]) {
    for (const d of game.savedDrops[name]) {
      const [id, count, x, y, z, dur] = d;
      const drop = new ItemDrop(id, count, x, y, z, atlasCanvas, dur);
      drop.vel = { x: 0, y: 0, z: 0 };
      dim.entities.push(drop);
      scene.add(drop.group);
    }
    game.savedDrops[name] = null;
  }
  // Mitspieler, die sich bereits in dieser Dimension befinden, einhängen
  for (const rp of remotePlayers.values()) {
    if (rp.dim === name) rp.attach(scene);
  }
  return dim;
}

const curDim = () => game.dims[game.dimName];
const curWorld = () => curDim().world;

// Blockänderungen: Fluide aufwecken + Gravity-Blöcke prüfen
const gravityQueue = [];
function onBlockChanged(dimName, x, y, z, id) {
  // Multiplayer: lokale Änderungen an den Hub melden (Remote-Sets nicht zurückspiegeln)
  if (net.active && !net.applyingRemote && id !== undefined) net.sendSet(dimName, x, y, z, id);
  const dim = game && game.dims[dimName];
  if (!dim) return;
  dim.fluids.wake(x, y, z);
  gravityQueue.push([dimName, x, y, z], [dimName, x, y + 1, z]);
}

function gravityTick() {
  let budget = 64;
  while (gravityQueue.length && budget-- > 0) {
    const [dimName, x, y, z] = gravityQueue.shift();
    const dim = game.dims[dimName];
    if (!dim) continue;
    const id = dim.world.getBlock(x, y, z);
    if (!BLOCK_INFO[id].gravity) continue;
    const below = dim.world.getBlock(x, y - 1, z);
    if (BLOCK_INFO[below].solid) continue;
    dim.world.setBlock(x, y, z, B.AIR);
    addEntityTo(dim, new FallingBlock(id, x, y, z, blockMesh));
  }
}

// Kontext, den Entities beim Tick bekommen
const _lookDir = new THREE.Vector3();
function entityCtx() {
  camera.getWorldDirection(_lookDir);
  return {
    player: game.player,
    world: curWorld(),
    entities: curDim().entities,
    spawnDrop, spawnArrow, spawnFireball, explode,
    look: {
      x: camera.position.x, y: camera.position.y, z: camera.position.z,
      dx: _lookDir.x, dy: _lookDir.y, dz: _lookDir.z,
    },
    dragon: game.dragon,
    dragonPerch: END_EXIT.perch,
    onDragonDeath,
    sound: S,
    village: game.villageCache,
    isNight: isNight(),
  };
}

// ============ Spawning / Entities ============
function addEntityTo(dim, e) {
  dim.entities.push(e);
  dim.scene.add(e.group);
  return e;
}

function addEntity(e) {
  return addEntityTo(curDim(), e);
}

function spawnDrop(itemId, count, x, y, z, dur = undefined) {
  return addEntity(new ItemDrop(itemId, count, x, y, z, atlasCanvas, dur));
}

function spawnArrow(x, y, z, vx, vy, vz, fromPlayer = false) {
  return addEntity(new Arrow(x, y, z, vx, vy, vz, fromPlayer));
}

function spawnFireball(x, y, z, vx, vy, vz) {
  return addEntity(new Fireball(x, y, z, vx, vy, vz));
}

function spawnMob(type, x, y, z) {
  return addEntity(new Mob(type, x, y, z));
}

function explode(x, y, z, power) {
  const world = curWorld();
  const r = Math.ceil(power);
  const skip = new Set([
    B.AIR, B.BEDROCK, B.OBSIDIAN, B.PORTAL, B.END_PORTAL, B.WATER, B.LAVA,
    B.END_FRAME, B.END_FRAME_EYE, B.DRAGON_EGG,
  ]);
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) > power) continue;
        const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz;
        const id = world.getBlock(bx, by, bz);
        if (skip.has(id)) continue;
        // Kettenreaktion: TNT wird gezündet statt zerstört
        if (id === B.TNT) {
          world.setBlock(bx, by, bz, B.AIR);
          addEntity(new PrimedTNT(bx, by, bz, blockMesh, 0.4 + Math.random() * 0.6));
          continue;
        }
        if (id === B.CHEST) dropChestContents(bx, by, bz);
        world.setBlock(bx, by, bz, B.AIR);
        if (Math.random() < 0.25) {
          for (const d of dropsForBlock(id)) spawnDrop(d.id, d.count, bx + 0.5, by + 0.5, bz + 0.5);
        }
      }
    }
  }
  addEntity(new Explosion(x, y, z, power));
  S.explode();
  const p = game.player;
  const pd = Math.hypot(p.pos.x - x, (p.pos.y + 0.9) - y, p.pos.z - z);
  if (pd < power * 2) {
    const dmg = Math.round((1 - pd / (power * 2)) * 15);
    const d = Math.hypot(p.pos.x - x, p.pos.z - z) || 1;
    p.hurt(dmg, (p.pos.x - x) / d * 8, (p.pos.z - z) / d * 8);
  }
  for (const e of curDim().entities) {
    if (!e.hittable || e.dead || e instanceof EndCrystal) continue;
    const md = Math.hypot(e.pos.x - x, e.pos.y + 0.9 - y, e.pos.z - z);
    if (md < power * 2) {
      const dmg = Math.round((1 - md / (power * 2)) * 15);
      const d = Math.hypot(e.pos.x - x, e.pos.z - z) || 1;
      e.hurt(dmg, (e.pos.x - x) / d * 8, (e.pos.z - z) / d * 8, entityCtx());
    }
  }
}

function isNight() {
  return game.dimName === 'over' && skyBrightness() < 0.35;
}

// Effektives Licht (0-15) an einer Position, tageszeitabhängig
function effectiveLight(x, y, z) {
  const packed = curWorld().getLight(Math.floor(x), Math.floor(y), Math.floor(z));
  const day = game.dimName === 'over' ? (0.22 + 0.78 * skyBrightness()) : 0.3;
  return Math.max(blockOf(packed), skyOf(packed) * day);
}

function spawnManagerTick(dt) {
  game.spawnTimer -= dt;
  if (game.spawnTimer > 0) return;
  game.spawnTimer = SPAWN_INTERVAL;
  if (game.dimName === 'end') return;

  const world = curWorld();
  const ents = curDim().entities;
  const p = game.player;
  let hostile = 0, passive = 0, villagers = 0, golems = 0;
  for (const e of ents) {
    if (!(e instanceof Mob) || e.dead) continue;
    if (e.type === 'villager') villagers++;
    else if (e.type === 'golem') golems++;
    else if (e.def.hostile) hostile++;
    else passive++;
  }

  const surfacePos = () => {
    const ang = Math.random() * Math.PI * 2;
    const dist = 24 + Math.random() * 20;
    const x = Math.floor(p.pos.x + Math.cos(ang) * dist);
    const z = Math.floor(p.pos.z + Math.sin(ang) * dist);
    if (!world.hasData(x, z)) return null;
    const y = world.findFloor(x, z, game.dimName === 'nether' ? H / 2 + 4 : H - 2);
    if (y < 0) return null;
    return { x, y, z };
  };
  // Höhlen-Spawn: zufällige Tiefe, dunkel
  const cavePos = () => {
    const ang = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 26;
    const x = Math.floor(p.pos.x + Math.cos(ang) * dist);
    const z = Math.floor(p.pos.z + Math.sin(ang) * dist);
    if (!world.hasData(x, z)) return null;
    const yTop = 6 + Math.floor(Math.random() * (SEA_LEVEL - 4));
    const y = world.findFloor(x, z, yTop);
    if (y < 0) return null;
    return { x, y, z };
  };

  if (game.mode === 'survival' && hostile < MOB_CAP_HOSTILE) {
    if (game.dimName === 'nether') {
      const pos = surfacePos();
      if (pos) {
        const r = Math.random();
        const type = r < 0.45 ? 'blaze' : r < 0.75 ? 'zombie' : 'skeleton';
        spawnMob(type, pos.x + 0.5, pos.y + 1, pos.z + 0.5);
      }
    } else {
      // Overworld: nachts an der Oberfläche, jederzeit in dunklen Höhlen
      const pos = Math.random() < 0.5 ? surfacePos() : cavePos();
      if (pos && effectiveLight(pos.x, pos.y + 1, pos.z) < 6) {
        const r = Math.random();
        const type = r < 0.3 ? 'zombie' : r < 0.55 ? 'skeleton' : r < 0.8 ? 'creeper' : 'enderman';
        spawnMob(type, pos.x + 0.5, pos.y + 1, pos.z + 0.5);
      }
    }
  }
  if (game.dimName === 'over' && !isNight() && passive < MOB_CAP_PASSIVE) {
    const pos = surfacePos();
    if (pos && world.getBlock(pos.x, pos.y, pos.z) === B.GRASS) {
      spawnMob(Math.random() < 0.5 ? 'sheep' : 'cow', pos.x + 0.5, pos.y + 1, pos.z + 0.5);
    }
  }

  // Dorfbewohner + Eisengolem in Dorfnähe
  const v = game.villageCache;
  if (game.dimName === 'over' && v && Math.hypot(v.cx - p.pos.x, v.cz - p.pos.z) < 56) {
    if (villagers < Math.min(4, v.houses.length)) {
      const x = v.cx + ((Math.random() * 14) | 0) - 7;
      const z = v.cz + ((Math.random() * 14) | 0) - 7;
      if (world.hasData(x, z)) {
        const y = world.findFloor(x, z);
        if (y > 0) spawnMob('villager', x + 0.5, y + 1, z + 0.5);
      }
    }
    if (golems < 1 && villagers >= 1) {
      const y = world.findFloor(v.cx + 3, v.cz + 3);
      if (y > 0) spawnMob('golem', v.cx + 3.5, y + 1, v.cz + 3.5);
    }
  }
}

// Monster-Spawner (Dungeons)
function spawnerTick(dt) {
  const dim = curDim();
  const world = dim.world;
  const p = game.player;
  for (const [key, s] of world.spawners) {
    const d = Math.hypot(s.x - p.pos.x, s.y - (p.pos.y + 1), s.z - p.pos.z);
    if (d > 14) continue;
    let t = dim.spawnerTimers.get(key) || 0;
    t -= dt;
    if (t <= 0) {
      t = 4 + Math.random() * 3;
      const hostiles = dim.entities.filter(e => e instanceof Mob && !e.dead && e.def.hostile && e.distTo(s) < 10).length;
      if (hostiles < 5) {
        const type = world.hash3(s.x, s.z, 7777) < 0.5 ? 'zombie' : 'skeleton';
        const ox = s.x + 0.5 + (Math.random() * 4 - 2);
        const oz = s.z + 0.5 + (Math.random() * 4 - 2);
        const oy = world.findFloor(Math.floor(ox), Math.floor(oz), s.y + 3);
        if (oy > 0) spawnMob(type, ox, oy + 1, oz);
      }
    }
    dim.spawnerTimers.set(key, t);
  }
}

function entitiesTick(dt) {
  const ents = curDim().entities;
  const ctx = entityCtx();
  const p = game.player;
  for (const e of ents) {
    if (e.dead) continue;
    e.tick(dt, ctx);
    if (e instanceof ItemDrop && !e.dead && !p.dead && e.age > e.pickupDelay) {
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.y - (p.pos.y + 0.8), e.pos.z - p.pos.z);
      if (d < 1.0) {
        const rest = game.inventory.add(e.itemId, e.count, e.dur);
        if (rest === 0) { e.dead = true; renderHotbar(); S.pickup(); }
        else e.count = rest;
      }
    }
    if (e instanceof Mob && !e.def.persist && e.distTo(p.pos) > DESPAWN_DIST) e.dead = true;
  }
  for (let i = ents.length - 1; i >= 0; i--) {
    if (ents[i].dead) {
      ents[i].dispose(curDim().scene);
      ents.splice(i, 1);
    }
  }
}

// ============ Ofen ============
const posKey = (x, y, z) => x + ',' + y + ',' + z;

function getFurnace(x, y, z) {
  const map = game.furnaces[game.dimName];
  const k = posKey(x, y, z);
  let f = map.get(k);
  if (!f) {
    f = { x, y, z, in: null, fuel: null, out: null, burn: 0, burnMax: 0, progress: 0 };
    map.set(k, f);
  }
  return f;
}

function setFurnaceLit(world, f, lit) {
  const cur = world.getBlock(f.x, f.y, f.z);
  if (lit && cur === B.FURNACE) world.setBlock(f.x, f.y, f.z, B.FURNACE_LIT);
  if (!lit && cur === B.FURNACE_LIT) world.setBlock(f.x, f.y, f.z, B.FURNACE);
}

function furnaceTick(dt) {
  const map = game.furnaces[game.dimName];
  if (!map.size) return;
  const world = curWorld();
  for (const f of map.values()) {
    const smelt = f.in ? SMELT[f.in.id] : null;
    const canSmelt = !!smelt && (!f.out ||
      (f.out.id === smelt.id && f.out.count + smelt.count <= itemInfo(smelt.id).stack));
    if (f.burn <= 0 && canSmelt && f.fuel) {
      const dur = FUEL[f.fuel.id] || 0;
      if (dur > 0) {
        f.burn = f.burnMax = dur;
        // Lavaeimer hinterlässt den leeren Eimer
        if (f.fuel.id === I.LAVA_BUCKET) f.fuel = { id: I.BUCKET, count: 1 };
        else {
          f.fuel.count--;
          if (f.fuel.count <= 0) f.fuel = null;
        }
        setFurnaceLit(world, f, true);
      }
    }
    if (f.burn > 0) {
      f.burn -= dt;
      if (canSmelt) {
        f.progress += dt;
        if (f.progress >= 10) {
          f.progress = 0;
          f.in.count--;
          if (f.in.count <= 0) f.in = null;
          if (f.out) f.out.count += smelt.count;
          else f.out = { id: smelt.id, count: smelt.count };
        }
      } else {
        f.progress = Math.max(0, f.progress - 2 * dt);
      }
      if (f.burn <= 0) setFurnaceLit(world, f, false);
    } else if (f.progress > 0) {
      f.progress = Math.max(0, f.progress - 2 * dt);
    }
  }
}

// ============ Truhen ============
function getChest(x, y, z, generateLoot) {
  const map = game.chests[game.dimName];
  const k = posKey(x, y, z);
  let c = map.get(k);
  if (!c) {
    c = { slots: new Array(27).fill(null) };
    if (generateLoot) {
      const table = lootTableAt(curWorld().structCtx, x, y, z);
      if (table) c.slots = rollLoot(table, Math.random);
    }
    map.set(k, c);
  }
  return c;
}

function dropChestContents(x, y, z) {
  const map = game.chests[game.dimName];
  const k = posKey(x, y, z);
  const c = map.get(k);
  if (c) {
    for (const s of c.slots) {
      if (s) spawnDrop(s.id, s.count, x + 0.5, y + 0.5, z + 0.5, s.dur);
    }
    map.delete(k);
  }
}

// ============ Tag/Nacht & Himmel ============
function skyBrightness() {
  const t = game.time;
  let b;
  if (t < 0.45) b = 1;
  else if (t < 0.55) b = 1 - (t - 0.45) / 0.1;
  else if (t < 0.9) b = 0;
  else b = (t - 0.9) / 0.1;
  return b;
}

const _sky = new THREE.Color();
function updateEnvironment(dt) {
  const dim = curDim();
  let bright;
  if (game.dimName === 'over') {
    const b = skyBrightness();
    _sky.copy(ENV.over.night).lerp(ENV.over.day, b);
    bright = 0.22 + 0.78 * b;
  } else {
    _sky.copy(ENV[game.dimName].fixed);
    bright = ENV[game.dimName].bright;
  }
  dayLight.value = bright;

  const eyeBlock = curWorld().getBlock(
    Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z));
  const under = isWater(eyeBlock);
  if (under !== underwater) {
    underwater = under;
    document.body.classList.toggle('underwater', under);
  }
  if (under) _sky.copy(ENV.over.water).multiplyScalar(Math.max(0.35, bright));

  dim.scene.background.copy(_sky);
  dim.scene.fog.color.copy(_sky);
  const R = curWorld().R;
  if (under) { dim.scene.fog.near = 1; dim.scene.fog.far = 18; }
  else if (game.dimName === 'nether') { dim.scene.fog.near = 10; dim.scene.fog.far = 70; }
  else { dim.scene.fog.near = R * CS * 0.55; dim.scene.fog.far = R * CS * 0.95; }

  dim.hemi.intensity = 0.35 + bright * 0.75;
  dim.sun.intensity = 0.15 + bright * 0.45;

  if (dim.sky) {
    const p = game.player.pos;
    const a = game.time * Math.PI * 2;
    dim.sky.sun.position.set(p.x + Math.cos(a) * 400, Math.sin(a) * 400, p.z);
    dim.sky.moon.position.set(p.x - Math.cos(a) * 400, -Math.sin(a) * 400, p.z);
    dim.sky.sun.lookAt(camera.position);
    dim.sky.moon.lookAt(camera.position);
    dim.sky.sun.visible = Math.sin(a) > -0.15;
    dim.sky.moon.visible = -Math.sin(a) > -0.15;
    dim.sky.stars.position.set(p.x, 0, p.z);
    dim.sky.stars.material.opacity = (1 - skyBrightness()) * 0.9;
    dim.sky.clouds.position.set(p.x, H + 26, p.z);
    dim.sky.clouds.material.opacity = SETTINGS.quality === 'low' ? 0 : 0.5;
    dim.sky.cloudTex.offset.x += dt * 0.0018;
    dim.sky.cloudTex.offset.y = p.z / 400 * 0.0;
  }
}

// ============ Interaktion ============
const dirVec = new THREE.Vector3();
function rayFromCamera() {
  camera.getWorldDirection(dirVec);
  return curWorld().raycast(
    camera.position.x, camera.position.y, camera.position.z,
    dirVec.x, dirVec.y, dirVec.z, REACH
  );
}

function heldStack() {
  return game.inventory.slots[selected];
}

function heldToolInfo() {
  const s = heldStack();
  return s ? itemInfo(s.id) : null;
}

// Haltbarkeit des gehaltenen Items verbrauchen
function damageHeld(amount = 1) {
  if (game.mode !== 'survival') return;
  const s = heldStack();
  if (!s) return;
  const max = maxDurOf(s.id);
  if (!max) return;
  if (s.dur === undefined) s.dur = max;
  s.dur -= amount;
  if (s.dur <= 0) {
    game.inventory.slots[selected] = null;
    S.mobHurt();
    toast(`${itemInfo(s.id).name} ist zerbrochen!`);
  }
  renderHotbar();
}

function breakTimeFor(blockId) {
  const info = BLOCK_INFO[blockId];
  if (info.hardness === Infinity) return Infinity;
  const tool = heldToolInfo();
  if (tool && tool.tool && tool.tool.kind === info.tool) return info.hardness / tool.tool.speed;
  return info.hardness;
}

function rayAABB(ox, oy, oz, dx, dy, dz, min, max) {
  let tmin = 0, tmax = Infinity;
  const o = [ox, oy, oz], d = [dx, dy, dz], lo = [min.x, min.y, min.z], hi = [max.x, max.y, max.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < lo[i] || o[i] > hi[i]) return null;
    } else {
      let t1 = (lo[i] - o[i]) / d[i];
      let t2 = (hi[i] - o[i]) / d[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

function pickMob() {
  camera.getWorldDirection(dirVec);
  const blockHit = rayFromCamera();
  const maxDist = blockHit ? blockHit.dist : REACH;
  let best = null, bestT = Infinity;
  for (const e of curDim().entities) {
    if (!e.hittable || e.dead) continue;
    const hw = e.w / 2 + 0.1;
    const t = rayAABB(
      camera.position.x, camera.position.y, camera.position.z,
      dirVec.x, dirVec.y, dirVec.z,
      { x: e.pos.x - hw, y: e.pos.y, z: e.pos.z - hw },
      { x: e.pos.x + hw, y: e.pos.y + e.h + 0.1, z: e.pos.z + hw });
    if (t !== null && t < bestT && t <= maxDist) { bestT = t; best = e; }
  }
  return best;
}

function tryAttack() {
  const p = game.player;
  if (p.attackTimer > 0) return false;
  if (game.mp && tryAttackPlayer()) return true;
  const mob = pickMob();
  if (!mob) return false;
  p.attackTimer = ATTACK_COOLDOWN;
  const tool = heldToolInfo();
  const dmg = tool && tool.damage ? tool.damage : 1;
  const dx = mob.pos.x - p.pos.x, dz = mob.pos.z - p.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  mob.hurt(dmg, dx / d * 6, dz / d * 6, entityCtx());
  S.mobHurt();
  damageHeld(1);
  p.exhaustion += 0.1;
  return true;
}

function finishBreak(x, y, z, id) {
  const world = curWorld();

  // Türen/Betten: beide Hälften entfernen, genau 1 Item droppen
  if (id === B.DOOR_L || id === B.DOOR_U || id === B.DOOR_L_OPEN || id === B.DOOR_U_OPEN) {
    const lowerY = (id === B.DOOR_U || id === B.DOOR_U_OPEN) ? y - 1 : y;
    world.setBlock(x, lowerY, z, B.AIR);
    world.setBlock(x, lowerY + 1, z, B.AIR);
    S.dig();
    if (game.mode === 'survival') spawnDrop(B.DOOR_L, 1, x + 0.5, lowerY + 0.5, z + 0.5);
    return;
  }
  if (id === B.BED_FOOT || id === B.BED_HEAD) {
    world.setBlock(x, y, z, B.AIR);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nb = world.getBlock(x + dx, y, z + dz);
      if (nb === B.BED_FOOT || nb === B.BED_HEAD) { world.setBlock(x + dx, y, z + dz, B.AIR); break; }
    }
    S.dig();
    if (game.mode === 'survival') spawnDrop(B.BED_FOOT, 1, x + 0.5, y + 0.5, z + 0.5);
    return;
  }

  world.setBlock(x, y, z, B.AIR);
  S.dig();
  if (game.mode !== 'survival') {
    if (id === B.CHEST) game.chests[game.dimName].delete(posKey(x, y, z));
    return;
  }

  if (id === B.FURNACE || id === B.FURNACE_LIT) {
    const map = game.furnaces[game.dimName];
    const f = map.get(posKey(x, y, z));
    if (f) {
      for (const s of [f.in, f.fuel, f.out]) {
        if (s) spawnDrop(s.id, s.count, x + 0.5, y + 0.5, z + 0.5);
      }
      map.delete(posKey(x, y, z));
    }
  }
  if (id === B.CHEST) dropChestContents(x, y, z);

  const info = BLOCK_INFO[id];
  let allowed = true;
  if (info.minTier > 0) {
    const tool = heldToolInfo();
    allowed = !!(tool && tool.tool && tool.tool.kind === info.tool && tool.tool.tier >= info.minTier);
  }
  if (allowed) {
    for (const d of dropsForBlock(id)) spawnDrop(d.id, d.count, x + 0.5, y + 0.3, z + 0.5);
  }
  if (info.hardness > 0.1) damageHeld(1);
  game.player.exhaustion += 0.03;
}

function miningTick(dt) {
  if (game.mode !== 'survival') return;
  if (!mouseLeft || appState !== 'playing' || game.player.dead) { mining = null; breakOverlay.hide(); return; }
  const hit = rayFromCamera();
  if (!hit) { mining = null; breakOverlay.hide(); return; }
  if (!mining || mining.x !== hit.x || mining.y !== hit.y || mining.z !== hit.z) {
    mining = { x: hit.x, y: hit.y, z: hit.z, progress: 0, total: breakTimeFor(hit.id) };
    viewModel.swing();
  }
  if (mining.total === Infinity) { breakOverlay.hide(); return; }
  mining.progress += dt;
  if (Math.random() < dt * 6) viewModel.swing();
  if (mining.progress >= mining.total) {
    finishBreak(hit.x, hit.y, hit.z, hit.id);
    mining = null;
    breakOverlay.hide();
    return;
  }
  breakOverlay.show(mining.x, mining.y, mining.z, mining.progress / mining.total);
}

function creativeMine() {
  const hit = rayFromCamera();
  if (!hit || hit.id === B.BEDROCK) return;
  viewModel.swing();
  finishBreak(hit.x, hit.y, hit.z, hit.id);
}

function intersectsPlayer(bx, by, bz) {
  const p = game.player;
  const hw = PLAYER_WIDTH / 2;
  return bx < p.pos.x + hw && bx + 1 > p.pos.x - hw &&
         by < p.pos.y + PLAYER_HEIGHT && by + 1 > p.pos.y &&
         bz < p.pos.z + hw && bz + 1 > p.pos.z - hw;
}

// Feuerzeug: Portalrahmen zünden
function tryIgnitePortal(tx, ty, tz) {
  const world = curWorld();
  const check = (fx, fy, fz, axis) => {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 5; j++) {
        const frame = i === 0 || i === 3 || j === 0 || j === 4;
        const wx = axis === 'x' ? fx + i : fx;
        const wz = axis === 'x' ? fz : fz + i;
        const id = world.getBlock(wx, fy + j, wz);
        if (frame && id !== B.OBSIDIAN) return false;
        if (!frame && id !== B.AIR) return false;
      }
    }
    return true;
  };
  for (const axis of ['x', 'z']) {
    for (const i of [1, 2]) {
      for (const j of [1, 2, 3]) {
        const fx = axis === 'x' ? tx - i : tx;
        const fz = axis === 'x' ? tz : tz - i;
        const fy = ty - j;
        if (!check(fx, fy, fz, axis)) continue;
        for (const ii of [1, 2]) {
          for (const jj of [1, 2, 3]) {
            const wx = axis === 'x' ? fx + ii : fx;
            const wz = axis === 'x' ? fz : fz + ii;
            world.setBlock(wx, fy + jj, wz, B.PORTAL);
          }
        }
        return true;
      }
    }
  }
  return false;
}

function checkEndPortalComplete(x, y, z) {
  const world = curWorld();
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, eyes = 0;
  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      const id = world.getBlock(x + dx, y, z + dz);
      if (id === B.END_FRAME) return;
      if (id === B.END_FRAME_EYE) {
        eyes++;
        minX = Math.min(minX, x + dx); maxX = Math.max(maxX, x + dx);
        minZ = Math.min(minZ, z + dz); maxZ = Math.max(maxZ, z + dz);
      }
    }
  }
  if (eyes < 12) return;
  const cx = Math.round((minX + maxX) / 2), cz = Math.round((minZ + maxZ) / 2);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      world.setBlock(cx + dx, y, cz + dz, B.END_PORTAL);
    }
  }
  S.levelup();
  toast('Das End-Portal ist aktiviert!');
}

// Fluid-Quelle entlang des Blicks finden (für Eimer)
function findFluidOnRay(maxDist) {
  camera.getWorldDirection(dirVec);
  const solidHit = rayFromCamera();
  const limit = solidHit ? solidHit.dist : maxDist;
  for (let t = 0.4; t < limit; t += 0.25) {
    const x = Math.floor(camera.position.x + dirVec.x * t);
    const y = Math.floor(camera.position.y + dirVec.y * t);
    const z = Math.floor(camera.position.z + dirVec.z * t);
    const id = curWorld().getBlock(x, y, z);
    if (id === B.WATER || id === B.LAVA) return { x, y, z, id };
  }
  return null;
}

// Rechtsklick-Aktion (sofortige Interaktionen; Essen/Bogen laufen über Halten)
function performUse() {
  const p = game.player;

  // Dorfbewohner: Handel
  const mob = pickMob();
  if (mob instanceof Mob && mob.type === 'villager' && game.mode === 'survival') {
    openInventory('trade');
    S.click();
    return;
  }

  const hit = rayFromCamera();

  if (hit) {
    // Türen
    if (hit.id === B.DOOR_L || hit.id === B.DOOR_U || hit.id === B.DOOR_L_OPEN || hit.id === B.DOOR_U_OPEN) {
      const lowerY = (hit.id === B.DOOR_U || hit.id === B.DOOR_U_OPEN) ? hit.y - 1 : hit.y;
      const open = hit.id === B.DOOR_L_OPEN || hit.id === B.DOOR_U_OPEN;
      curWorld().setBlock(hit.x, lowerY, hit.z, open ? B.DOOR_L : B.DOOR_L_OPEN);
      curWorld().setBlock(hit.x, lowerY + 1, hit.z, open ? B.DOOR_U : B.DOOR_U_OPEN);
      S.door();
      return;
    }
    // Bett: Spawnpunkt + Nacht überspringen
    if (hit.id === B.BED_FOOT || hit.id === B.BED_HEAD) {
      if (game.dimName !== 'over') { toast('Hier kannst du nicht schlafen.'); return; }
      game.spawn = { x: hit.x + 0.5, y: hit.y + 1.01, z: hit.z + 0.5 };
      if (isNight()) {
        game.time = 0.005;
        S.sleep();
        toast('Du bist eingeschlafen… Guten Morgen! (Spawnpunkt gesetzt)');
      } else {
        toast('Spawnpunkt gesetzt – schlafen geht nur nachts.');
      }
      return;
    }
    if (game.mode === 'survival' && hit.id === B.CRAFTING_TABLE) { openInventory('table'); return; }
    if (game.mode === 'survival' && (hit.id === B.FURNACE || hit.id === B.FURNACE_LIT)) {
      appState = 'inventory';
      game.invUI.open('furnace', getFurnace(hit.x, hit.y, hit.z));
      document.exitPointerLock?.();
      return;
    }
    if (hit.id === B.CHEST) {
      appState = 'inventory';
      game.invUI.open('chest', getChest(hit.x, hit.y, hit.z, true));
      S.chest();
      document.exitPointerLock?.();
      return;
    }
  }

  const stack = heldStack();
  if (!stack) return;
  const info = itemInfo(stack.id);

  // Enderauge in Portalrahmen
  if (stack.id === I.ENDER_EYE && hit && hit.id === B.END_FRAME && game.mode === 'survival') {
    curWorld().setBlock(hit.x, hit.y, hit.z, B.END_FRAME_EYE);
    game.inventory.removeFromSlot(selected, 1);
    renderHotbar();
    S.eye();
    checkEndPortalComplete(hit.x, hit.y, hit.z);
    return;
  }
  // Enderauge werfen
  if (stack.id === I.ENDER_EYE && game.dimName === 'over') {
    const sh = nearestStructure(rx => strongholdInRegion(curWorld().structCtx, rx.x, rx.z), STRONGHOLD_REGION, 3);
    if (sh) {
      addEntity(new EyeFlyer(p.pos.x, p.pos.y + 1.6, p.pos.z, sh.x - p.pos.x, sh.z - p.pos.z, atlasCanvas));
      S.eye();
      toast(`Das Auge fliegt Richtung Festung (${Math.round(Math.hypot(sh.x - p.pos.x, sh.z - p.pos.z))} m)`);
      if (game.mode === 'survival' && Math.random() < 0.2) {
        game.inventory.removeFromSlot(selected, 1);
        renderHotbar();
      }
    }
    return;
  }
  // Feuerzeug: TNT zünden oder Portal anzünden
  if (stack.id === I.FLINT_STEEL && hit) {
    if (hit.id === B.TNT) {
      curWorld().setBlock(hit.x, hit.y, hit.z, B.AIR);
      addEntity(new PrimedTNT(hit.x, hit.y, hit.z, blockMesh, 3));
      S.fuse();
      damageHeld(1);
      return;
    }
    if (tryIgnitePortal(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz)) {
      S.ignite();
      damageHeld(1);
    }
    return;
  }
  // Eimer
  if (stack.id === I.BUCKET) {
    const fl = findFluidOnRay(REACH);
    if (fl) {
      curWorld().setBlock(fl.x, fl.y, fl.z, B.AIR);
      game.inventory.removeFromSlot(selected, 1);
      const rest = game.inventory.add(fl.id === B.WATER ? I.WATER_BUCKET : I.LAVA_BUCKET, 1);
      if (rest > 0) spawnDrop(fl.id === B.WATER ? I.WATER_BUCKET : I.LAVA_BUCKET, 1, p.pos.x, p.pos.y + 1, p.pos.z);
      S.splash();
      renderHotbar();
    }
    return;
  }
  if ((stack.id === I.WATER_BUCKET || stack.id === I.LAVA_BUCKET) && hit) {
    const tx = hit.x + hit.nx, ty = hit.y + hit.ny, tz = hit.z + hit.nz;
    const cur = curWorld().getBlock(tx, ty, tz);
    if (!BLOCK_INFO[cur].solid) {
      curWorld().setBlock(tx, ty, tz, stack.id === I.WATER_BUCKET ? B.WATER : B.LAVA);
      game.inventory.removeFromSlot(selected, 1);
      const rest = game.inventory.add(I.BUCKET, 1);
      if (rest > 0) spawnDrop(I.BUCKET, 1, p.pos.x, p.pos.y + 1, p.pos.z);
      S.splash();
      renderHotbar();
    }
    return;
  }

  // Block platzieren
  if (stack.id >= 100 || !hit) return;
  const tx = hit.x + hit.nx, ty = hit.y + hit.ny, tz = hit.z + hit.nz;
  if (ty < 1 || ty >= H) return;
  if (BLOCK_INFO[curWorld().getBlock(tx, ty, tz)].solid) return;
  if (intersectsPlayer(tx, ty, tz)) return;

  // Tür: 2 Blöcke hoch
  if (stack.id === B.DOOR_L) {
    if (BLOCK_INFO[curWorld().getBlock(tx, ty + 1, tz)].solid || intersectsPlayer(tx, ty + 1, tz)) return;
    curWorld().setBlock(tx, ty, tz, B.DOOR_L);
    curWorld().setBlock(tx, ty + 1, tz, B.DOOR_U);
    S.place();
    if (game.mode === 'survival') { game.inventory.removeFromSlot(selected, 1); renderHotbar(); }
    viewModel.swing();
    return;
  }
  // Bett: 2 Blöcke lang (Blickrichtung)
  if (stack.id === B.BED_FOOT) {
    const dxs = Math.abs(Math.sin(p.yaw)) > Math.abs(Math.cos(p.yaw)) ? -Math.sign(Math.sin(p.yaw)) : 0;
    const dzs = dxs === 0 ? -Math.sign(Math.cos(p.yaw)) : 0;
    const hx = tx + dxs, hz = tz + dzs;
    if (BLOCK_INFO[curWorld().getBlock(hx, ty, hz)].solid || intersectsPlayer(hx, ty, hz)) return;
    curWorld().setBlock(tx, ty, tz, B.BED_FOOT);
    curWorld().setBlock(hx, ty, hz, B.BED_HEAD);
    S.place();
    if (game.mode === 'survival') { game.inventory.removeFromSlot(selected, 1); renderHotbar(); }
    viewModel.swing();
    return;
  }

  if (curWorld().setBlock(tx, ty, tz, stack.id)) {
    if (stack.id === B.CHEST) getChest(tx, ty, tz, false); // leerer Spieler-Chest-State
    S.place();
    viewModel.swing();
    if (game.mode === 'survival') {
      game.inventory.removeFromSlot(selected, 1);
      renderHotbar();
    }
  }
}

// Halten-Aktionen: Essen + Bogen
function useHoldTick(dt) {
  const p = game.player;
  if (!rightHeld || appState !== 'playing' || p.dead) {
    if (bowCharge >= 0.3) shootBow();
    bowCharge = -1;
    eatProgress = 0;
    p.eating = false;
    eatbarWrap.classList.add('hidden');
    return;
  }
  const stack = heldStack();
  const info = stack ? itemInfo(stack.id) : null;

  // Essen (1.6 s halten)
  if (info && info.food && game.mode === 'survival' && (p.hunger < 20 || info.heal)) {
    p.eating = true;
    eatProgress += dt;
    eatbarWrap.classList.remove('hidden');
    eatbar.style.width = Math.min(100, eatProgress / EAT_DURATION * 100) + '%';
    if (Math.random() < dt * 6) S.eat();
    if (eatProgress >= EAT_DURATION) {
      p.eat(info.food, info.heal || 0);
      game.inventory.removeFromSlot(selected, 1);
      eatProgress = 0;
      p.eating = false;
      eatbarWrap.classList.add('hidden');
      S.burp();
      renderHotbar();
      renderStatus();
      rightHeld = false;
    }
    return;
  }
  p.eating = false;
  eatProgress = 0;
  eatbarWrap.classList.add('hidden');

  // Bogen spannen
  if (info && stack.id === I.BOW) {
    const hasArrow = game.mode !== 'survival' || game.inventory.countOf(I.ARROW) > 0;
    if (!hasArrow) { bowCharge = -1; return; }
    if (bowCharge < 0) bowCharge = 0;
    bowCharge = Math.min(1.2, bowCharge + dt);
    return;
  }

  // Wiederholtes Platzieren beim Halten
  useRepeat -= dt;
  if (useRepeat <= 0) {
    useRepeat = 0.25;
    performUse();
  }
}

function shootBow() {
  const p = game.player;
  const power = Math.min(1, bowCharge);
  bowCharge = -1;
  if (game.mode === 'survival') {
    if (game.inventory.countOf(I.ARROW) <= 0) return;
    game.inventory.removeById(I.ARROW, 1);
    damageHeld(1);
  }
  camera.getWorldDirection(dirVec);
  const v = 10 + power * 20;
  spawnArrow(
    camera.position.x + dirVec.x * 0.4,
    camera.position.y + dirVec.y * 0.4 - 0.1,
    camera.position.z + dirVec.z * 0.4,
    dirVec.x * v, dirVec.y * v, dirVec.z * v, true);
  S.bow();
  viewModel.swing();
  renderHotbar();
}

// Druckplatten (TNT-Fallen)
function pressurePlateTick() {
  const p = game.player;
  const bx = Math.floor(p.pos.x), by = Math.floor(p.pos.y + 0.1), bz = Math.floor(p.pos.z);
  if (curWorld().getBlock(bx, by, bz) !== B.PRESSURE_PLATE) return;
  let found = false;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -3; dy <= 1; dy++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (curWorld().getBlock(bx + dx, by + dy, bz + dz) === B.TNT) {
          curWorld().setBlock(bx + dx, by + dy, bz + dz, B.AIR);
          addEntity(new PrimedTNT(bx + dx, by + dy, bz + dz, blockMesh, 1 + Math.random()));
          found = true;
        }
      }
    }
  }
  if (found) {
    curWorld().setBlock(bx, by, bz, B.AIR);
    S.fuse();
    toast('Eine Falle!');
  }
}

// ============ Dimensionen & Portale ============
function attachCameraTo(scene) {
  highlight.parent?.remove(highlight);
  scene.add(highlight);
  scene.add(camera);
  if (breakOverlay) breakOverlay.attach(scene);
}

function switchDim(name) {
  if (!game.dims[name]) game.dims[name] = createDim(name);
  game.dimName = name;
  game.player.world = game.dims[name].world;
  attachCameraTo(game.dims[name].scene);
  portalLock = true;
  portalTimer = 0;
  S.portal();
  if (name === 'end') maybeSpawnDragon();
}

function ensurePortalArrival(x, z) {
  const world = curWorld();
  world.pregenerate(x, z, 2);

  for (let dy = 1; dy < H - 1; dy++) {
    for (let dx = -10; dx <= 10; dx += 2) {
      for (let dz = -10; dz <= 10; dz += 2) {
        if (world.getBlock(x + dx, dy, z + dz) === B.PORTAL) {
          const sx = x + dx, sz = z + dz + 1;
          let fy = world.findFloor(sx, sz, dy + 2);
          if (fy <= 0 || isLava(world.getBlock(sx, fy, sz))) {
            fy = Math.max(1, dy - 1);
            world.setBlock(sx, fy, sz, game.dimName === 'nether' ? B.NETHERRACK : B.COBBLE);
            for (let i = 1; i <= 2; i++) world.setBlock(sx, fy + i, sz, B.AIR);
          }
          return { x: sx + 0.5, y: fy + 1.01, z: sz + 0.5 };
        }
      }
    }
  }

  let y;
  if (game.dimName === 'nether') {
    y = world.findFloor(x, z, H / 2 + 2);
    if (y < 16) y = 34;
  } else {
    y = world.findFloor(x, z);
    if (y < 1) y = world.findGround(x, z);
  }

  const pad = game.dimName === 'nether' ? B.NETHERRACK : B.COBBLE;
  for (let dx = -2; dx <= 5; dx++) {
    for (let dz = -2; dz <= 3; dz++) {
      if (!BLOCK_INFO[world.getBlock(x + dx, y, z + dz)].solid) {
        world.setBlock(x + dx, y, z + dz, pad);
      }
      for (let dy = 1; dy <= 5; dy++) world.setBlock(x + dx, y + dy, z + dz, B.AIR);
    }
  }
  const put = (wx, wy, wz, id) => world.setBlock(wx, wy, wz, id);
  rasterizePortalFrame(x, y + 1, z, 'x', put, true);
  return { x: x + 1.5, y: y + 1.01, z: z + 1.5 };
}

function portalCheck(dt) {
  const p = game.player;
  const b = curWorld().getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y + 0.9), Math.floor(p.pos.z));

  if (b !== B.PORTAL && b !== B.END_PORTAL) {
    portalLock = false;
    portalTimer = 0;
    return;
  }
  if (portalLock) return;

  portalTimer += dt;
  if (b === B.PORTAL && portalTimer > 0.7) {
    const tx = Math.floor(p.pos.x), tz = Math.floor(p.pos.z);
    switchDim(game.dimName === 'over' ? 'nether' : 'over');
    const arrive = ensurePortalArrival(tx, tz);
    p.pos = arrive;
    p.vel = { x: 0, y: 0, z: 0 };
    p.fallStart = null;
  } else if (b === B.END_PORTAL && portalTimer > 0.4) {
    if (game.dimName === 'end') {
      switchDim('over');
      curWorld().pregenerate(game.spawn.x, game.spawn.z, 2);
      p.pos = { ...game.spawn };
    } else {
      switchDim('end');
      curWorld().pregenerate(0, 0, 3);
      curWorld().pregenerate(END_SPAWN.x, END_SPAWN.z, 2);
      p.pos = { ...END_SPAWN };
    }
    p.vel = { x: 0, y: 0, z: 0 };
    p.fallStart = null;
  }
}

// ============ Enderdrache ============
function maybeSpawnDragon() {
  if (game.dragonDead) return;
  const dim = game.dims.end;
  if (dim.entities.some(e => e.isDragon && !e.dead)) return;
  const dragon = new Dragon(0, 53, -22);
  game.dragon = dragon;
  addEntityTo(dim, dragon);
  if (!dim.crystalsSpawned) {
    dim.crystalsSpawned = true;
    for (const pil of END_PILLARS) {
      addEntityTo(dim, new EndCrystal(pil.x + 0.5, pil.top + 1.4, pil.z + 0.5));
    }
  }
  S.dragon();
  toast('Der Enderdrache erwacht! Zerstöre zuerst die Kristalle auf den Säulen.');
}

function onDragonDeath(pos) {
  game.dragonDead = true;
  game.dragon = null;
  const w = game.dims.end.world;
  addEntity(new Explosion(pos.x, pos.y + 1, pos.z, 7));
  for (const [dx, dz] of END_EXIT.cells) {
    w.setBlock(dx, END_EXIT.portalY, dz, B.END_PORTAL);
  }
  w.setBlock(END_EXIT.egg[0], END_EXIT.egg[1], END_EXIT.egg[2], B.DRAGON_EGG);
  S.dragonDeath();
  toast('Der Enderdrache ist besiegt! Das Portal in der Mitte ist jetzt offen.');
  updateBossBar();
}

function updateBossBar() {
  const d = game ? game.dragon : null;
  if (game && game.dimName === 'end' && d && !d.dead) {
    bossbarEl.classList.remove('hidden');
    bossbarFill.style.width = Math.max(0, (d.hp / d.maxHp) * 100) + '%';
  } else {
    bossbarEl.classList.add('hidden');
  }
}

// ============ Struktur-Suche ============
function nearestStructure(finder, regionSize, radius) {
  const p = game.player.pos;
  const prx = Math.floor(p.x / regionSize), prz = Math.floor(p.z / regionSize);
  let best = null, bestD = Infinity;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const s = finder({ x: prx + dx, z: prz + dz });
      if (!s) continue;
      const sx = s.x ?? s.cx, sz = s.z ?? s.cz;
      const d = Math.hypot(sx - p.x, sz - p.z);
      if (d < bestD) { bestD = d; best = { ...s, x: sx, z: sz, dist: d }; }
    }
  }
  return best;
}

function dirLabel(from, to) {
  const ang = Math.atan2(to.x - from.x, -(to.z - from.z));
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((ang < 0 ? ang + Math.PI * 2 : ang) / (Math.PI * 2)) * 8) % 8];
}

// Dorf-Cache für Villager-KI (alle 2 s aktualisiert)
function updateVillageCache(dt) {
  game.villageTimer = (game.villageTimer || 0) - dt;
  if (game.villageTimer > 0) return;
  game.villageTimer = 2;
  if (game.dimName !== 'over') { game.villageCache = null; return; }
  const v = nearestStructure(rx => villageInRegion(curWorld().structCtx, rx.x, rx.z), VILLAGE_REGION, 1);
  game.villageCache = v && v.dist < 80 ? v : null;
}

// ============ HUD ============
function renderHotbar() {
  hotbarEl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === selected ? ' selected' : '');
    const stack = game ? game.inventory.slots[i] : null;
    if (stack) {
      const icon = itemIcon(stack.id, atlasCanvas);
      const cnv = icon.cloneNode();
      cnv.getContext('2d').drawImage(icon, 0, 0);
      slot.appendChild(cnv);
      slot.title = itemInfo(stack.id).name;
      if (stack.count > 1) {
        const c = document.createElement('span');
        c.className = 'cnt';
        c.textContent = stack.count;
        slot.appendChild(c);
      }
      const max = maxDurOf(stack.id);
      if (max && stack.dur !== undefined && stack.dur < max) {
        const bar = document.createElement('div');
        bar.className = 'dur';
        const f = Math.max(0, stack.dur / max);
        bar.style.width = (f * 80) + '%';
        bar.style.background = f > 0.5 ? '#5ad838' : f > 0.25 ? '#e8c838' : '#e84838';
        slot.appendChild(bar);
      }
    }
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = i + 1;
    slot.appendChild(num);
    hotbarEl.appendChild(slot);
  }
  if (viewModel) viewModel.setHeld(game ? heldStack() : null);
}

function selectSlot(i) {
  selected = ((i % 9) + 9) % 9;
  mining = null;
  bowCharge = -1;
  eatProgress = 0;
  renderHotbar();
}

function renderStatus() {
  if (!game || game.mode === 'creative') {
    heartsEl.innerHTML = '';
    hungerEl.innerHTML = '';
    armorEl.classList.add('hidden');
    airEl.classList.add('hidden');
    return;
  }
  const p = game.player;
  const row = (n, full, half, empty) => {
    let s = '';
    for (let i = 0; i < 10; i++) {
      const v = n - i * 2;
      s += `<span>${v >= 2 ? full : v >= 1 ? half : empty}</span>`;
    }
    return s;
  };
  heartsEl.innerHTML = row(Math.ceil(p.hp),
    '<b style="color:#e33">❤</b>', '<b style="color:#e88">❤</b>', '<b style="color:#40202a">❤</b>');
  hungerEl.innerHTML = row(p.hunger,
    '<b style="color:#c96">🍗</b>', '<b style="color:#a75;opacity:.6">🍗</b>', '<b style="opacity:.2">🍗</b>');
  const armor = game.inventory.armorPoints();
  if (armor > 0) {
    armorEl.classList.remove('hidden');
    armorEl.innerHTML = row(armor,
      '<b style="color:#cfd8e0">🛡</b>', '<b style="color:#cfd8e0;opacity:.5">🛡</b>', '<b style="opacity:.15">🛡</b>');
  } else {
    armorEl.classList.add('hidden');
  }
  if (p.air < 9.9) {
    airEl.classList.remove('hidden');
    airEl.innerHTML = row(Math.ceil(p.air * 2),
      '<b style="color:#8cf">●</b>', '<b style="color:#8cf;opacity:.5">●</b>', '<b style="opacity:.15">●</b>');
  } else {
    airEl.classList.add('hidden');
  }
}

function renderDebug() {
  if (!game || debugMode === 0) { debugEl.textContent = ''; return; }
  const p = game.player;
  let text = `FPS ${fps.toFixed(0)}  ·  XYZ ${p.pos.x.toFixed(1)} / ${p.pos.y.toFixed(1)} / ${p.pos.z.toFixed(1)}`;
  if (game.mp) text += `  ·  MP ${remotePlayers.size} Mitspieler${net.latency !== null ? ` · Ping ${net.latency.toFixed(0)} ms` : ''}`;
  if (debugMode >= 2) {
    const dimLabel = game.dimName === 'over' ? 'Overworld' : game.dimName === 'nether' ? 'Nether' : 'End';
    const tod = game.dimName === 'over' ? (isNight() ? 'Nacht' : 'Tag') : '';
    const biome = game.dimName === 'over' ? curWorld().biomeAt(Math.floor(p.pos.x), Math.floor(p.pos.z)) : '-';
    const packed = curWorld().getLight(Math.floor(p.pos.x), Math.floor(p.pos.y + 1), Math.floor(p.pos.z));
    text += `\n${dimLabel} ${tod}  ·  Biom ${biome}  ·  Chunk ${Math.floor(p.pos.x / CS)},${Math.floor(p.pos.z / CS)}  ·  Seed ${game.seed}` +
      `\nLicht Himmel ${skyOf(packed)} / Block ${blockOf(packed)}  ·  Chunks ${curWorld().chunks.size}  ·  Entities ${curDim().entities.length}  ·  Modus ${game.mode}${game.player.flying ? ' (fliegt)' : ''}`;
    if (game.dimName === 'over') {
      const ctx = curWorld().structCtx;
      const parts = [];
      const portal = nearestStructure(rx => ruinedPortalInRegion(ctx, rx.x, rx.z), PORTAL_REGION, 3);
      if (portal) parts.push(`Portalruine: ${Math.round(portal.dist)}m ${dirLabel(p.pos, portal)}`);
      const sh = nearestStructure(rx => strongholdInRegion(ctx, rx.x, rx.z), STRONGHOLD_REGION, 3);
      if (sh) parts.push(`Festung: ${Math.round(sh.dist)}m ${dirLabel(p.pos, sh)} (Tiefe ~${sh.baseY + 1})`);
      if (game.villageCache) parts.push(`Dorf: ${Math.round(game.villageCache.dist)}m`);
      if (parts.length) text += '\n' + parts.join('  ·  ');
    } else if (game.dimName === 'nether') {
      text += '\nBlazes jagen: Lohenruten für Enderaugen';
    }
  }
  debugEl.textContent = text;
}

// ============ Spielstart / Speichern ============
function findSpawn(world) {
  let sx = 8, sz = 8;
  for (let i = 0; i < 200 && world.terrainHeight(sx, sz) < SEA_LEVEL + 2; i++) sx += 8;
  world.pregenerate(sx, sz, 1);
  return { x: sx + 0.5, y: world.findGround(sx, sz) + 1.01, z: sz + 0.5 };
}

function startGame(slot, mode, saved, opts = {}) {
  const seed = saved ? saved.seed
    : opts.seed !== undefined ? opts.seed
    : params.has('seed') ? (Number(params.get('seed')) >>> 0)
    : ((Math.random() * 0xffffffff) >>> 0);

  game = {
    slot, mode, seed,
    name: saved?.name || opts.name || `Welt ${slot + 1}`,
    dims: { over: null, nether: null, end: null },
    dimName: saved?.dim || 'over',
    time: saved?.time ?? 0.05,
    spawn: saved?.spawn || null,
    savedEdits: saved?.edits || null,
    savedDrops: saved?.drops || null,
    dragonDead: saved?.dragonDead || false,
    dragon: null,
    villageCache: null,
    furnaces: {
      over: new Map(saved?.furnaces?.over || []),
      nether: new Map(saved?.furnaces?.nether || []),
      end: new Map(saved?.furnaces?.end || []),
    },
    chests: {
      over: new Map(saved?.chests?.over || []),
      nether: new Map(saved?.chests?.nether || []),
      end: new Map(saved?.chests?.end || []),
    },
    inventory: new Inventory(),
    player: null,
    spawnTimer: 1,
    autosaveTimer: AUTOSAVE_INTERVAL,
  };

  game.dims[game.dimName] = createDim(game.dimName);
  const world = game.dims[game.dimName].world;

  if (!game.spawn) {
    const overDim = game.dimName === 'over' ? game.dims.over : (game.dims.over = createDim('over'));
    game.spawn = findSpawn(overDim.world);
  }

  const player = new Player(world);
  game.player = player;
  player.creative = mode === 'creative';
  player.getArmorPoints = () => game.inventory.armorPoints();
  player.onStep = id => S.step(id);
  if (saved?.player) {
    player.pos = { ...saved.player.pos };
    player.hp = saved.player.hp;
    player.hunger = saved.player.hunger;
    game.inventory.load(saved.player.inv);
    selected = saved.player.selected || 0;
  } else {
    world.pregenerate(game.spawn.x, game.spawn.z, 1);
    player.pos = { ...game.spawn };
    selected = 0;
    if (mode === 'creative') {
      CREATIVE_HOTBAR.forEach((id, i) => { game.inventory.slots[i] = { id, count: 64 }; });
    }
    if (game.dimName === 'over') {
      for (let i = 0; i < 5; i++) {
        const x = Math.floor(game.spawn.x) + 6 + ((Math.random() * 16) | 0);
        const z = Math.floor(game.spawn.z) - 8 + ((Math.random() * 16) | 0);
        world.pregenerate(x, z, 1);
        const y = world.findFloor(x, z);
        if (y > 0 && world.getBlock(x, y, z) === B.GRASS) {
          addEntityTo(game.dims[game.dimName], new Mob(Math.random() < 0.5 ? 'sheep' : 'cow', x + 0.5, y + 1, z + 0.5));
        }
      }
    }
  }

  player.onDamage = (dmg) => {
    hurtFlashTimer = 0.15;
    document.body.classList.add('hurt');
    S.hurt();
    if (dmg > 0) game.inventory.damageArmor(1);
    renderStatus();
  };
  player.onDeath = () => {
    let info = '';
    if (game.mode === 'survival') {
      const stacks = game.inventory.drainAll();
      for (const s of stacks) {
        spawnDrop(s.id, s.count,
          player.pos.x + (Math.random() - 0.5) * 1.5,
          player.pos.y + 0.5,
          player.pos.z + (Math.random() - 0.5) * 1.5,
          s.dur);
      }
      if (stacks.length > 0) {
        const dimLabel = game.dimName === 'over' ? 'Overworld' : game.dimName === 'nether' ? 'Nether' : 'End';
        info = `Deine Items liegen bei X ${Math.round(player.pos.x)} / Y ${Math.round(player.pos.y)} / Z ${Math.round(player.pos.z)} (${dimLabel})`;
      }
      renderHotbar();
    }
    el('death-info').textContent = info;
    appState = 'dead';
    document.exitPointerLock?.();
    menus.show('menu-dead');
  };

  attachCameraTo(game.dims[game.dimName].scene);
  game.invUI = new InventoryUI(game.inventory, atlasCanvas, {
    onChange: renderHotbar,
    onLeftover: (id, count) => spawnDrop(id, count, player.pos.x, player.pos.y + 1, player.pos.z),
    onTrade: () => S.trade(),
    creativeItems: () => CREATIVE_ITEMS,
  });

  if (game.dimName === 'end') maybeSpawnDragon();

  appState = 'playing';
  menus.show(null);
  renderHotbar();
  renderStatus();
  requestLock();
}

function collectSaveState() {
  const edits = Object.assign({}, game.savedEdits || {});
  const drops = Object.assign({}, game.savedDrops || {});
  for (const name of ['over', 'nether', 'end']) {
    const d = game.dims[name];
    if (!d) continue;
    edits[name] = d.world.serializeEdits();
    drops[name] = d.entities
      .filter(e => e instanceof ItemDrop && !e.dead)
      .map(e => [e.itemId, e.count, e.pos.x, e.pos.y, e.pos.z, e.dur]);
  }
  return {
    version: 2,
    seed: game.seed,
    name: game.name,
    mode: game.mode,
    dim: game.dimName,
    time: game.time,
    spawn: game.spawn,
    edits,
    drops,
    dragonDead: game.dragonDead,
    furnaces: {
      over: [...game.furnaces.over],
      nether: [...game.furnaces.nether],
      end: [...game.furnaces.end],
    },
    chests: {
      over: [...game.chests.over],
      nether: [...game.chests.nether],
      end: [...game.chests.end],
    },
    player: {
      pos: { ...game.player.pos },
      hp: game.player.hp,
      hunger: game.player.hunger,
      inv: game.inventory.serialize(),
      selected,
    },
  };
}

function saveGame() {
  if (!game || game.slot === undefined) return false;
  return saveState(game.slot, collectSaveState());
}

function quitToMenu() {
  saveGame();
  sendMpState();
  netCleanup();
  for (const name of ['over', 'nether', 'end']) {
    const d = game.dims[name];
    if (!d) continue;
    for (const e of d.entities) e.dispose(d.scene);
    d.world.disposeAll();
  }
  game = null;
  mining = null;
  breakOverlay.hide();
  appState = 'menu';
  document.exitPointerLock?.();
  menus.refreshSlots();
  menus.show('menu-main');
  renderHotbar();
  renderStatus();
  updateBossBar();
}

// ============ Multiplayer ============
// Der Server liefert Seed, Weltzeit und das Edit-Journal; die Welt selbst wird
// lokal deterministisch generiert. Alle MP-Pfade sind hinter game.mp/net.active
// geschützt – der Singleplayer bleibt davon unberührt.

function netCleanup() {
  if (net.ws || net.active) net.disconnect();
  for (const rp of remotePlayers.values()) rp.dispose();
  remotePlayers.clear();
  closeChat();
  chatLogEl.innerHTML = '';
}

// --- Chat ---
const chatLogEl = el('chat-log');
const chatInputRow = el('chat-input-row');
const chatInputEl = el('chat-input');
let chatOpen = false;
let chatBuffer = '';

function addChatLine(entry, system = false) {
  const div = document.createElement('div');
  div.className = 'chat-line' + (system ? ' system' : '');
  if (system) {
    div.textContent = entry;
  } else {
    const n = document.createElement('span');
    n.className = 'chat-name';
    n.textContent = entry.name + ': ';
    div.appendChild(n);
    div.appendChild(document.createTextNode(entry.msg));
  }
  chatLogEl.appendChild(div);
  while (chatLogEl.children.length > 8) chatLogEl.firstChild.remove();
  setTimeout(() => {
    div.classList.add('fading');
    setTimeout(() => div.remove(), 1100);
  }, 12000);
}

function openChat() {
  chatOpen = true;
  chatBuffer = '';
  chatInputEl.textContent = '';
  chatInputRow.classList.remove('hidden');
}

function closeChat() {
  chatOpen = false;
  chatInputRow.classList.add('hidden');
}

// Eigene Tastenerfassung statt <input>: der Pointer-Lock bleibt aktiv.
function handleChatKey(e) {
  if (e.code === 'Escape') { closeChat(); return; }
  if (e.code === 'Enter' || e.code === 'NumpadEnter') {
    const msg = chatBuffer.trim();
    if (msg) net.sendChat(msg);
    closeChat();
    return;
  }
  if (e.code === 'Backspace') chatBuffer = chatBuffer.slice(0, -1);
  else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && chatBuffer.length < 200) {
    chatBuffer += e.key;
  }
  chatInputEl.textContent = chatBuffer;
}

// --- PvP ---
let mpLastHit = null; // { pid, t } – letzter Angreifer (für die Todesmeldung)

// Mitspieler im Fadenkreuz (analog pickMob, gegen die interpolierte Position).
// Anders als beim Block-Raycast blockieren nur SOLIDE Blöcke die Sichtlinie –
// hohes Gras, Blumen oder Fackeln dürfen einen Treffer nicht verhindern.
function pickRemotePlayer() {
  camera.getWorldDirection(dirVec);
  let best = null, bestT = Infinity;
  for (const rp of remotePlayers.values()) {
    if (rp.dim !== game.dimName || !rp.cur) continue;
    const hw = PLAYER_WIDTH / 2 + 0.1;
    const c = rp.cur;
    const t = rayAABB(
      camera.position.x, camera.position.y, camera.position.z,
      dirVec.x, dirVec.y, dirVec.z,
      { x: c.x - hw, y: c.y, z: c.z - hw },
      { x: c.x + hw, y: c.y + PLAYER_HEIGHT + 0.1, z: c.z + hw });
    if (t !== null && t < bestT && t <= REACH) { bestT = t; best = rp; }
  }
  if (!best) return null;
  for (let s = 0.3; s < bestT; s += 0.25) {
    const id = curWorld().getBlock(
      Math.floor(camera.position.x + dirVec.x * s),
      Math.floor(camera.position.y + dirVec.y * s),
      Math.floor(camera.position.z + dirVec.z * s));
    if (BLOCK_INFO[id].solid) return null;
  }
  return best;
}

// Nahkampf gegen einen Mitspieler; true wenn getroffen (Schaden wendet das Ziel an)
function tryAttackPlayer() {
  const p = game.player;
  const rp = pickRemotePlayer();
  if (!rp) return false;
  p.attackTimer = ATTACK_COOLDOWN;
  const tool = heldToolInfo();
  const dmg = tool && tool.damage ? tool.damage : 1;
  const dx = rp.cur.x - p.pos.x, dz = rp.cur.z - p.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  net.sendHit(rp.pid, dmg, dx / d * 6, dz / d * 6);
  rp.flash();
  S.mobHurt();
  damageHeld(1);
  p.exhaustion += 0.1;
  return true;
}

// Eigene Pfeile gegen Mitspieler prüfen (Mob-Treffer macht die Arrow-Klasse selbst)
function pvpArrowTick() {
  for (const e of curDim().entities) {
    if (!(e instanceof Arrow) || e.dead || !e.fromPlayer) continue;
    for (const rp of remotePlayers.values()) {
      if (rp.dim !== game.dimName || !rp.cur) continue;
      const hw = PLAYER_WIDTH / 2 + 0.15;
      if (Math.abs(e.pos.x - rp.cur.x) < hw && Math.abs(e.pos.z - rp.cur.z) < hw &&
          e.pos.y > rp.cur.y - 0.1 && e.pos.y < rp.cur.y + PLAYER_HEIGHT + 0.2) {
        const d = Math.hypot(e.vel.x, e.vel.z) || 1;
        net.sendHit(rp.pid, 6, e.vel.x / d * 5, e.vel.z / d * 5, true);
        rp.flash();
        S.mobHurt();
        e.dead = true;
        break;
      }
    }
  }
}

// Eingehender Treffer: Schaden lokal anwenden (inkl. eigener Rüstungsberechnung)
function onRemoteHit(m) {
  if (!game || !game.mp || game.player.dead) return;
  mpLastHit = { pid: m.from, t: performance.now() };
  game.player.hurt(m.dmg, m.kx, m.kz);
  renderStatus();
}

// --- Spielerzustand (Account-Persistenz auf dem Server) ---
let mpStateTimer = 10;

function collectMpState() {
  return {
    dim: game.dimName,
    spawn: game.spawn,
    player: {
      pos: { ...game.player.pos },
      hp: game.player.hp,
      hunger: game.player.hunger,
      inv: game.inventory.serialize(),
      selected,
    },
  };
}

function sendMpState() {
  if (game && game.mp && net.active && !game.player.dead) net.sendState(collectMpState());
}

// Remote-Spieler in die Szene seiner Dimension hängen (falls lokal erzeugt)
function syncRemotePlayerScene(rp) {
  const dim = game && game.dims[rp.dim];
  if (dim) rp.attach(dim.scene);
  else rp.detach();
}

function addRemotePlayer(pid, name, info) {
  if (pid === net.pid || remotePlayers.has(pid)) return;
  const rp = new RemotePlayer(pid, name || 'Spieler ' + (pid + 1));
  remotePlayers.set(pid, rp);
  if (info) {
    rp.setTarget(info.d, info.x, info.y, info.z, info.yw, info.pt);
    syncRemotePlayerScene(rp);
  }
}

function onSnapshot(list) {
  if (!game || !game.mp) return;
  for (const [pid, d, x, y, z, yw, pt] of list) {
    if (pid === net.pid) continue;
    let rp = remotePlayers.get(pid);
    if (!rp) {
      addRemotePlayer(pid, null, null);
      rp = remotePlayers.get(pid);
      if (!rp) continue;
    }
    const dimChanged = rp.setTarget(d, x, y, z, yw, pt);
    if (dimChanged || !rp.scene) syncRemotePlayerScene(rp);
  }
}

// Block-Update vom Server anwenden; Echo wird über applyingRemote unterdrückt.
function applyRemoteSet(d, x, y, z, id) {
  if (!game || !game.mp) return;
  const dim = game.dims[d];
  if (dim) {
    net.applyingRemote = true;
    try {
      dim.world.setBlock(x, y, z, id);
    } finally {
      net.applyingRemote = false;
    }
  } else {
    // Dimension lokal noch nicht erzeugt: ins Journal puffern,
    // createDim() lädt es später über world.loadEdits().
    if (!game.savedEdits) game.savedEdits = {};
    const store = game.savedEdits[d] || (game.savedEdits[d] = {});
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const key = cx + ',' + cz;
    const idx = (y * CS + (z - cz * CS)) * CS + (x - cx * CS);
    const arr = store[key] || (store[key] = []);
    const existing = arr.find(e => e[0] === idx);
    if (existing) existing[1] = id;
    else arr.push([idx, id]);
  }
}

function startMultiplayer(name, pass, url = defaultServerUrl()) {
  const status = el('mp-status');
  status.textContent = 'Verbinde mit Server…';
  net.connect(url, name, pass, {
    onWelcome: w => {
      status.textContent = '';
      const st = w.state || {};
      startGame(undefined, 'survival', {
        seed: w.seed,
        time: w.time,
        edits: w.edits,
        name: 'Multiplayer',
        dim: st.dim,
        spawn: st.spawn,
        player: st.player,
      });
      game.mp = true;
      mpStateTimer = 10;
      mpLastHit = null;
      // Todesmeldung in den Chat aller Spieler (PvP-Kill oder Umgebungstod)
      const origDeath = game.player.onDeath;
      game.player.onDeath = () => {
        const byPvp = mpLastHit && performance.now() - mpLastHit.t < 8000;
        net.sendDied(byPvp ? mpLastHit.pid : net.pid);
        mpLastHit = null;
        origDeath();
      };
      for (const p of w.players) addRemotePlayer(p.pid, p.name, p);
      addChatLine(w.players.length
        ? `Verbunden – ${w.players.length} Mitspieler online. [T] öffnet den Chat.`
        : 'Verbunden – du bist der erste Spieler. [T] öffnet den Chat.', true);
      if (st.player) addChatLine('Willkommen zurück! Dein Inventar wurde wiederhergestellt.', true);
    },
    onSet: m => applyRemoteSet(m.d, m.x, m.y, m.z, m.id),
    onSnap: onSnapshot,
    onChat: m => addChatLine(m),
    onHit: onRemoteHit,
    onSys: msg => addChatLine(msg, true),
    onJoin: m => {
      addRemotePlayer(m.pid, m.name, null);
      addChatLine(`${m.name} ist beigetreten`, true);
    },
    onLeave: m => {
      const rp = remotePlayers.get(m.pid);
      if (rp) {
        addChatLine(`${rp.name} hat das Spiel verlassen`, true);
        rp.dispose();
        remotePlayers.delete(m.pid);
      }
    },
    onTime: v => { if (game && game.mp) game.time = v; },
    onClose: () => {
      if (game && game.mp) quitToMenu();
      toast('Verbindung zum Server verloren');
    },
    onError: msg => { status.textContent = msg; },
  });
}

function openInventory(mode) {
  if (appState !== 'playing') return;
  appState = 'inventory';
  game.invUI.open(mode);
  document.exitPointerLock?.();
}

function closeInventory() {
  if (appState !== 'inventory') return;
  game.invUI.close();
  appState = 'playing';
  renderHotbar();
  requestLock();
}

function requestLock() {
  try {
    const r = canvas.requestPointerLock?.();
    if (r && r.catch) r.catch(() => {});
  } catch { /* headless */ }
}

// ============ Input ============
let keyMap = {};
function rebuildKeyMap() {
  keyMap = {};
  for (const [action, code] of Object.entries(SETTINGS.keys)) keyMap[code] = action;
}
rebuildKeyMap();

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && appState === 'playing') {
    appState = 'paused';
    game?.player.resetKeys();
    mouseLeft = false;
    rightHeld = false;
    menus.show('menu-pause');
  }
});

document.addEventListener('mousemove', e => {
  if (appState === 'playing' && document.pointerLockElement === canvas && game) {
    game.player.rotate(e.movementX, e.movementY);
  }
});

document.addEventListener('mousedown', unlockAudio);
document.addEventListener('keydown', unlockAudio);

canvas.addEventListener('mousedown', e => {
  if (appState !== 'playing' || !game || game.player.dead || chatOpen) return;
  if (e.button === 0) {
    viewModel.swing();
    if (game.mode === 'creative') {
      creativeMine();
      mouseLeft = true; // erlaubt "Halten" im Kreativmodus (sofortiger Abbau pro Frame unten)
    } else {
      const hitMob = tryAttack();
      if (!hitMob) mouseLeft = true;
    }
  } else if (e.button === 2) {
    rightHeld = true;
    useRepeat = 0.25;
    const stack = heldStack();
    const info = stack ? itemInfo(stack.id) : null;
    const isHoldAction = info && (info.food || stack.id === I.BOW) && game.mode === 'survival';
    if (!isHoldAction) performUse();
  }
});
window.addEventListener('mouseup', e => {
  if (e.button === 0) { mouseLeft = false; mining = null; if (breakOverlay) breakOverlay.hide(); }
  if (e.button === 2) {
    if (bowCharge >= 0.3 && appState === 'playing') shootBow();
    bowCharge = -1;
    rightHeld = false;
  }
});
window.addEventListener('contextmenu', e => e.preventDefault());

let creativeMineTimer = 0;

window.addEventListener('keydown', e => {
  if (e.code === 'Space') e.preventDefault();
  // Multiplayer-Chat fängt alle Tasten ab, solange er offen ist
  if (chatOpen) {
    e.preventDefault();
    handleChatKey(e);
    return;
  }
  if (game && game.mp && appState === 'playing' && !game.player.dead && e.code === 'KeyT' && !e.repeat) {
    e.preventDefault();
    openChat();
    return;
  }
  if (e.code === 'F3') { e.preventDefault(); debugMode = (debugMode + 1) % 3; renderDebug(); return; }
  if (!game) return;

  if (e.code === 'Escape') {
    // Container-UI schliessen ohne das Spiel zu pausieren
    if (appState === 'inventory') closeInventory();
    return;
  }
  const action = keyMap[e.code];
  if (action === 'inventory') {
    if (appState === 'inventory') closeInventory();
    else if (appState === 'playing') openInventory(game.mode === 'creative' ? 'creative' : 'inv');
    return;
  }
  if (appState !== 'playing') return;

  if (action === 'drop' && !game.player.dead) {
    const stack = game.inventory.slots[selected];
    if (stack) {
      camera.getWorldDirection(dirVec);
      const p = game.player;
      const drop = spawnDrop(stack.id, 1, p.pos.x + dirVec.x * 0.6, p.pos.y + 1.4, p.pos.z + dirVec.z * 0.6, stack.count === 1 ? stack.dur : undefined);
      drop.vel = { x: dirVec.x * 6, y: 2.5, z: dirVec.z * 6 };
      drop.pickupDelay = DROP_PICKUP_DELAY;
      game.inventory.removeFromSlot(selected, 1);
      renderHotbar();
    }
    return;
  }

  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= 9) selectSlot(n - 1);
  }

  if (action === 'jump' && game.mode === 'creative' && !e.repeat) {
    const now = performance.now() / 1000;
    if (now - lastJumpTap < 0.3) {
      game.player.flying = !game.player.flying;
      game.player.vel.y = 0;
    }
    lastJumpTap = now;
  }
  if (action && action in game.player.keys) game.player.keys[action] = true;
});
window.addEventListener('keyup', e => {
  if (!game) return;
  const action = keyMap[e.code];
  if (action && action in game.player.keys) game.player.keys[action] = false;
});
window.addEventListener('wheel', e => {
  if (appState === 'playing' && !chatOpen) selectSlot(selected + Math.sign(e.deltaY));
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (viewModel) viewModel.resize();
});

window.addEventListener('beforeunload', () => {
  if (game) {
    saveGame();
    sendMpState();
  }
});

// Pause-Menü-Buttons
el('btn-resume').addEventListener('click', () => {
  appState = 'playing';
  menus.show(null);
  requestLock();
});
el('btn-save').addEventListener('click', e => {
  if (saveGame()) {
    e.target.textContent = 'Gespeichert ✓';
    setTimeout(() => { e.target.textContent = 'Speichern'; }, 1200);
  }
});
el('btn-quit').addEventListener('click', quitToMenu);

// Multiplayer-Menü
el('btn-open-mp').addEventListener('click', () => {
  el('mp-name').value = localStorage.getItem('cc-mp-name') || '';
  el('mp-pass').value = localStorage.getItem('cc-mp-pass') || '';
  el('mp-server').value = localStorage.getItem('cc-mp-server') || '';
  el('mp-server').placeholder = defaultServerUrl();
  el('mp-status').textContent = '';
  menus.show('menu-mp');
});
el('btn-mp-back').addEventListener('click', () => {
  netCleanup();
  menus.show('menu-main');
});
el('btn-mp-join').addEventListener('click', () => {
  const name = el('mp-name').value.trim() || 'Steve';
  const pass = el('mp-pass').value;
  const serverInput = el('mp-server').value;
  localStorage.setItem('cc-mp-name', name);
  localStorage.setItem('cc-mp-pass', pass);
  localStorage.setItem('cc-mp-server', serverInput.trim());
  startMultiplayer(name, pass, normalizeServerUrl(serverInput));
});
el('btn-dead-quit').addEventListener('click', quitToMenu);
el('btn-respawn').addEventListener('click', () => {
  if (game.dimName !== 'over') switchDim('over');
  curWorld().pregenerate(game.spawn.x, game.spawn.z, 1);
  game.player.respawn(game.spawn);
  appState = 'playing';
  menus.show(null);
  renderStatus();
  renderHotbar();
  requestLock();
});

// ============ Panorama (Hauptmenü) ============
let pano = null;
function initPanorama() {
  const { scene, hemi } = makeScene();
  scene.background = new THREE.Color(0x8fcdf0);
  scene.fog.color.set(0x8fcdf0);
  scene.fog.near = 50;
  scene.fog.far = 110;
  hemi.intensity = 1.1;
  const world = new World(scene, opaqueMat, transMat, 20260702, 'over');
  world.setRenderDistance(4);
  pano = { scene, world, angle: 0, y: 0 };
  pano.y = world.terrainHeight(8, 8) + 10;
}

function renderPanorama(dt) {
  if (!pano) return;
  dayLight.value = 1;
  pano.world.update(8, 8);
  pano.angle += dt * 0.05;
  camera.position.set(8 + Math.cos(pano.angle) * 2, pano.y, 8 + Math.sin(pano.angle) * 2);
  camera.rotation.set(-0.15, -pano.angle - Math.PI / 2, 0);
  renderer.clear();
  renderer.render(pano.scene, camera);
}

// ============ Settings anwenden ============
function applySettings() {
  rebuildKeyMap();
  renderer.setPixelRatio(pixelRatioFor(SETTINGS.quality));
  applyVolume();
  if (game) {
    for (const name of ['over', 'nether', 'end']) {
      const d = game.dims[name];
      if (d) d.world.setRenderDistance(SETTINGS.renderDistance);
    }
  }
  if (pano) pano.world.setRenderDistance(Math.min(4, SETTINGS.renderDistance));
}

// ============ Game-Loop ============
let last = performance.now();
let fps = 0, frameCount = 0, fpsStart = performance.now(), lastHud = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (appState === 'menu') {
    renderPanorama(dt);
    return;
  }
  tick(dt, now);
}

function tick(dt, now) {
  if (!game || appState === 'paused') return;

  const p = game.player;

  // Multiplayer: Zeit läuft serverseitig immer weiter (auch in Nether/End)
  if (game.dimName === 'over' || game.mp) game.time = (game.time + dt / DAY_LENGTH) % 1;

  p.update(dt);

  if (game.mp) {
    net.tick(dt, game.dimName, p.pos.x, p.pos.y, p.pos.z, p.yaw, p.pitch);
    for (const rp of remotePlayers.values()) rp.update(dt);
    pvpArrowTick();
    mpStateTimer -= dt;
    if (mpStateTimer <= 0) {
      mpStateTimer = 10;
      sendMpState();
    }
  }
  camera.position.set(p.pos.x, p.pos.y + EYE_HEIGHT, p.pos.z);
  camera.rotation.x = p.pitch;
  camera.rotation.y = p.yaw;

  // FOV: Sprint / Bogen-Zoom
  const targetFov = bowCharge >= 0 ? 62 - Math.min(1, bowCharge) * 8 : p.sprinting ? 82 : 75;
  if (Math.abs(camera.fov - targetFov) > 0.2) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10);
    camera.updateProjectionMatrix();
  }

  // Wasser-Splash
  const inWaterNow = p.inWater();
  if (inWaterNow && !wasInWater) S.splash();
  wasInWater = inWaterNow;

  curWorld().update(p.pos.x, p.pos.z);
  curDim().fluids.update(dt);
  gravityTick();
  entitiesTick(dt);
  updateVillageCache(dt);
  if (game.mode === 'survival') {
    spawnManagerTick(dt);
    spawnerTick(dt);
  }
  furnaceTick(dt);
  miningTick(dt);
  useHoldTick(dt);
  pressurePlateTick();
  portalCheck(dt);

  // Kreativ: Abbauen beim Halten
  if (game.mode === 'creative' && mouseLeft && appState === 'playing') {
    creativeMineTimer -= dt;
    if (creativeMineTimer <= 0) {
      creativeMineTimer = 0.22;
      creativeMine();
    }
  }

  // Ambient-Sounds in dunklen Höhlen
  ambientTimer -= dt;
  if (ambientTimer <= 0) {
    ambientTimer = 20 + Math.random() * 25;
    if (effectiveLight(p.pos.x, p.pos.y + 1, p.pos.z) < 4) S.ambient();
  }

  const hit = appState === 'playing' || appState === 'inventory' ? rayFromCamera() : null;
  if (hit) {
    highlight.visible = true;
    highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  } else {
    highlight.visible = false;
  }

  updateEnvironment(dt);

  if (hurtFlashTimer > 0) {
    hurtFlashTimer -= dt;
    if (hurtFlashTimer <= 0) document.body.classList.remove('hurt');
  }

  game.autosaveTimer -= dt;
  if (game.autosaveTimer <= 0) {
    game.autosaveTimer = AUTOSAVE_INTERVAL;
    saveGame();
  }

  renderer.clear();
  renderer.render(curDim().scene, camera);
  viewModel.update(dt, p.eating, dayLight.value);
  viewModel.render(renderer);

  frameCount++;
  if (now - fpsStart >= 1000) {
    fps = frameCount * 1000 / (now - fpsStart);
    frameCount = 0;
    fpsStart = now;
  }
  if (now - lastHud > 250) {
    lastHud = now;
    renderStatus();
    updateBossBar();
    if (game.invUI) game.invUI.refresh();
    renderDebug();
  }
}

// ============ Init & Debug-API ============
async function boot() {
  await loadTexturePack(atlasCanvas);
  atlasTex.needsUpdate = true;
  viewModel = new ViewModel(atlasTex, atlasCanvas);
  breakOverlay = new BreakOverlay();
  menus = new Menus({
    startWorld: (slot, mode, saved, opts) => startGame(slot, mode, saved, opts),
    applySettings,
  });
  menus.refreshSlots();
  menus.show('menu-main');
  renderHotbar();
  initPanorama();
  requestAnimationFrame(loop);
  console.log('[ClaudeCraft] Build bereit');
}
boot();

window.GAME = {
  THREE, renderer, camera, atlasCanvas,
  get game() { return game; },
  get state() { return appState; },
  get world() { return game ? curWorld() : null; },
  get player() { return game ? game.player : null; },
  get dim() { return game ? game.dimName : null; },
  get inventory() { return game ? game.inventory : null; },
  get selected() { return selected; },
  get dragon() { return game ? game.dragon : null; },
  step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) tick(dt, performance.now()); },
  startNew(slot, mode, opts = {}) { startGame(slot, mode, null, opts); },
  loadSlot(slot) { const s = loadState(slot); if (s) startGame(slot, s.mode, s); },
  save: () => saveGame(),
  quit: () => quitToMenu(),
  give(id, n = 1) { game.inventory.add(id, n); renderHotbar(); },
  spawnMob, spawnDrop, explode,
  selectSlot, performUse, tryAttack, creativeMine,
  openInventory, closeInventory,
  switchDim,
  maybeSpawnDragon,
  tryIgnitePortal,
  getChest, getFurnace,
  effectiveLight,
  setTime(t) { game.time = t; },
  teleport(x, y, z) { game.player.pos = { x, y, z }; game.player.vel = { x: 0, y: 0, z: 0 }; },
  net,
  remotePlayers,
  joinMultiplayer(name = 'Steve', pass = '', url) { startMultiplayer(name, pass, url ? normalizeServerUrl(url) : defaultServerUrl()); },
  sendChat(msg) { net.sendChat(msg); },
  I, B,
};
