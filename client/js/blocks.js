// Blockdefinitionen (Härte/Werkzeug/Tier/Drops/Licht/Render-Typ) + prozeduraler Texturatlas.
// Texturen können durch ein offizielles Ressourcen-Pack überschrieben werden (texpack.js).
// Nicht gezeichnete/nicht ladbare Kacheln zeigen automatisch die universelle
// Magenta-Schachbrett-"Missing Texture".

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4,
  LOG: 5, LEAVES: 6, PLANKS: 7, COBBLE: 8, WATER: 9, BEDROCK: 10,
  SNOWY_GRASS: 11, CACTUS: 12, WOOL: 13, CRAFTING_TABLE: 14,
  OBSIDIAN: 15, NETHERRACK: 16, GLOWSTONE: 17, LAVA: 18, PORTAL: 19,
  END_STONE: 20, END_PORTAL: 21,
  COAL_ORE: 22, IRON_ORE: 23, GOLD_ORE: 24, DIAMOND_ORE: 25, EMERALD_ORE: 26,
  FURNACE: 27, FURNACE_LIT: 28, GRAVEL: 29, STONE_BRICKS: 30,
  END_FRAME: 31, END_FRAME_EYE: 32, DRAGON_EGG: 33,
  // Neu: Licht, Flora, Holzarten, Deepslate, Strukturen, Fluid-Level
  TORCH: 34, TALL_GRASS: 35, FLOWER_YELLOW: 36, FLOWER_RED: 37, DEAD_BUSH: 38, WEB: 39,
  BIRCH_LOG: 40, BIRCH_LEAVES: 41, DARK_LOG: 42, DARK_LEAVES: 43,
  ACACIA_LOG: 44, ACACIA_LEAVES: 45,
  COARSE_DIRT: 46, HAY: 47,
  DEEPSLATE: 48, DS_COAL: 49, DS_IRON: 50, DS_GOLD: 51, DS_DIAMOND: 52, DS_EMERALD: 53,
  TNT: 54, CHEST: 55, SPAWNER: 56, RAIL: 57,
  DOOR_L: 58, DOOR_U: 59, DOOR_L_OPEN: 60, DOOR_U_OPEN: 61,
  BED_FOOT: 62, BED_HEAD: 63,
  PATH: 64, GLASS: 65, SANDSTONE: 66, PRESSURE_PLATE: 67, SNOW_BLOCK: 68,
  MOSSY_COBBLE: 69,
  WATER_F7: 70, WATER_F6: 71, WATER_F5: 72, WATER_F4: 73, WATER_F3: 74, WATER_F2: 75, WATER_F1: 76,
  LAVA_F3: 77, LAVA_F2: 78, LAVA_F1: 79,
};

// --- Fluid-Helfer ---
export function isWater(id) { return id === B.WATER || (id >= B.WATER_F7 && id <= B.WATER_F1); }
export function isLava(id) { return id === B.LAVA || (id >= B.LAVA_F3 && id <= B.LAVA_F1); }
export function isFluid(id) { return isWater(id) || isLava(id); }
// Level: Quelle = 8, fliessend 7..1 (Wasser) bzw. Quelle 8, 3..1 (Lava)
export function fluidLevel(id) {
  if (id === B.WATER || id === B.LAVA) return 8;
  if (id >= B.WATER_F7 && id <= B.WATER_F1) return 7 - (id - B.WATER_F7);
  if (id >= B.LAVA_F3 && id <= B.LAVA_F1) return 3 - (id - B.LAVA_F3);
  return 0;
}
export function waterFlowId(level) { return B.WATER_F7 + (7 - level); }   // level 7..1
export function lavaFlowId(level) { return B.LAVA_F3 + (3 - level); }     // level 3..1

// Kachel-Indizes im 16x16-Atlas
export const TILES = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4, LOG_SIDE: 5, LOG_TOP: 6, LEAVES: 7,
  PLANKS: 8, COBBLE: 9, BEDROCK: 10, SNOW_TOP: 11, SNOW_SIDE: 12, CACTUS: 13, WOOL: 14, TABLE_TOP: 15,
  TABLE_SIDE: 16, OBSIDIAN: 17, NETHERRACK: 18, GLOWSTONE: 19, LAVA: 20, PORTAL: 21, END_STONE: 22, END_PORTAL: 23,
  WATER: 24,
  COAL_ORE: 25, IRON_ORE: 26, GOLD_ORE: 27, DIAMOND_ORE: 28, EMERALD_ORE: 29,
  FURNACE_FRONT: 30, FURNACE_LIT: 31, FURNACE_TOP: 32,
  GRAVEL: 33, STONE_BRICKS: 34,
  END_FRAME_TOP: 35, END_FRAME_SIDE: 36, END_FRAME_EYE: 37,
  DRAGON_EGG: 38,
  TORCH: 39, TALL_GRASS: 40, FLOWER_YELLOW: 41, FLOWER_RED: 42, DEAD_BUSH: 43, WEB: 44,
  BIRCH_SIDE: 45, BIRCH_TOP: 46, BIRCH_LEAVES: 47,
  DARK_SIDE: 48, DARK_TOP: 49, DARK_LEAVES: 50,
  ACACIA_SIDE: 51, ACACIA_TOP: 52, ACACIA_LEAVES: 53,
  COARSE_DIRT: 54, HAY_SIDE: 55, HAY_TOP: 56,
  DEEPSLATE: 57, DS_COAL: 58, DS_IRON: 59, DS_GOLD: 60, DS_DIAMOND: 61, DS_EMERALD: 62,
  TNT_SIDE: 63, TNT_TOP: 64,
  CHEST_FRONT: 65, CHEST_SIDE: 66, CHEST_TOP: 67,
  SPAWNER: 68, RAIL: 69,
  DOOR_UPPER: 70, DOOR_LOWER: 71,
  BED_HEAD_TOP: 72, BED_FOOT_TOP: 73, BED_SIDE: 74,
  PATH_TOP: 75, PATH_SIDE: 76,
  GLASS: 77, SANDSTONE: 78, SANDSTONE_TOP: 79,
  MOSSY_COBBLE: 80,
  MISSING: 255,
};
const T = TILES;

export const ATLAS_COLS = 16;
export const ATLAS_ROWS = 16;
export const TILE_PX = 16;

// hardness: Sekunden von Hand; Infinity = unzerstörbar
// tool: passendes Werkzeug beschleunigt den Abbau
// minTier: benötigte Werkzeugstufe für den Drop (1 Holz, 2 Stein, 3 Eisen, 4 Diamant)
// drop: Block-ID die gedroppt wird ('self' = eigener Block, null = nichts; Spezialfälle in items.js)
// type: cube | cross | torch | flat | door | bed | fluid
// light: Lichtemission 0-15 · gravity: fällt wie Sand · ray: per Fadenkreuz anvisierbar trotz solid:false
// slow: Bewegungs-Multiplikator im Block (Spinnennetz)
function def(name, opt = {}) {
  return {
    name,
    solid: opt.solid !== false,
    opaque: opt.opaque !== false,
    trans: opt.trans || false,
    alpha: opt.alpha ?? 1,
    tiles: opt.tiles || null,
    hardness: opt.hardness ?? 1,
    tool: opt.tool || null,
    minTier: opt.minTier || 0,
    drop: opt.drop !== undefined ? opt.drop : 'self',
    damage: opt.damage || 0,
    type: opt.type || 'cube',
    light: opt.light || 0,
    gravity: opt.gravity || false,
    ray: opt.ray || false,
    slow: opt.slow || 0,
    fluid: opt.fluid || null,   // { kind: 'water'|'lava' }
  };
}
const same = t => ({ top: t, bottom: t, side: t });

function waterDef(name) {
  return def(name, {
    solid: false, opaque: false, trans: true, alpha: 0.65,
    tiles: same(T.WATER), drop: null, type: 'fluid', fluid: { kind: 'water' },
  });
}
function lavaDef(name) {
  return def(name, {
    solid: false, opaque: false, tiles: same(T.LAVA), hardness: Infinity,
    drop: null, damage: 8, type: 'fluid', light: 15, fluid: { kind: 'lava' },
  });
}

export const BLOCK_INFO = [
  /* 0 */ def('Luft', { solid: false, opaque: false, drop: null }),
  def('Gras', { tiles: { top: T.GRASS_TOP, bottom: T.DIRT, side: T.GRASS_SIDE }, hardness: 0.9, tool: 'shovel', drop: B.DIRT }),
  def('Erde', { tiles: same(T.DIRT), hardness: 0.75, tool: 'shovel' }),
  def('Stein', { tiles: same(T.STONE), hardness: 6, tool: 'pickaxe', minTier: 1, drop: B.COBBLE }),
  def('Sand', { tiles: same(T.SAND), hardness: 0.75, tool: 'shovel', gravity: true }),
  /* 5 */ def('Eichenstamm', { tiles: { top: T.LOG_TOP, bottom: T.LOG_TOP, side: T.LOG_SIDE }, hardness: 3, tool: 'axe' }),
  def('Eichenlaub', { opaque: false, tiles: same(T.LEAVES), hardness: 0.35, drop: null }),
  def('Bretter', { tiles: same(T.PLANKS), hardness: 3, tool: 'axe' }),
  def('Bruchstein', { tiles: same(T.COBBLE), hardness: 7, tool: 'pickaxe', minTier: 1 }),
  waterDef('Wasser'),
  /* 10 */ def('Grundgestein', { tiles: same(T.BEDROCK), hardness: Infinity, drop: null }),
  def('Schnee-Gras', { tiles: { top: T.SNOW_TOP, bottom: T.DIRT, side: T.SNOW_SIDE }, hardness: 0.9, tool: 'shovel', drop: B.DIRT }),
  def('Kaktus', { tiles: same(T.CACTUS), hardness: 0.5, damage: 1 }),
  def('Wolle', { tiles: same(T.WOOL), hardness: 1.1 }),
  def('Werkbank', { tiles: { top: T.TABLE_TOP, bottom: T.PLANKS, side: T.TABLE_SIDE }, hardness: 3, tool: 'axe' }),
  /* 15 */ def('Obsidian', { tiles: same(T.OBSIDIAN), hardness: 25, tool: 'pickaxe', minTier: 4 }),
  def('Netherrack', { tiles: same(T.NETHERRACK), hardness: 0.6, tool: 'pickaxe', minTier: 1 }),
  def('Glowstone', { tiles: same(T.GLOWSTONE), hardness: 0.4, light: 15 }),
  lavaDef('Lava'),
  def('Netherportal', { solid: false, opaque: false, trans: true, alpha: 0.8, tiles: same(T.PORTAL), hardness: Infinity, drop: null, light: 11 }),
  /* 20 */ def('Endstein', { tiles: same(T.END_STONE), hardness: 5, tool: 'pickaxe', minTier: 1 }),
  def('End-Portal', { solid: false, opaque: true, tiles: same(T.END_PORTAL), hardness: Infinity, drop: null, light: 15 }),
  def('Kohleerz', { tiles: same(T.COAL_ORE), hardness: 6, tool: 'pickaxe', minTier: 1 }),
  def('Eisenerz', { tiles: same(T.IRON_ORE), hardness: 6, tool: 'pickaxe', minTier: 2 }),
  def('Golderz', { tiles: same(T.GOLD_ORE), hardness: 6, tool: 'pickaxe', minTier: 3 }),
  /* 25 */ def('Diamanterz', { tiles: same(T.DIAMOND_ORE), hardness: 7, tool: 'pickaxe', minTier: 3 }),
  def('Smaragderz', { tiles: same(T.EMERALD_ORE), hardness: 7, tool: 'pickaxe', minTier: 3 }),
  def('Ofen', { tiles: { top: T.FURNACE_TOP, bottom: T.FURNACE_TOP, side: T.FURNACE_FRONT }, hardness: 7, tool: 'pickaxe', minTier: 1 }),
  def('Ofen (an)', { tiles: { top: T.FURNACE_TOP, bottom: T.FURNACE_TOP, side: T.FURNACE_LIT }, hardness: 7, tool: 'pickaxe', minTier: 1, drop: B.FURNACE, light: 13 }),
  def('Kies', { tiles: same(T.GRAVEL), hardness: 0.8, tool: 'shovel', gravity: true }),
  /* 30 */ def('Steinziegel', { tiles: same(T.STONE_BRICKS), hardness: 6, tool: 'pickaxe', minTier: 1 }),
  def('Endportalrahmen', { tiles: { top: T.END_FRAME_TOP, bottom: T.END_STONE, side: T.END_FRAME_SIDE }, hardness: Infinity, drop: null }),
  def('Endportalrahmen (Auge)', { tiles: { top: T.END_FRAME_EYE, bottom: T.END_STONE, side: T.END_FRAME_SIDE }, hardness: Infinity, drop: null, light: 4 }),
  def('Drachenei', { tiles: same(T.DRAGON_EGG), hardness: 3, light: 1 }),
  def('Fackel', { solid: false, opaque: false, ray: true, tiles: same(T.TORCH), hardness: 0.05, type: 'torch', light: 14 }),
  /* 35 */ def('Gras (hoch)', { solid: false, opaque: false, ray: true, tiles: same(T.TALL_GRASS), hardness: 0.05, type: 'cross', drop: null }),
  def('Löwenzahn', { solid: false, opaque: false, ray: true, tiles: same(T.FLOWER_YELLOW), hardness: 0.05, type: 'cross' }),
  def('Mohn', { solid: false, opaque: false, ray: true, tiles: same(T.FLOWER_RED), hardness: 0.05, type: 'cross' }),
  def('Toter Busch', { solid: false, opaque: false, ray: true, tiles: same(T.DEAD_BUSH), hardness: 0.05, type: 'cross', drop: null }),
  def('Spinnennetz', { solid: false, opaque: false, ray: true, tiles: same(T.WEB), hardness: 4, tool: 'sword', type: 'cross', drop: null, slow: 0.15 }),
  /* 40 */ def('Birkenstamm', { tiles: { top: T.BIRCH_TOP, bottom: T.BIRCH_TOP, side: T.BIRCH_SIDE }, hardness: 3, tool: 'axe' }),
  def('Birkenlaub', { opaque: false, tiles: same(T.BIRCH_LEAVES), hardness: 0.35, drop: null }),
  def('Schwarzeichenstamm', { tiles: { top: T.DARK_TOP, bottom: T.DARK_TOP, side: T.DARK_SIDE }, hardness: 3, tool: 'axe' }),
  def('Schwarzeichenlaub', { opaque: false, tiles: same(T.DARK_LEAVES), hardness: 0.35, drop: null }),
  def('Akazienstamm', { tiles: { top: T.ACACIA_TOP, bottom: T.ACACIA_TOP, side: T.ACACIA_SIDE }, hardness: 3, tool: 'axe' }),
  /* 45 */ def('Akazienlaub', { opaque: false, tiles: same(T.ACACIA_LEAVES), hardness: 0.35, drop: null }),
  def('Grobe Erde', { tiles: same(T.COARSE_DIRT), hardness: 0.75, tool: 'shovel' }),
  def('Heuballen', { tiles: { top: T.HAY_TOP, bottom: T.HAY_TOP, side: T.HAY_SIDE }, hardness: 0.7 }),
  def('Tiefenschiefer', { tiles: same(T.DEEPSLATE), hardness: 9, tool: 'pickaxe', minTier: 1 }),
  def('Tiefenschiefer-Kohle', { tiles: same(T.DS_COAL), hardness: 9, tool: 'pickaxe', minTier: 1 }),
  /* 50 */ def('Tiefenschiefer-Eisen', { tiles: same(T.DS_IRON), hardness: 9, tool: 'pickaxe', minTier: 2 }),
  def('Tiefenschiefer-Gold', { tiles: same(T.DS_GOLD), hardness: 9, tool: 'pickaxe', minTier: 3 }),
  def('Tiefenschiefer-Diamant', { tiles: same(T.DS_DIAMOND), hardness: 10, tool: 'pickaxe', minTier: 3 }),
  def('Tiefenschiefer-Smaragd', { tiles: same(T.DS_EMERALD), hardness: 10, tool: 'pickaxe', minTier: 3 }),
  def('TNT', { tiles: { top: T.TNT_TOP, bottom: T.TNT_TOP, side: T.TNT_SIDE }, hardness: 0.3 }),
  /* 55 */ def('Truhe', { tiles: { top: T.CHEST_TOP, bottom: T.CHEST_TOP, side: T.CHEST_FRONT }, hardness: 3, tool: 'axe' }),
  def('Monster-Spawner', { tiles: same(T.SPAWNER), hardness: 12, tool: 'pickaxe', minTier: 1, drop: null, light: 2 }),
  def('Schiene', { solid: false, opaque: false, ray: true, tiles: same(T.RAIL), hardness: 0.8, tool: 'pickaxe', type: 'flat' }),
  def('Tür (unten)', { opaque: false, tiles: same(T.DOOR_LOWER), hardness: 3, tool: 'axe', type: 'door', drop: B.DOOR_L }),
  def('Tür (oben)', { opaque: false, tiles: same(T.DOOR_UPPER), hardness: 3, tool: 'axe', type: 'door', drop: B.DOOR_L }),
  /* 60 */ def('Tür (offen, unten)', { solid: false, opaque: false, ray: true, tiles: same(T.DOOR_LOWER), hardness: 3, tool: 'axe', type: 'door', drop: B.DOOR_L }),
  def('Tür (offen, oben)', { solid: false, opaque: false, ray: true, tiles: same(T.DOOR_UPPER), hardness: 3, tool: 'axe', type: 'door', drop: B.DOOR_L }),
  def('Bett (Fussende)', { opaque: false, tiles: { top: T.BED_FOOT_TOP, bottom: T.PLANKS, side: T.BED_SIDE }, hardness: 0.6, type: 'bed', drop: B.BED_FOOT }),
  def('Bett (Kopfende)', { opaque: false, tiles: { top: T.BED_HEAD_TOP, bottom: T.PLANKS, side: T.BED_SIDE }, hardness: 0.6, type: 'bed', drop: null }),
  def('Trampelpfad', { tiles: { top: T.PATH_TOP, bottom: T.DIRT, side: T.PATH_SIDE }, hardness: 0.8, tool: 'shovel', drop: B.DIRT }),
  /* 65 */ def('Glas', { opaque: false, trans: true, alpha: 0.99, tiles: same(T.GLASS), hardness: 0.4, drop: null }),
  def('Sandstein', { tiles: { top: T.SANDSTONE_TOP, bottom: T.SANDSTONE_TOP, side: T.SANDSTONE }, hardness: 5, tool: 'pickaxe', minTier: 1 }),
  def('Druckplatte', { solid: false, opaque: false, ray: true, tiles: same(T.STONE), hardness: 0.6, tool: 'pickaxe', type: 'flat' }),
  def('Schneeblock', { tiles: same(T.SNOW_TOP), hardness: 0.5, tool: 'shovel' }),
  def('Bemooster Bruchstein', { tiles: same(T.MOSSY_COBBLE), hardness: 7, tool: 'pickaxe', minTier: 1 }),
  /* 70 */ waterDef('Wasser (fliessend 7)'),
  waterDef('Wasser (fliessend 6)'),
  waterDef('Wasser (fliessend 5)'),
  waterDef('Wasser (fliessend 4)'),
  waterDef('Wasser (fliessend 3)'),
  /* 75 */ waterDef('Wasser (fliessend 2)'),
  waterDef('Wasser (fliessend 1)'),
  lavaDef('Lava (fliessend 3)'),
  lavaDef('Lava (fliessend 2)'),
  lavaDef('Lava (fliessend 1)'),
];

// Start-Hotbar für neue Kreativwelten
export const CREATIVE_HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.PLANKS, B.COBBLE, B.LOG, B.GLOWSTONE, B.TORCH, B.TNT];

// Blöcke, die im Kreativ-Katalog auftauchen (alles Platzierbare/Sinnvolle)
export const CREATIVE_BLOCKS = [
  B.GRASS, B.DIRT, B.COARSE_DIRT, B.PATH, B.STONE, B.COBBLE, B.MOSSY_COBBLE, B.STONE_BRICKS,
  B.DEEPSLATE, B.SAND, B.SANDSTONE, B.GRAVEL, B.SNOWY_GRASS, B.SNOW_BLOCK,
  B.LOG, B.LEAVES, B.PLANKS, B.BIRCH_LOG, B.BIRCH_LEAVES, B.DARK_LOG, B.DARK_LEAVES,
  B.ACACIA_LOG, B.ACACIA_LEAVES,
  B.TORCH, B.GLASS, B.WOOL, B.HAY, B.CRAFTING_TABLE, B.FURNACE, B.CHEST, B.TNT,
  B.DOOR_L, B.BED_FOOT, B.RAIL, B.PRESSURE_PLATE, B.WEB, B.TALL_GRASS, B.FLOWER_YELLOW,
  B.FLOWER_RED, B.DEAD_BUSH, B.CACTUS,
  B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.EMERALD_ORE,
  B.DS_COAL, B.DS_IRON, B.DS_GOLD, B.DS_DIAMOND, B.DS_EMERALD,
  B.OBSIDIAN, B.BEDROCK, B.GLOWSTONE, B.NETHERRACK, B.END_STONE, B.SPAWNER,
  B.WATER, B.LAVA, B.DRAGON_EGG,
];

// UV-Koordinaten einer Kachel; leicht nach innen versetzt gegen Kantenbluten
export function tileUV(tile, u, v) {
  const e = 0.02;
  const uu = u * (1 - 2 * e) + e;
  const vv = v * (1 - 2 * e) + e;
  const tx = tile % ATLAS_COLS;
  const ty = (tile / ATLAS_COLS) | 0;
  return [(tx + uu) / ATLAS_COLS, 1 - (ty + 1 - vv) / ATLAS_ROWS];
}

// ============ Prozeduraler Atlas ============
export function createAtlasCanvas() {
  const c = document.createElement('canvas');
  c.width = ATLAS_COLS * TILE_PX;
  c.height = ATLAS_ROWS * TILE_PX;
  const g = c.getContext('2d');

  // Universeller Fallback: ALLES beginnt als Magenta/Schwarz-Schachbrett.
  // Jede Kachel ohne Zeichner (oder ohne Pack-Textur) bleibt automatisch "missing".
  for (let ty = 0; ty < ATLAS_ROWS; ty++) {
    for (let tx = 0; tx < ATLAS_COLS; tx++) {
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 2; x++) {
          g.fillStyle = (x + y) % 2 === 0 ? '#f800f8' : '#000000';
          g.fillRect(tx * TILE_PX + x * 8, ty * TILE_PX + y * 8, 8, 8);
        }
      }
    }
  }

  let s = 20260702;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const off = t => [(t % ATLAS_COLS) * TILE_PX, ((t / ATLAS_COLS) | 0) * TILE_PX];
  const pick = arr => arr[(rnd() * arr.length) | 0];
  const clear = t => { const [ox, oy] = off(t); g.clearRect(ox, oy, TILE_PX, TILE_PX); };
  const speckle = (t, cols) => {
    const [ox, oy] = off(t);
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
      g.fillStyle = pick(cols);
      g.fillRect(ox + x, oy + y, 1, 1);
    }
  };
  const px = (t, x, y, col) => { const [ox, oy] = off(t); g.fillStyle = col; g.fillRect(ox + x, oy + y, 1, 1); };
  const rect = (t, x, y, w, h, col) => { const [ox, oy] = off(t); g.fillStyle = col; g.fillRect(ox + x, oy + y, w, h); };

  const GREENS = ['#69a844', '#5d9c3f', '#549238', '#71b14b'];
  const DIRTS = ['#8f6a4b', '#84603f', '#9b7454', '#7a5738'];
  const WHITES = ['#f4f8fa', '#e9eff3', '#dde6ec', '#f9fcfe'];
  const STONES = ['#8e8e8e', '#848484', '#9a9a9a', '#7b7b7b'];
  const DEEPS = ['#4a4a52', '#3e3e46', '#55555e', '#35353c'];

  // --- Einfache Speckle-Kacheln ---
  const speckleMap = [
    [T.GRASS_TOP, GREENS], [T.DIRT, DIRTS], [T.STONE, STONES],
    [T.SAND, ['#e0d6a5', '#d8cd97', '#e8dfb2', '#d1c58c']],
    [T.LEAVES, ['#3e6b27', '#356020', '#48772e', '#2c5219', '#243f14']],
    [T.SNOW_TOP, WHITES],
    [T.WOOL, ['#ececec', '#e2e2e2', '#f5f5f5', '#d8d8d8']],
    [T.OBSIDIAN, ['#17111f', '#221933', '#0f0a17', '#2c2244']],
    [T.NETHERRACK, ['#6e2727', '#5e1f1f', '#7d3232', '#521a1a', '#83403a']],
    [T.GLOWSTONE, ['#f9d364', '#eec049', '#fce490', '#d9a933', '#fff3b5']],
    [T.LAVA, ['#e06010', '#f28a1d', '#c74a0a', '#fcae2c', '#ffd75e']],
    [T.END_STONE, ['#e6e8a8', '#dcde9c', '#eff1b8', '#d2d490']],
    [T.GRAVEL, ['#8a8078', '#7a716a', '#9a908a', '#6e655e', '#a39a92']],
    [T.BEDROCK, ['#3a3a3a', '#2e2e2e', '#474747', '#242424']],
    [T.WATER, ['#2e64c8', '#2857b4', '#3a72d8', '#2350a8', '#4880e0']],
    [T.BIRCH_LEAVES, ['#6a9a4e', '#5e8c44', '#77a85a', '#527c3a']],
    [T.DARK_LEAVES, ['#1e4014', '#17330e', '#25501a', '#122a0a']],
    [T.ACACIA_LEAVES, ['#5e8c30', '#527c28', '#6a9c3a', '#476c22']],
    [T.COARSE_DIRT, ['#8f6a4b', '#6e5238', '#9b7454', '#5c4630', '#84603f']],
    [T.DEEPSLATE, DEEPS],
    [T.SNOW_SIDE, DIRTS], [T.GRASS_SIDE, DIRTS],
    [T.PATH_SIDE, DIRTS],
    [T.PATH_TOP, ['#a88a56', '#9c7e4c', '#b49662', '#8f7042']],
    [T.SANDSTONE, ['#dfd5a5', '#d5ca97', '#e5dcb0', '#cdc28e']],
    [T.SANDSTONE_TOP, ['#e5dcb0', '#dfd5a5', '#ecc']],
    [T.HAY_TOP, ['#c8a634', '#b8962a', '#d8b642', '#a8861f']],
    [T.MOSSY_COBBLE, ['#7d7d7d', '#6a8a5a', '#707070', '#5a7a4a', '#878787']],
  ];
  for (const [tile, cols] of speckleMap) speckle(tile, cols);

  // Gras-/Schneeseite: Narbe oben
  for (const [tile, topCols] of [[T.GRASS_SIDE, GREENS], [T.SNOW_SIDE, WHITES], [T.PATH_SIDE, ['#a88a56', '#9c7e4c']]]) {
    const [ox, oy] = off(tile);
    for (let x = 0; x < TILE_PX; x++) {
      const d = 2 + ((rnd() * 3) | 0);
      for (let y = 0; y < d; y++) { g.fillStyle = pick(topCols); g.fillRect(ox + x, oy + y, 1, 1); }
    }
  }

  // --- Stämme (parametrisiert) ---
  const drawLog = (sideTile, topTile, bark, barkDark, inner) => {
    const [ox, oy] = off(sideTile);
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
      const col = x % 4 === 0 ? barkDark : rnd() < 0.2 ? barkDark : bark;
      g.fillStyle = col;
      g.fillRect(ox + x, oy + y, 1, 1);
    }
    const [tx2, ty2] = off(topTile);
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) | 0;
      let col = (x === 0 || y === 0 || x === 15 || y === 15) ? barkDark : (d & 1 ? bark : inner);
      if (rnd() < 0.08) col = barkDark;
      g.fillStyle = col;
      g.fillRect(tx2 + x, ty2 + y, 1, 1);
    }
  };
  drawLog(T.LOG_SIDE, T.LOG_TOP, '#6b5138', '#4a3826', '#8a6d46');
  drawLog(T.BIRCH_SIDE, T.BIRCH_TOP, '#e8e2d4', '#3a3a34', '#c8b888');
  drawLog(T.DARK_SIDE, T.DARK_TOP, '#3a2a1a', '#241a0e', '#584028');
  drawLog(T.ACACIA_SIDE, T.ACACIA_TOP, '#6e5a4a', '#4a3a2e', '#b85c3a');
  // Birke: dunkle Flecken
  { const [ox, oy] = off(T.BIRCH_SIDE); for (let i = 0; i < 7; i++) { g.fillStyle = '#2e2e28'; g.fillRect(ox + ((rnd() * 13) | 0), oy + ((rnd() * 14) | 0), 2 + ((rnd() * 2) | 0), 1); } }

  // --- Bretter ---
  const drawPlanks = (tile) => {
    const [ox, oy] = off(tile);
    const shades = ['#a08050', '#96784a', '#a98a58', '#8f7042'];
    for (let y = 0; y < TILE_PX; y++) {
      const p = y >> 2;
      for (let x = 0; x < TILE_PX; x++) {
        let col = shades[p & 3];
        if ((y & 3) === 3) col = '#6b5533';
        else if (x === (p & 1 ? 4 : 11)) col = '#6b5533';
        else if (rnd() < 0.12) col = '#8a6f42';
        g.fillStyle = col;
        g.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  };
  drawPlanks(T.PLANKS);

  // --- Bruchstein ---
  const drawCobble = (tile) => {
    const [ox, oy] = off(tile);
    for (let i = 0; i < 9; i++) {
      const x0 = (rnd() * 12) | 0, y0 = (rnd() * 12) | 0;
      const w = 2 + ((rnd() * 3) | 0), h = 2 + ((rnd() * 3) | 0);
      g.fillStyle = pick(['#919191', '#767676', '#838383']);
      g.fillRect(ox + x0, oy + y0, w, h);
      g.fillStyle = '#5c5c5c';
      if (y0 + h < TILE_PX) g.fillRect(ox + x0, oy + y0 + h, w, 1);
      if (x0 + w < TILE_PX) g.fillRect(ox + x0 + w, oy + y0, 1, h);
    }
  };
  speckle(T.COBBLE, ['#7d7d7d', '#878787', '#707070', '#8f8f8f']);
  drawCobble(T.COBBLE);
  drawCobble(T.MOSSY_COBBLE);

  // --- Kaktus ---
  {
    const [ox, oy] = off(T.CACTUS);
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
      let col = x % 4 === 1 ? '#0e5c1e' : pick(['#1a7a2e', '#22883a', '#146827']);
      if (rnd() < 0.05) col = '#0a4a16';
      g.fillStyle = col;
      g.fillRect(ox + x, oy + y, 1, 1);
    }
  }

  // --- Werkbank ---
  drawPlanks(T.TABLE_TOP);
  rect(T.TABLE_TOP, 1, 1, 14, 1, '#5a4224'); rect(T.TABLE_TOP, 1, 14, 14, 1, '#5a4224');
  rect(T.TABLE_TOP, 1, 1, 1, 14, '#5a4224'); rect(T.TABLE_TOP, 14, 1, 1, 14, '#5a4224');
  rect(T.TABLE_TOP, 3, 3, 4, 4, '#c9a55f'); rect(T.TABLE_TOP, 9, 9, 4, 4, '#c9a55f');
  drawPlanks(T.TABLE_SIDE);
  rect(T.TABLE_SIDE, 2, 3, 5, 4, '#5a4224'); rect(T.TABLE_SIDE, 9, 3, 4, 4, '#8a8a8a');

  // --- Glowstone-Blobs ---
  { const [ox, oy] = off(T.GLOWSTONE); for (let i = 0; i < 6; i++) { g.fillStyle = '#fff8cf'; g.fillRect(ox + ((rnd() * 13) | 0), oy + ((rnd() * 13) | 0), 2, 2); } }

  // --- Netherportal ---
  {
    const [ox, oy] = off(T.PORTAL);
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
      const sw = Math.sin((x + y * 0.7) * 0.9) * 0.5 + 0.5;
      g.fillStyle = sw > 0.6 ? '#b565e8' : pick(['#7a2bb5', '#6a1fa5', '#8c3bcc', '#5a1590']);
      g.fillRect(ox + x, oy + y, 1, 1);
    }
  }

  // --- End-Portal ---
  {
    const [ox, oy] = off(T.END_PORTAL);
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
      g.fillStyle = pick(['#0a0a12', '#0d1016', '#070710']);
      g.fillRect(ox + x, oy + y, 1, 1);
    }
    for (let i = 0; i < 12; i++) {
      g.fillStyle = pick(['#3adf8f', '#7cf2c0', '#1f9f60', '#c8ffe8']);
      g.fillRect(ox + ((rnd() * 16) | 0), oy + ((rnd() * 16) | 0), 1, 1);
    }
  }

  // --- Erze (Stein + Deepslate-Varianten) ---
  const drawOre = (tile, base, cols) => {
    speckle(tile, base);
    const [ox, oy] = off(tile);
    for (let i = 0; i < 7; i++) {
      const x0 = 1 + ((rnd() * 13) | 0), y0 = 1 + ((rnd() * 13) | 0);
      g.fillStyle = pick(cols);
      g.fillRect(ox + x0, oy + y0, 2, 2);
      g.fillStyle = pick(cols);
      g.fillRect(ox + x0 + ((rnd() * 2) | 0), oy + y0 + ((rnd() * 2) | 0), 1, 1);
    }
  };
  const ORE_COLS = {
    coal: ['#2a2a2a', '#1c1c1c', '#3a3a3a'],
    iron: ['#d8af93', '#c99b7c', '#e8c3a8'],
    gold: ['#f5d93a', '#e8c421', '#fcea6e'],
    diamond: ['#4aedd9', '#2fd9c4', '#8ff7ea'],
    emerald: ['#2bd648', '#17b834', '#5aef73'],
  };
  drawOre(T.COAL_ORE, STONES, ORE_COLS.coal);
  drawOre(T.IRON_ORE, STONES, ORE_COLS.iron);
  drawOre(T.GOLD_ORE, STONES, ORE_COLS.gold);
  drawOre(T.DIAMOND_ORE, STONES, ORE_COLS.diamond);
  drawOre(T.EMERALD_ORE, STONES, ORE_COLS.emerald);
  drawOre(T.DS_COAL, DEEPS, ORE_COLS.coal);
  drawOre(T.DS_IRON, DEEPS, ORE_COLS.iron);
  drawOre(T.DS_GOLD, DEEPS, ORE_COLS.gold);
  drawOre(T.DS_DIAMOND, DEEPS, ORE_COLS.diamond);
  drawOre(T.DS_EMERALD, DEEPS, ORE_COLS.emerald);

  // --- Ofen ---
  const drawFurnace = (tile, lit) => {
    speckle(tile, STONES);
    rect(tile, 3, 6, 10, 8, '#4a4a4a');
    rect(tile, 4, 8, 8, 5, lit ? '#f8a428' : '#1a1a1a');
    if (lit) { rect(tile, 5, 10, 2, 3, '#ffe27a'); rect(tile, 9, 9, 2, 4, '#ffe27a'); }
  };
  drawFurnace(T.FURNACE_FRONT, false);
  drawFurnace(T.FURNACE_LIT, true);
  speckle(T.FURNACE_TOP, STONES);
  rect(T.FURNACE_TOP, 0, 0, 16, 1, '#5c5c5c'); rect(T.FURNACE_TOP, 0, 15, 16, 1, '#5c5c5c');
  rect(T.FURNACE_TOP, 0, 0, 1, 16, '#5c5c5c'); rect(T.FURNACE_TOP, 15, 0, 1, 16, '#5c5c5c');

  // --- Kies-Steinchen ---
  { const [ox, oy] = off(T.GRAVEL); for (let i = 0; i < 10; i++) { g.fillStyle = pick(['#b0a89e', '#5e564e', '#978d84']); g.fillRect(ox + ((rnd() * 14) | 0), oy + ((rnd() * 14) | 0), 2, 2); } }

  // --- Steinziegel ---
  {
    speckle(T.STONE_BRICKS, STONES);
    const [ox, oy] = off(T.STONE_BRICKS);
    g.fillStyle = '#5c5c5c';
    for (let y = 0; y < TILE_PX; y += 4) g.fillRect(ox, oy + y, 16, 1);
    for (let y = 0; y < TILE_PX; y += 4) {
      const shift = (y / 4) % 2 === 0 ? 0 : 4;
      for (let x = shift; x < TILE_PX; x += 8) g.fillRect(ox + x, oy + y, 1, 4);
    }
  }

  // --- Endportalrahmen ---
  const FRAME = ['#3f6e5a', '#356050', '#4a7a66', '#2c5244'];
  speckle(T.END_FRAME_SIDE, FRAME);
  rect(T.END_FRAME_SIDE, 0, 12, 16, 4, '#e6e8a8');
  speckle(T.END_FRAME_TOP, FRAME);
  rect(T.END_FRAME_TOP, 4, 4, 8, 8, '#26443a');
  speckle(T.END_FRAME_EYE, FRAME);
  rect(T.END_FRAME_EYE, 3, 3, 10, 10, '#26443a');
  rect(T.END_FRAME_EYE, 4, 4, 8, 8, '#1a3a2e');
  rect(T.END_FRAME_EYE, 6, 6, 4, 4, '#4adf8f');
  rect(T.END_FRAME_EYE, 7, 7, 2, 2, '#0a1a12');

  // --- Drachenei ---
  {
    const [ox, oy] = off(T.DRAGON_EGG);
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
      const dx = x - 7.5, dy = y - 8;
      const inside = (dx * dx) / 36 + (dy * dy) / 56 < 1;
      g.fillStyle = inside ? pick(['#14101c', '#1e1430', '#0c0a14', '#2a1a44']) : '#000';
      g.fillRect(ox + x, oy + y, 1, 1);
    }
    for (let i = 0; i < 5; i++) { g.fillStyle = '#7a3bd0'; g.fillRect(ox + 4 + ((rnd() * 8) | 0), oy + 4 + ((rnd() * 9) | 0), 1, 1); }
  }

  // ============ Neue Kacheln mit Transparenz (erst leeren!) ============

  // Fackel: Stiel + glühende Spitze
  clear(T.TORCH);
  rect(T.TORCH, 7, 6, 2, 10, '#8a6432');
  rect(T.TORCH, 7, 8, 1, 8, '#6e4f26');
  rect(T.TORCH, 6, 3, 4, 4, '#f8c838');
  rect(T.TORCH, 7, 2, 2, 2, '#fff0a0');

  // Hohes Gras
  clear(T.TALL_GRASS);
  for (let i = 0; i < 9; i++) {
    const x = 1 + ((rnd() * 14) | 0);
    const h = 6 + ((rnd() * 9) | 0);
    for (let y = 0; y < h; y++) px(T.TALL_GRASS, Math.min(15, x + ((y > h - 3 && rnd() < 0.4) ? 1 : 0)), 15 - y, pick(GREENS));
  }

  // Blumen
  const drawFlower = (tile, petals, center) => {
    clear(tile);
    rect(tile, 7, 8, 2, 8, '#3e7a2a');
    rect(tile, 5, 4, 6, 5, petals);
    rect(tile, 6, 3, 4, 1, petals);
    rect(tile, 7, 6, 2, 2, center);
  };
  drawFlower(T.FLOWER_YELLOW, '#f8d838', '#c89a18');
  drawFlower(T.FLOWER_RED, '#d84838', '#3a1a10');

  // Toter Busch
  clear(T.DEAD_BUSH);
  rect(T.DEAD_BUSH, 7, 9, 2, 7, '#7a5a34');
  for (const [x0, y0, x1, y1] of [[7, 9, 3, 4], [8, 9, 12, 4], [7, 11, 4, 8], [8, 11, 11, 7], [7, 8, 7, 3]]) {
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      px(T.DEAD_BUSH, Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps), '#8a6a3e');
    }
  }

  // Spinnennetz
  clear(T.WEB);
  for (let i = 0; i < 16; i++) {
    px(T.WEB, i, i, '#e8e8e8'); px(T.WEB, 15 - i, i, '#e8e8e8');
    if (i % 3 === 0) { px(T.WEB, i, 7, '#d8d8d8'); px(T.WEB, 7, i, '#d8d8d8'); }
  }
  for (const r of [3, 6]) {
    for (let a = 0; a < 24; a++) {
      const x = Math.round(7.5 + Math.cos(a / 24 * Math.PI * 2) * r);
      const y = Math.round(7.5 + Math.sin(a / 24 * Math.PI * 2) * r);
      px(T.WEB, x, y, '#e0e0e0');
    }
  }

  // Heu-Seite: vertikale Halme mit Band
  speckle(T.HAY_SIDE, ['#c8a634', '#b8962a', '#d8b642']);
  { const [ox, oy] = off(T.HAY_SIDE); for (let x = 0; x < 16; x += 2) { g.fillStyle = '#8a6a1a'; g.fillRect(ox + x, oy, 1, 16); } g.fillStyle = '#6a5a2a'; g.fillRect(ox, oy + 6, 16, 3); }

  // TNT
  speckle(T.TNT_SIDE, ['#c83a2a', '#b82e20', '#d84838']);
  rect(T.TNT_SIDE, 0, 5, 16, 6, '#e8e0d0');
  { const [ox, oy] = off(T.TNT_SIDE); g.fillStyle = '#1a1a1a'; g.font = 'bold 6px monospace'; g.fillText('TNT', ox + 2, oy + 10); }
  speckle(T.TNT_TOP, ['#c83a2a', '#b82e20']);
  { const [ox, oy] = off(T.TNT_TOP); for (let yy = 2; yy < 16; yy += 5) for (let xx = 2; xx < 16; xx += 5) { g.fillStyle = '#e8e0d0'; g.fillRect(ox + xx, oy + yy, 3, 3); g.fillStyle = '#5a4a3a'; g.fillRect(ox + xx + 1, oy + yy + 1, 1, 1); } }

  // Truhe
  const CHESTS = ['#9a6a34', '#8a5e2c', '#a8763c'];
  speckle(T.CHEST_FRONT, CHESTS);
  rect(T.CHEST_FRONT, 0, 0, 16, 1, '#5a3c1a'); rect(T.CHEST_FRONT, 0, 15, 16, 1, '#5a3c1a');
  rect(T.CHEST_FRONT, 0, 0, 1, 16, '#5a3c1a'); rect(T.CHEST_FRONT, 15, 0, 1, 16, '#5a3c1a');
  rect(T.CHEST_FRONT, 0, 6, 16, 1, '#5a3c1a');
  rect(T.CHEST_FRONT, 6, 5, 4, 4, '#8a8a8a'); rect(T.CHEST_FRONT, 7, 6, 2, 2, '#3a3a3a');
  speckle(T.CHEST_SIDE, CHESTS);
  rect(T.CHEST_SIDE, 0, 0, 16, 1, '#5a3c1a'); rect(T.CHEST_SIDE, 0, 15, 16, 1, '#5a3c1a');
  rect(T.CHEST_SIDE, 0, 6, 16, 1, '#5a3c1a');
  speckle(T.CHEST_TOP, CHESTS);
  rect(T.CHEST_TOP, 0, 0, 16, 1, '#5a3c1a'); rect(T.CHEST_TOP, 0, 15, 16, 1, '#5a3c1a');
  rect(T.CHEST_TOP, 0, 0, 1, 16, '#5a3c1a'); rect(T.CHEST_TOP, 15, 0, 1, 16, '#5a3c1a');

  // Spawner: dunkles Gitter
  {
    const [ox, oy] = off(T.SPAWNER);
    g.fillStyle = '#1a2a30';
    g.fillRect(ox, oy, 16, 16);
    g.fillStyle = '#3a5560';
    for (let i = 0; i < 16; i += 3) { g.fillRect(ox + i, oy, 1, 16); g.fillRect(ox, oy + i, 16, 1); }
  }

  // Schiene (transparent)
  clear(T.RAIL);
  for (let y = 1; y < 16; y += 4) rect(T.RAIL, 1, y, 14, 2, '#7a5a34');
  rect(T.RAIL, 3, 0, 2, 16, '#9a9aa2');
  rect(T.RAIL, 11, 0, 2, 16, '#9a9aa2');

  // Tür
  drawPlanks(T.DOOR_LOWER);
  rect(T.DOOR_LOWER, 0, 0, 1, 16, '#5a4224'); rect(T.DOOR_LOWER, 15, 0, 1, 16, '#5a4224');
  rect(T.DOOR_LOWER, 3, 3, 10, 5, '#7a5f38');
  drawPlanks(T.DOOR_UPPER);
  rect(T.DOOR_UPPER, 0, 0, 1, 16, '#5a4224'); rect(T.DOOR_UPPER, 15, 0, 1, 16, '#5a4224');
  rect(T.DOOR_UPPER, 3, 4, 4, 5, '#b8dced');
  rect(T.DOOR_UPPER, 9, 4, 4, 5, '#b8dced');

  // Bett
  rect(T.BED_HEAD_TOP, 0, 0, 16, 16, '#c8c8c8');
  rect(T.BED_HEAD_TOP, 2, 2, 12, 8, '#e8e8e8');
  rect(T.BED_HEAD_TOP, 0, 12, 16, 4, '#a83030');
  rect(T.BED_FOOT_TOP, 0, 0, 16, 16, '#a83030');
  rect(T.BED_FOOT_TOP, 0, 0, 16, 2, '#c04040');
  rect(T.BED_SIDE, 0, 0, 16, 16, '#7a5a34');
  rect(T.BED_SIDE, 0, 0, 16, 4, '#a83030');
  rect(T.BED_SIDE, 0, 4, 16, 5, '#8a3030');

  // Glas (transparent mit Rahmen + Glanz)
  clear(T.GLASS);
  { const [ox, oy] = off(T.GLASS); g.fillStyle = 'rgba(200,230,240,0.30)'; g.fillRect(ox, oy, 16, 16); }
  rect(T.GLASS, 0, 0, 16, 1, '#cfe4ec'); rect(T.GLASS, 0, 15, 16, 1, '#cfe4ec');
  rect(T.GLASS, 0, 0, 1, 16, '#cfe4ec'); rect(T.GLASS, 15, 0, 1, 16, '#cfe4ec');
  for (let i = 2; i < 7; i++) px(T.GLASS, i, 8 - i, '#eef8fc');

  // Sandstein-Seite: Bänder
  { const [ox, oy] = off(T.SANDSTONE); g.fillStyle = '#c5ba85'; g.fillRect(ox, oy + 3, 16, 1); g.fillRect(ox, oy + 9, 16, 1); g.fillRect(ox, oy + 13, 16, 1); }

  return c;
}
