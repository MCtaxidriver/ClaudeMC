// Item-Definitionen (Werkzeuge, Rüstung, Essen, Materialien) + Icons + Block-Drops
// Block-Items teilen sich den ID-Raum mit Blöcken (< 100), eigene Items ab 100.

import { B, BLOCK_INFO, ATLAS_COLS, TILE_PX } from './blocks.js';

export const I = {
  STICK: 100,
  W_PICK: 101, S_PICK: 102,
  W_AXE: 103, S_AXE: 104,
  W_SHOVEL: 105, S_SHOVEL: 106,
  W_SWORD: 107, S_SWORD: 108,
  APPLE: 110, FLESH: 111, BEEF: 112, MUTTON: 113,
  BONE: 114, GUNPOWDER: 115,
  COAL: 116, IRON_INGOT: 117, GOLD_INGOT: 118, DIAMOND: 119, EMERALD: 120,
  FLINT: 121, FLINT_STEEL: 122, BLAZE_ROD: 123, BLAZE_POWDER: 124,
  ENDER_PEARL: 125, ENDER_EYE: 126,
  LEATHER: 127, COOKED_BEEF: 128, COOKED_MUTTON: 129, GOLDEN_APPLE: 130,
  I_PICK: 131, I_AXE: 132, I_SHOVEL: 133, I_SWORD: 134,
  D_PICK: 135, D_AXE: 136, D_SHOVEL: 137, D_SWORD: 138,
  L_HELM: 140, L_CHEST: 141, L_LEGS: 142, L_BOOTS: 143,
  I_HELM: 144, I_CHEST: 145, I_LEGS: 146, I_BOOTS: 147,
  D_HELM: 148, D_CHEST: 149, D_LEGS: 150, D_BOOTS: 151,
  BUCKET: 152, WATER_BUCKET: 153, LAVA_BUCKET: 154,
  BOW: 155, ARROW: 156, STRING: 157, WHEAT: 158, BREAD: 159,
};

// Katalog für das Kreativ-Inventar (alle Nicht-Block-Items)
export const CREATIVE_ITEMS = Object.values(I);

// tool: {kind, speed, tier} -> speed = Abbau-Multiplikator, tier = Werkzeugstufe
// damage: Nahkampfschaden (Hand = 1)
// food: Hungerpunkte beim Essen; heal: sofortige Herzen (Goldapfel)
// armor: {slot: 0 Helm/1 Brust/2 Beine/3 Stiefel, points}
const ITEM_DEFS = {
  [I.STICK]: { name: 'Stock', stack: 64 },
  [I.W_PICK]: { name: 'Holzspitzhacke', stack: 1, tool: { kind: 'pickaxe', speed: 4, tier: 1 }, damage: 2, maxDur: 60 },
  [I.S_PICK]: { name: 'Steinspitzhacke', stack: 1, tool: { kind: 'pickaxe', speed: 7, tier: 2 }, damage: 3, maxDur: 132 },
  [I.I_PICK]: { name: 'Eisenspitzhacke', stack: 1, tool: { kind: 'pickaxe', speed: 10, tier: 3 }, damage: 4, maxDur: 251 },
  [I.D_PICK]: { name: 'Diamantspitzhacke', stack: 1, tool: { kind: 'pickaxe', speed: 14, tier: 4 }, damage: 5, maxDur: 1562 },
  [I.W_AXE]: { name: 'Holzaxt', stack: 1, tool: { kind: 'axe', speed: 4, tier: 1 }, damage: 3, maxDur: 60 },
  [I.S_AXE]: { name: 'Steinaxt', stack: 1, tool: { kind: 'axe', speed: 7, tier: 2 }, damage: 4, maxDur: 132 },
  [I.I_AXE]: { name: 'Eisenaxt', stack: 1, tool: { kind: 'axe', speed: 10, tier: 3 }, damage: 5, maxDur: 251 },
  [I.D_AXE]: { name: 'Diamantaxt', stack: 1, tool: { kind: 'axe', speed: 14, tier: 4 }, damage: 6, maxDur: 1562 },
  [I.W_SHOVEL]: { name: 'Holzschaufel', stack: 1, tool: { kind: 'shovel', speed: 4, tier: 1 }, damage: 2, maxDur: 60 },
  [I.S_SHOVEL]: { name: 'Steinschaufel', stack: 1, tool: { kind: 'shovel', speed: 7, tier: 2 }, damage: 2, maxDur: 132 },
  [I.I_SHOVEL]: { name: 'Eisenschaufel', stack: 1, tool: { kind: 'shovel', speed: 10, tier: 3 }, damage: 3, maxDur: 251 },
  [I.D_SHOVEL]: { name: 'Diamantschaufel', stack: 1, tool: { kind: 'shovel', speed: 14, tier: 4 }, damage: 4, maxDur: 1562 },
  [I.W_SWORD]: { name: 'Holzschwert', stack: 1, tool: { kind: 'sword', speed: 1.5, tier: 1 }, damage: 5, maxDur: 60 },
  [I.S_SWORD]: { name: 'Steinschwert', stack: 1, tool: { kind: 'sword', speed: 1.5, tier: 2 }, damage: 6, maxDur: 132 },
  [I.I_SWORD]: { name: 'Eisenschwert', stack: 1, tool: { kind: 'sword', speed: 1.5, tier: 3 }, damage: 7, maxDur: 251 },
  [I.D_SWORD]: { name: 'Diamantschwert', stack: 1, tool: { kind: 'sword', speed: 1.5, tier: 4 }, damage: 8, maxDur: 1562 },
  [I.APPLE]: { name: 'Apfel', stack: 64, food: 4 },
  [I.FLESH]: { name: 'Verrottetes Fleisch', stack: 64, food: 2 },
  [I.BEEF]: { name: 'Rohes Rindfleisch', stack: 64, food: 3 },
  [I.MUTTON]: { name: 'Rohes Hammelfleisch', stack: 64, food: 2 },
  [I.COOKED_BEEF]: { name: 'Steak', stack: 64, food: 8 },
  [I.COOKED_MUTTON]: { name: 'Gebratenes Hammelfleisch', stack: 64, food: 6 },
  [I.GOLDEN_APPLE]: { name: 'Goldener Apfel', stack: 64, food: 4, heal: 6 },
  [I.BONE]: { name: 'Knochen', stack: 64 },
  [I.GUNPOWDER]: { name: 'Schwarzpulver', stack: 64 },
  [I.COAL]: { name: 'Kohle', stack: 64 },
  [I.IRON_INGOT]: { name: 'Eisenbarren', stack: 64 },
  [I.GOLD_INGOT]: { name: 'Goldbarren', stack: 64 },
  [I.DIAMOND]: { name: 'Diamant', stack: 64 },
  [I.EMERALD]: { name: 'Smaragd', stack: 64 },
  [I.FLINT]: { name: 'Feuerstein', stack: 64 },
  [I.FLINT_STEEL]: { name: 'Feuerzeug', stack: 1 },
  [I.BLAZE_ROD]: { name: 'Lohenrute', stack: 64 },
  [I.BLAZE_POWDER]: { name: 'Lohenstaub', stack: 64 },
  [I.ENDER_PEARL]: { name: 'Enderperle', stack: 16 },
  [I.ENDER_EYE]: { name: 'Enderauge', stack: 16 },
  [I.LEATHER]: { name: 'Leder', stack: 64 },
  [I.L_HELM]: { name: 'Lederkappe', stack: 1, armor: { slot: 0, points: 1 }, maxDur: 80 },
  [I.L_CHEST]: { name: 'Lederjacke', stack: 1, armor: { slot: 1, points: 3 }, maxDur: 112 },
  [I.L_LEGS]: { name: 'Lederhose', stack: 1, armor: { slot: 2, points: 2 }, maxDur: 104 },
  [I.L_BOOTS]: { name: 'Lederstiefel', stack: 1, armor: { slot: 3, points: 1 }, maxDur: 88 },
  [I.I_HELM]: { name: 'Eisenhelm', stack: 1, armor: { slot: 0, points: 2 }, maxDur: 220 },
  [I.I_CHEST]: { name: 'Eisenharnisch', stack: 1, armor: { slot: 1, points: 6 }, maxDur: 320 },
  [I.I_LEGS]: { name: 'Eisenbeinschutz', stack: 1, armor: { slot: 2, points: 5 }, maxDur: 300 },
  [I.I_BOOTS]: { name: 'Eisenstiefel', stack: 1, armor: { slot: 3, points: 2 }, maxDur: 260 },
  [I.D_HELM]: { name: 'Diamanthelm', stack: 1, armor: { slot: 0, points: 3 }, maxDur: 528 },
  [I.D_CHEST]: { name: 'Diamantharnisch', stack: 1, armor: { slot: 1, points: 8 }, maxDur: 768 },
  [I.D_LEGS]: { name: 'Diamantbeinschutz', stack: 1, armor: { slot: 2, points: 6 }, maxDur: 720 },
  [I.D_BOOTS]: { name: 'Diamantstiefel', stack: 1, armor: { slot: 3, points: 3 }, maxDur: 624 },
  [I.BUCKET]: { name: 'Eimer', stack: 16 },
  [I.WATER_BUCKET]: { name: 'Wassereimer', stack: 1 },
  [I.LAVA_BUCKET]: { name: 'Lavaeimer', stack: 1 },
  [I.BOW]: { name: 'Bogen', stack: 1, maxDur: 384 },
  [I.ARROW]: { name: 'Pfeil', stack: 64 },
  [I.STRING]: { name: 'Faden', stack: 64 },
  [I.WHEAT]: { name: 'Weizen', stack: 64 },
  [I.BREAD]: { name: 'Brot', stack: 64, food: 5 },
};

export function maxDurOf(id) {
  const d = ITEM_DEFS[id];
  return d ? d.maxDur || 0 : 0;
}

export function itemInfo(id) {
  if (id < 100) {
    const b = BLOCK_INFO[id];
    return { name: b.name, stack: 64, block: id };
  }
  return ITEM_DEFS[id];
}

// Ofen: was wird zu was geschmolzen? (Eingabe-ID -> Ausgabe)
export const SMELT = {
  [B.IRON_ORE]: { id: I.IRON_INGOT, count: 1 },
  [B.GOLD_ORE]: { id: I.GOLD_INGOT, count: 1 },
  [B.DS_IRON]: { id: I.IRON_INGOT, count: 1 },
  [B.DS_GOLD]: { id: I.GOLD_INGOT, count: 1 },
  [B.COBBLE]: { id: B.STONE, count: 1 },
  [B.SAND]: { id: B.GLASS, count: 1 },
  [B.LOG]: { id: I.COAL, count: 1 }, // Holzkohle
  [B.BIRCH_LOG]: { id: I.COAL, count: 1 },
  [B.DARK_LOG]: { id: I.COAL, count: 1 },
  [B.ACACIA_LOG]: { id: I.COAL, count: 1 },
  [I.BEEF]: { id: I.COOKED_BEEF, count: 1 },
  [I.MUTTON]: { id: I.COOKED_MUTTON, count: 1 },
};

// Brennstoffe: Brenndauer in Sekunden (1 Schmelzvorgang = 10 s)
export const FUEL = {
  [I.COAL]: 80,
  [I.BLAZE_ROD]: 120,
  [I.LAVA_BUCKET]: 1000,
  [B.LOG]: 15,
  [B.BIRCH_LOG]: 15,
  [B.DARK_LOG]: 15,
  [B.ACACIA_LOG]: 15,
  [B.PLANKS]: 15,
  [I.STICK]: 5,
  [B.CRAFTING_TABLE]: 15,
  [B.DEAD_BUSH]: 5,
};

// Was droppt ein Block beim Abbauen?
export function dropsForBlock(blockId, rand = Math.random) {
  switch (blockId) {
    case B.LEAVES:
      if (rand() < 0.1) return [{ id: I.APPLE, count: 1 }];
      if (rand() < 0.15) return [{ id: I.STICK, count: 1 }];
      return [];
    case B.BIRCH_LEAVES:
    case B.DARK_LEAVES:
    case B.ACACIA_LEAVES:
      return rand() < 0.15 ? [{ id: I.STICK, count: 1 }] : [];
    case B.GRAVEL:
      return rand() < 0.25 ? [{ id: I.FLINT, count: 1 }] : [{ id: B.GRAVEL, count: 1 }];
    case B.COAL_ORE: case B.DS_COAL: return [{ id: I.COAL, count: 1 }];
    case B.DIAMOND_ORE: case B.DS_DIAMOND: return [{ id: I.DIAMOND, count: 1 }];
    case B.EMERALD_ORE: case B.DS_EMERALD: return [{ id: I.EMERALD, count: 1 }];
    case B.WEB: return [{ id: I.STRING, count: 1 }];
    case B.DEAD_BUSH: return rand() < 0.6 ? [{ id: I.STICK, count: 1 }] : [];
  }
  const d = BLOCK_INFO[blockId].drop;
  if (d === null || d === undefined) return [];
  if (d === 'self') return [{ id: blockId, count: 1 }];
  return [{ id: d, count: 1 }];
}

// --- Pixel-Icons (8x8, hochskaliert) für Nicht-Block-Items ---
// Werkzeug-Formen, mit Material-Palette eingefärbt (h = Stiel)
const TOOL_ROWS = {
  pick: ['.kkkkkk.', 'kd....dk', 'k..hh..k', '...hh...', '...hh...', '...hh...', '...hh...', '...hh...'],
  axe: ['.kkd....', 'kkkd....', 'kkhh....', '.dhh....', '...hh...', '...hh...', '....hh..', '....hh..'],
  shovel: ['...kk...', '..kkkk..', '..kkkk..', '...hh...', '...hh...', '...hh...', '...hh...', '...hh...'],
  sword: ['......kk', '.....kkd', '....kkd.', '...kkd..', 'g.kkd...', '.gkd....', '.hg.....', 'h..g....'],
};
const ARMOR_ROWS = {
  0: ['........', '..kkkk..', '.kkkkkk.', '.kdkkdk.', '.kk..kk.', '.kk..kk.', '........', '........'],
  1: ['.k....k.', '.kk..kk.', '.kkkkkk.', '.kkddkk.', '..kkkk..', '..kkkk..', '..kkkk..', '........'],
  2: ['.kkkkkk.', '.kdkkdk.', '.kk..kk.', '.kk..kk.', '.kk..kk.', '.kk..kk.', '.kk..kk.', '........'],
  3: ['........', '........', '.kk..kk.', '.kk..kk.', '.kk..kk.', '.kkk.kkk', '.dkk.dkk', '........'],
};
const MATERIALS = {
  wood: { k: '#a97e42', d: '#c49a58', h: '#8a6432', g: '#8a6432' },
  stone: { k: '#8b8b8b', d: '#a5a5a5', h: '#8a6432', g: '#6e4f26' },
  iron: { k: '#d8d8d8', d: '#f5f5f5', h: '#8a6432', g: '#9a9a9a' },
  diamond: { k: '#4aedd9', d: '#8ff7ea', h: '#8a6432', g: '#2fae9e' },
  leather: { k: '#9a6238', d: '#7a4a28', h: '#7a4a28', g: '#7a4a28' },
};
const toolArt = (shape, mat) => ({ p: { ...MATERIALS[mat] }, rows: TOOL_ROWS[shape] });
const armorArt = (slot, mat) => ({ p: { ...MATERIALS[mat] }, rows: ARMOR_ROWS[slot] });

const PIX = {
  [I.STICK]: {
    p: { a: '#8a6432', b: '#6e4f26' },
    rows: ['.......a', '......ab', '.....ab.', '....ab..', '...ab...', '..ab....', '.ab.....', 'ab......'],
  },
  [I.W_PICK]: toolArt('pick', 'wood'), [I.S_PICK]: toolArt('pick', 'stone'),
  [I.I_PICK]: toolArt('pick', 'iron'), [I.D_PICK]: toolArt('pick', 'diamond'),
  [I.W_AXE]: toolArt('axe', 'wood'), [I.S_AXE]: toolArt('axe', 'stone'),
  [I.I_AXE]: toolArt('axe', 'iron'), [I.D_AXE]: toolArt('axe', 'diamond'),
  [I.W_SHOVEL]: toolArt('shovel', 'wood'), [I.S_SHOVEL]: toolArt('shovel', 'stone'),
  [I.I_SHOVEL]: toolArt('shovel', 'iron'), [I.D_SHOVEL]: toolArt('shovel', 'diamond'),
  [I.W_SWORD]: toolArt('sword', 'wood'), [I.S_SWORD]: toolArt('sword', 'stone'),
  [I.I_SWORD]: toolArt('sword', 'iron'), [I.D_SWORD]: toolArt('sword', 'diamond'),
  [I.L_HELM]: armorArt(0, 'leather'), [I.L_CHEST]: armorArt(1, 'leather'),
  [I.L_LEGS]: armorArt(2, 'leather'), [I.L_BOOTS]: armorArt(3, 'leather'),
  [I.I_HELM]: armorArt(0, 'iron'), [I.I_CHEST]: armorArt(1, 'iron'),
  [I.I_LEGS]: armorArt(2, 'iron'), [I.I_BOOTS]: armorArt(3, 'iron'),
  [I.D_HELM]: armorArt(0, 'diamond'), [I.D_CHEST]: armorArt(1, 'diamond'),
  [I.D_LEGS]: armorArt(2, 'diamond'), [I.D_BOOTS]: armorArt(3, 'diamond'),
  [I.APPLE]: {
    p: { r: '#d43a2a', d: '#a82418', s: '#5c4630', l: '#4a9038' },
    rows: ['....s...', '...sl...', '..rrrr..', '.rrrrdr.', '.rrrrdd.', '.rrrddd.', '..rddd..', '........'],
  },
  [I.GOLDEN_APPLE]: {
    p: { r: '#f5d93a', d: '#d8a418', s: '#8a6432', l: '#c8e858' },
    rows: ['....s...', '...sl...', '..rrrr..', '.rrrrdr.', '.rrrrdd.', '.rrrddd.', '..rddd..', '........'],
  },
  [I.FLESH]: {
    p: { f: '#b56a5a', d: '#8a4a3c', g: '#6f8f4a' },
    rows: ['........', '.ffdf...', 'fdfffg..', 'ffdffff.', '.fffdff.', '..gffdf.', '...fff..', '........'],
  },
  [I.BEEF]: {
    p: { f: '#8a3c28', d: '#6b2a1a', w: '#d8b090' },
    rows: ['........', '..ffff..', '.ffdfff.', '.fwffdf.', '.ffdfwf.', '.fffffd.', '..ffff..', '........'],
  },
  [I.COOKED_BEEF]: {
    p: { f: '#6e4226', d: '#54301a', w: '#a87c50' },
    rows: ['........', '..ffff..', '.ffdfff.', '.fwffdf.', '.ffdfwf.', '.fffffd.', '..ffff..', '........'],
  },
  [I.MUTTON]: {
    p: { f: '#b5573c', d: '#8a3a26', w: '#e0c0a0' },
    rows: ['........', '..ffff..', '.ffdfff.', '.fwffff.', '.ffdfwf.', '.ffffdf.', '..ffff..', '........'],
  },
  [I.COOKED_MUTTON]: {
    p: { f: '#7a4a2e', d: '#5c341e', w: '#b08858' },
    rows: ['........', '..ffff..', '.ffdfff.', '.fwffff.', '.ffdfwf.', '.ffffdf.', '..ffff..', '........'],
  },
  [I.BONE]: {
    p: { w: '#f0ede0', d: '#c8c4b0' },
    rows: ['ww......', 'www.....', '.wwd....', '..dwd...', '...dwd..', '....dww.', '.....www', '......ww'],
  },
  [I.GUNPOWDER]: {
    p: { g: '#4a4a4a', d: '#2e2e2e', l: '#6e6e6e' },
    rows: ['........', '...g....', '..ggl...', '.gdggg..', 'ggggdgg.', 'gdglggg.', '.gggggd.', '........'],
  },
  [I.COAL]: {
    p: { g: '#1e1e1e', d: '#0e0e0e', l: '#3c3c3c' },
    rows: ['........', '..ggl...', '.ggggg..', '.gdgggl.', 'ggggdgg.', '.glgggg.', '..gggd..', '........'],
  },
  [I.IRON_INGOT]: {
    p: { k: '#d8d8d8', d: '#a5a5a5', l: '#f5f5f5' },
    rows: ['........', '........', '..lllk..', '.lkkkkd.', 'lkkkkkd.', 'kkkkkdd.', 'ddddddd.', '........'],
  },
  [I.GOLD_INGOT]: {
    p: { k: '#f5d93a', d: '#c8a418', l: '#fcea8e' },
    rows: ['........', '........', '..lllk..', '.lkkkkd.', 'lkkkkkd.', 'kkkkkdd.', 'ddddddd.', '........'],
  },
  [I.DIAMOND]: {
    p: { k: '#4aedd9', d: '#2fae9e', l: '#b8fbf2' },
    rows: ['........', '..lkkd..', '.lkkkkd.', '.kkkkkd.', '..kkkd..', '...kd...', '........', '........'],
  },
  [I.EMERALD]: {
    p: { k: '#2bd648', d: '#17a834', l: '#8ef5a0' },
    rows: ['........', '...lk...', '..lkkd..', '.lkkkkd.', '..kkkd..', '...kd...', '........', '........'],
  },
  [I.FLINT]: {
    p: { k: '#3a3a42', d: '#22222a', l: '#5a5a66' },
    rows: ['........', '...lk...', '..lkkk..', '.lkkkkd.', '.kkkkdd.', '..kkdd..', '...dd...', '........'],
  },
  [I.FLINT_STEEL]: {
    p: { k: '#b8b8c0', d: '#8a8a94', f: '#3a3a42' },
    rows: ['..kk....', '.k..k...', '.k......', '.k..k...', '..kk....', '.....ff.', '....fff.', '....ff..'],
  },
  [I.BLAZE_ROD]: {
    p: { k: '#f5c542', d: '#e8940f', l: '#fcefa0' },
    rows: ['......lk', '.....lkd', '....lkd.', '...lkd..', '..lkd...', '.lkd....', 'lkd.....', 'kd......'],
  },
  [I.BLAZE_POWDER]: {
    p: { k: '#f5a021', d: '#d87408', l: '#fcd268' },
    rows: ['........', '...k.l..', '..lkkk..', '.kkdkkl.', 'kkkkdkk.', '.dkklkk.', '..kkkd..', '........'],
  },
  [I.ENDER_PEARL]: {
    p: { k: '#1a8a7c', d: '#0e5c52', l: '#4ac8b8' },
    rows: ['........', '..kkkk..', '.klkkkd.', '.kklkkd.', '.kkkkkd.', '.kkkkdd.', '..kddd..', '........'],
  },
  [I.ENDER_EYE]: {
    p: { k: '#1a8a7c', d: '#0e5c52', l: '#8ef5a0', e: '#0a1a12' },
    rows: ['........', '..kkkk..', '.kkllkd.', '.klleld.', '.kllled.', '.kkllkd.', '..kddd..', '........'],
  },
  [I.LEATHER]: {
    p: { k: '#9a6238', d: '#7a4a28', l: '#b87c4a' },
    rows: ['........', '.kkkkk..', '.klkkkd.', '.kkkkdk.', '.klkkkd.', '.kkkdkk.', '.ddddd..', '........'],
  },
  [I.BUCKET]: {
    p: { k: '#b8b8c0', d: '#8a8a94', f: '#6a6a74' },
    rows: ['.k....k.', '.dk..kd.', '..kkkk..', '.k....k.', '.k....k.', '.d....d.', '.dk..kd.', '..dddd..'],
  },
  [I.WATER_BUCKET]: {
    p: { k: '#b8b8c0', d: '#8a8a94', w: '#3f76e4' },
    rows: ['.k....k.', '.dk..kd.', '..kkkk..', '.kwwwwk.', '.kwwwwk.', '.dwwwwd.', '.dk..kd.', '..dddd..'],
  },
  [I.LAVA_BUCKET]: {
    p: { k: '#b8b8c0', d: '#8a8a94', w: '#e06010' },
    rows: ['.k....k.', '.dk..kd.', '..kkkk..', '.kwwwwk.', '.kwwwwk.', '.dwwwwd.', '.dk..kd.', '..dddd..'],
  },
  [I.BOW]: {
    p: { k: '#8a6432', d: '#6e4f26', s: '#e8e8e8' },
    rows: ['..kkk..s', '.k...k.s', 'k.....ks', 'k......s', 'k......s', 'k.....ks', '.k...k.s', '..kkk..s'],
  },
  [I.ARROW]: {
    p: { k: '#8a6432', s: '#c8c8d0', f: '#e8e8e8' },
    rows: ['......ss', '.....sss', '....ks..', '...kk...', '..kk....', '.kk.....', 'fk......', 'ff......'],
  },
  [I.STRING]: {
    p: { s: '#e8e8e8', d: '#c8c8c8' },
    rows: ['s.......', '.s......', '.s......', '..sd....', '...s....', '...s....', '..sd....', '.s......'],
  },
  [I.WHEAT]: {
    p: { k: '#c8a634', d: '#a8861f', g: '#8a9a4a' },
    rows: ['.k.k.k..', '.kdkdk..', '.k.k.k..', '.kdkdk..', '.g.g.g..', '..ggg...', '...g....', '...g....'],
  },
  [I.BREAD]: {
    p: { k: '#b8823c', d: '#96682c', l: '#d8a860' },
    rows: ['........', '..lll...', '.lkkkl..', 'lkkdkkl.', '.kkkdkk.', '..dkkkd.', '...ddd..', '........'],
  },
};

// Pack-Icons (aus offiziellem Texture-Pack geladen), überschreiben die Pixel-Art
const packImages = new Map();
export function setItemImage(id, imgOrCanvas) {
  packImages.set(id, imgOrCanvas);
  iconCache.delete(id);
}

const iconCache = new Map();

// 32x32-Icon-Canvas für beliebige Item-IDs (Block-Items aus dem Atlas)
export function itemIcon(id, atlasCanvas) {
  const key = id;
  if (iconCache.has(key)) return iconCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const pack = packImages.get(id);
  if (pack) {
    g.drawImage(pack, 0, 0, 32, 32);
  } else if (id < 100) {
    const tiles = BLOCK_INFO[id].tiles;
    const tile = tiles ? tiles.side : 0;
    g.drawImage(atlasCanvas,
      (tile % ATLAS_COLS) * TILE_PX, ((tile / ATLAS_COLS) | 0) * TILE_PX, TILE_PX, TILE_PX,
      0, 0, 32, 32);
  } else {
    const art = PIX[id];
    if (art) {
      for (let y = 0; y < 8; y++) {
        const row = art.rows[y];
        for (let x = 0; x < 8; x++) {
          const ch = row[x];
          if (ch === '.') continue;
          g.fillStyle = art.p[ch];
          g.fillRect(x * 4, y * 4, 4, 4);
        }
      }
    }
  }
  iconCache.set(key, c);
  return c;
}

// Cache leeren (nach dem Laden eines Texture-Packs, damit Block-Icons neu gezeichnet werden)
export function clearIconCache() {
  iconCache.clear();
}
