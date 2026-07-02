// Lädt ein offizielles Minecraft-Ressourcen-Pack (falls unter ./texturepack/ entpackt):
// Block-Kacheln auf den Atlas, Item-Icons, Entity-Skins (für die Mob-Modelle) und
// Zerstörungs-Risse. Fehlt eine Textur, bleibt der prozedurale Fallback bzw. das
// universelle Magenta-Schachbrett sichtbar. Moderne (1.13+) und alte Namen werden probiert.

import { TILES as T, ATLAS_COLS, TILE_PX } from './blocks.js';
import { I, setItemImage, clearIconCache } from './items.js';

const ROOTS = [
  'texturepack/assets/minecraft/textures/',
  'texturepack/textures/',
];
const BLOCK_DIRS = ['block/', 'blocks/'];
const ITEM_DIRS = ['item/', 'items/'];

const FOLIAGE = '#59a52e';

// Kachel -> Kandidaten-Dateinamen (ohne .png)
const TILE_SOURCES = {
  [T.GRASS_TOP]: { names: ['grass_block_top', 'grass_top'], tint: '#7cbd6b' },
  [T.GRASS_SIDE]: { names: ['grass_block_side', 'grass_side'], overlay: ['grass_block_side_overlay', 'grass_side_overlay'], overlayTint: '#7cbd6b' },
  [T.DIRT]: { names: ['dirt'] },
  [T.STONE]: { names: ['stone'] },
  [T.SAND]: { names: ['sand'] },
  [T.LOG_SIDE]: { names: ['oak_log', 'log_oak'] },
  [T.LOG_TOP]: { names: ['oak_log_top', 'log_oak_top'] },
  [T.LEAVES]: { names: ['oak_leaves', 'leaves_oak'], tint: FOLIAGE },
  [T.PLANKS]: { names: ['oak_planks', 'planks_oak'] },
  [T.COBBLE]: { names: ['cobblestone'] },
  [T.BEDROCK]: { names: ['bedrock'] },
  [T.SNOW_TOP]: { names: ['snow'] },
  [T.SNOW_SIDE]: { names: ['grass_block_snow', 'grass_side_snowed'] },
  [T.CACTUS]: { names: ['cactus_side'] },
  [T.WOOL]: { names: ['white_wool', 'wool_colored_white'] },
  [T.TABLE_TOP]: { names: ['crafting_table_top'] },
  [T.TABLE_SIDE]: { names: ['crafting_table_front', 'crafting_table_side'] },
  [T.OBSIDIAN]: { names: ['obsidian'] },
  [T.NETHERRACK]: { names: ['netherrack'] },
  [T.GLOWSTONE]: { names: ['glowstone'] },
  [T.LAVA]: { names: ['lava_still'] },
  [T.PORTAL]: { names: ['nether_portal', 'portal'] },
  [T.END_STONE]: { names: ['end_stone'] },
  [T.WATER]: { names: ['water_still'], tint: '#3f76e4' },
  [T.COAL_ORE]: { names: ['coal_ore'] },
  [T.IRON_ORE]: { names: ['iron_ore'] },
  [T.GOLD_ORE]: { names: ['gold_ore'] },
  [T.DIAMOND_ORE]: { names: ['diamond_ore'] },
  [T.EMERALD_ORE]: { names: ['emerald_ore'] },
  [T.FURNACE_FRONT]: { names: ['furnace_front', 'furnace_front_off'] },
  [T.FURNACE_LIT]: { names: ['furnace_front_on'] },
  [T.FURNACE_TOP]: { names: ['furnace_top'] },
  [T.GRAVEL]: { names: ['gravel'] },
  [T.STONE_BRICKS]: { names: ['stone_bricks', 'stonebrick'] },
  [T.END_FRAME_TOP]: { names: ['end_portal_frame_top', 'endframe_top'] },
  [T.END_FRAME_SIDE]: { names: ['end_portal_frame_side', 'endframe_side'] },
  [T.END_FRAME_EYE]: { names: ['end_portal_frame_top', 'endframe_top'], overlay: ['end_portal_frame_eye', 'endframe_eye'] },
  [T.DRAGON_EGG]: { names: ['dragon_egg'] },
  [T.TORCH]: { names: ['torch', 'torch_on'] },
  [T.TALL_GRASS]: { names: ['short_grass', 'grass', 'tallgrass'], tint: '#7cbd6b' },
  [T.FLOWER_YELLOW]: { names: ['dandelion', 'flower_dandelion'] },
  [T.FLOWER_RED]: { names: ['poppy', 'flower_rose'] },
  [T.DEAD_BUSH]: { names: ['dead_bush', 'deadbush'] },
  [T.WEB]: { names: ['cobweb', 'web'] },
  [T.BIRCH_SIDE]: { names: ['birch_log', 'log_birch'] },
  [T.BIRCH_TOP]: { names: ['birch_log_top', 'log_birch_top'] },
  [T.BIRCH_LEAVES]: { names: ['birch_leaves', 'leaves_birch'], tint: '#80a755' },
  [T.DARK_SIDE]: { names: ['dark_oak_log', 'log_big_oak'] },
  [T.DARK_TOP]: { names: ['dark_oak_log_top', 'log_big_oak_top'] },
  [T.DARK_LEAVES]: { names: ['dark_oak_leaves', 'leaves_big_oak'], tint: FOLIAGE },
  [T.ACACIA_SIDE]: { names: ['acacia_log', 'log_acacia'] },
  [T.ACACIA_TOP]: { names: ['acacia_log_top', 'log_acacia_top'] },
  [T.ACACIA_LEAVES]: { names: ['acacia_leaves', 'leaves_acacia'], tint: '#aea42a' },
  [T.COARSE_DIRT]: { names: ['coarse_dirt'] },
  [T.HAY_SIDE]: { names: ['hay_block_side'] },
  [T.HAY_TOP]: { names: ['hay_block_top'] },
  [T.DEEPSLATE]: { names: ['deepslate'] },
  [T.DS_COAL]: { names: ['deepslate_coal_ore'] },
  [T.DS_IRON]: { names: ['deepslate_iron_ore'] },
  [T.DS_GOLD]: { names: ['deepslate_gold_ore'] },
  [T.DS_DIAMOND]: { names: ['deepslate_diamond_ore'] },
  [T.DS_EMERALD]: { names: ['deepslate_emerald_ore'] },
  [T.TNT_SIDE]: { names: ['tnt_side'] },
  [T.TNT_TOP]: { names: ['tnt_top'] },
  [T.SPAWNER]: { names: ['spawner', 'mob_spawner'] },
  [T.RAIL]: { names: ['rail', 'rail_normal'] },
  [T.DOOR_UPPER]: { names: ['oak_door_top', 'door_wood_upper'] },
  [T.DOOR_LOWER]: { names: ['oak_door_bottom', 'door_wood_lower'] },
  [T.PATH_TOP]: { names: ['dirt_path_top', 'grass_path_top'] },
  [T.PATH_SIDE]: { names: ['dirt_path_side', 'grass_path_side'] },
  [T.GLASS]: { names: ['glass'] },
  [T.SANDSTONE]: { names: ['sandstone', 'sandstone_normal'] },
  [T.SANDSTONE_TOP]: { names: ['sandstone_top'] },
  [T.MOSSY_COBBLE]: { names: ['mossy_cobblestone', 'cobblestone_mossy'] },
  // Truhe/Bett sind in modernen Packs Entity-Texturen – prozedurale Kacheln bleiben.
};

const ITEM_SOURCES = {
  [I.STICK]: ['stick'],
  [I.W_PICK]: ['wooden_pickaxe', 'wood_pickaxe'],
  [I.S_PICK]: ['stone_pickaxe'],
  [I.I_PICK]: ['iron_pickaxe'],
  [I.D_PICK]: ['diamond_pickaxe'],
  [I.W_AXE]: ['wooden_axe', 'wood_axe'],
  [I.S_AXE]: ['stone_axe'],
  [I.I_AXE]: ['iron_axe'],
  [I.D_AXE]: ['diamond_axe'],
  [I.W_SHOVEL]: ['wooden_shovel', 'wood_shovel'],
  [I.S_SHOVEL]: ['stone_shovel'],
  [I.I_SHOVEL]: ['iron_shovel'],
  [I.D_SHOVEL]: ['diamond_shovel'],
  [I.W_SWORD]: ['wooden_sword', 'wood_sword'],
  [I.S_SWORD]: ['stone_sword'],
  [I.I_SWORD]: ['iron_sword'],
  [I.D_SWORD]: ['diamond_sword'],
  [I.APPLE]: ['apple'],
  [I.GOLDEN_APPLE]: ['golden_apple', 'apple_golden'],
  [I.FLESH]: ['rotten_flesh'],
  [I.BEEF]: ['beef', 'beef_raw'],
  [I.COOKED_BEEF]: ['cooked_beef', 'beef_cooked'],
  [I.MUTTON]: ['mutton', 'mutton_raw'],
  [I.COOKED_MUTTON]: ['cooked_mutton', 'mutton_cooked'],
  [I.BONE]: ['bone'],
  [I.GUNPOWDER]: ['gunpowder'],
  [I.COAL]: ['coal'],
  [I.IRON_INGOT]: ['iron_ingot'],
  [I.GOLD_INGOT]: ['gold_ingot'],
  [I.DIAMOND]: ['diamond'],
  [I.EMERALD]: ['emerald'],
  [I.FLINT]: ['flint'],
  [I.FLINT_STEEL]: ['flint_and_steel'],
  [I.BLAZE_ROD]: ['blaze_rod'],
  [I.BLAZE_POWDER]: ['blaze_powder'],
  [I.ENDER_PEARL]: ['ender_pearl'],
  [I.ENDER_EYE]: ['ender_eye'],
  [I.LEATHER]: ['leather'],
  [I.L_HELM]: ['leather_helmet'],
  [I.L_CHEST]: ['leather_chestplate'],
  [I.L_LEGS]: ['leather_leggings'],
  [I.L_BOOTS]: ['leather_boots'],
  [I.I_HELM]: ['iron_helmet'],
  [I.I_CHEST]: ['iron_chestplate'],
  [I.I_LEGS]: ['iron_leggings'],
  [I.I_BOOTS]: ['iron_boots'],
  [I.D_HELM]: ['diamond_helmet'],
  [I.D_CHEST]: ['diamond_chestplate'],
  [I.D_LEGS]: ['diamond_leggings'],
  [I.D_BOOTS]: ['diamond_boots'],
  [I.BUCKET]: ['bucket'],
  [I.WATER_BUCKET]: ['water_bucket', 'bucket_water'],
  [I.LAVA_BUCKET]: ['lava_bucket', 'bucket_lava'],
  [I.BOW]: ['bow'],
  [I.ARROW]: ['arrow'],
  [I.STRING]: ['string'],
  [I.WHEAT]: ['wheat'],
  [I.BREAD]: ['bread'],
};

// Entity-Skins (Pfad relativ zu textures/)
const ENTITY_SOURCES = {
  zombie: ['entity/zombie/zombie'],
  skeleton: ['entity/skeleton/skeleton'],
  creeper: ['entity/creeper/creeper'],
  villager: ['entity/villager/villager'],
  enderman: ['entity/enderman/enderman'],
  cow: ['entity/cow/cow'],
  sheep: ['entity/sheep/sheep'],
  golem: ['entity/iron_golem/iron_golem', 'entity/iron_golem'],
  blaze: ['entity/blaze'],
};

let packActive = false;
const entitySkins = new Map();
const crackStages = [];

export function isPackActive() { return packActive; }
export function getEntitySkin(type) { return entitySkins.get(type) || null; }
export function getCrackStage(i) { return crackStages[i] || null; }

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadFirst(dirs, names) {
  for (const root of ROOTS) {
    for (const dir of dirs) {
      for (const name of names) {
        try {
          return await loadImage(root + dir + name + '.png');
        } catch { /* nächster Kandidat */ }
      }
    }
  }
  return null;
}

// 16x16-Frame extrahieren (animierte Texturen sind vertikale Streifen) + optional einfärben
function frameCanvas(img, tint) {
  const size = img.width;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, size, size, 0, 0, size, size);
  if (tint) {
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = tint;
    g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(img, 0, 0, size, size, 0, 0, size, size);
    g.globalCompositeOperation = 'source-over';
  }
  return c;
}

function toCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

export async function loadTexturePack(atlasCanvas) {
  const g = atlasCanvas.getContext('2d');
  let loaded = 0;

  const probe = await loadFirst(BLOCK_DIRS, ['stone']);
  if (!probe) {
    console.log('[Texturen] Kein Texture-Pack unter ./texturepack/ gefunden – prozedurale Texturen aktiv');
    return 0;
  }
  packActive = true;

  const tileJobs = Object.entries(TILE_SOURCES).map(async ([tile, src]) => {
    const img = await loadFirst(BLOCK_DIRS, src.names);
    if (!img) return;
    const tx = (tile % ATLAS_COLS) * TILE_PX;
    const ty = ((tile / ATLAS_COLS) | 0) * TILE_PX;
    g.clearRect(tx, ty, TILE_PX, TILE_PX);
    g.imageSmoothingEnabled = false;
    g.drawImage(frameCanvas(img, src.tint), 0, 0, img.width, img.width, tx, ty, TILE_PX, TILE_PX);
    if (src.overlay) {
      const ov = await loadFirst(BLOCK_DIRS, src.overlay);
      if (ov) g.drawImage(frameCanvas(ov, src.overlayTint), 0, 0, ov.width, ov.width, tx, ty, TILE_PX, TILE_PX);
    }
    loaded++;
  });

  const itemJobs = Object.entries(ITEM_SOURCES).map(async ([id, names]) => {
    const img = await loadFirst(ITEM_DIRS, names);
    if (!img) return;
    setItemImage(Number(id), frameCanvas(img));
    loaded++;
  });

  const entityJobs = Object.entries(ENTITY_SOURCES).map(async ([type, names]) => {
    const img = await loadFirst([''], names);
    if (!img) return;
    entitySkins.set(type, { canvas: toCanvas(img) });
    loaded++;
  });

  const crackJobs = [];
  for (let i = 0; i < 10; i++) {
    crackJobs.push((async () => {
      const img = await loadFirst(BLOCK_DIRS, [`destroy_stage_${i}`]);
      if (img) { crackStages[i] = frameCanvas(img); loaded++; }
    })());
  }

  await Promise.allSettled([...tileJobs, ...itemJobs, ...entityJobs, ...crackJobs]);
  clearIconCache();
  console.log(`[Texturen] Texture-Pack geladen: ${loaded} Texturen übernommen`);
  return loaded;
}
