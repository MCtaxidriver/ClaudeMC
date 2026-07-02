// Inventar (9 Hotbar + 27 Haupt + 4 Rüstung), geformtes Crafting mit Rezeptbuch,
// Ofen-UI, Truhen-UI, Villager-Handel, Kreativ-Katalog, Haltbarkeitsbalken.

import { B, CREATIVE_BLOCKS } from './blocks.js';
import { I, itemInfo, itemIcon, FUEL, SMELT, maxDurOf } from './items.js';

// --- Rezepte ---
// Geformt: shape = Zeilen ('.' = leer), key = Zeichen -> Item-ID. Position im Grid
// zählt (wie in Minecraft), verschoben/gespiegelt erlaubt. Shapeless: ingredients-Liste.
export const RECIPES = [
  { ingredients: [B.LOG], out: { id: B.PLANKS, count: 4 } },
  { ingredients: [B.BIRCH_LOG], out: { id: B.PLANKS, count: 4 } },
  { ingredients: [B.DARK_LOG], out: { id: B.PLANKS, count: 4 } },
  { ingredients: [B.ACACIA_LOG], out: { id: B.PLANKS, count: 4 } },
  { shape: ['P', 'P'], key: { P: B.PLANKS }, out: { id: I.STICK, count: 4 } },
  { shape: ['PP', 'PP'], key: { P: B.PLANKS }, out: { id: B.CRAFTING_TABLE, count: 1 } },
  { shape: ['CCC', 'C.C', 'CCC'], key: { C: B.COBBLE }, out: { id: B.FURNACE, count: 1 } },
  { shape: ['PPP', 'P.P', 'PPP'], key: { P: B.PLANKS }, out: { id: B.CHEST, count: 1 } },
  { shape: ['SS', 'SS'], key: { S: B.STONE }, out: { id: B.STONE_BRICKS, count: 4 } },
  { shape: ['C', 'S'], key: { C: I.COAL, S: I.STICK }, out: { id: B.TORCH, count: 4 } },
  { shape: ['SS'], key: { S: B.STONE }, out: { id: B.PRESSURE_PLATE, count: 1 } },
  { shape: ['FF', 'FF'], key: { F: I.STRING }, out: { id: B.WOOL, count: 1 } },

  // Werkzeuge: M = Material, S = Stock
  ...[[B.PLANKS, I.W_PICK, I.W_AXE, I.W_SHOVEL, I.W_SWORD],
      [B.COBBLE, I.S_PICK, I.S_AXE, I.S_SHOVEL, I.S_SWORD],
      [I.IRON_INGOT, I.I_PICK, I.I_AXE, I.I_SHOVEL, I.I_SWORD],
      [I.DIAMOND, I.D_PICK, I.D_AXE, I.D_SHOVEL, I.D_SWORD]]
    .flatMap(([mat, pick, axe, shovel, sword]) => [
      { shape: ['MMM', '.S.', '.S.'], key: { M: mat, S: I.STICK }, out: { id: pick, count: 1 } },
      { shape: ['MM', 'MS', '.S'], key: { M: mat, S: I.STICK }, out: { id: axe, count: 1 } },
      { shape: ['M', 'S', 'S'], key: { M: mat, S: I.STICK }, out: { id: shovel, count: 1 } },
      { shape: ['M', 'M', 'S'], key: { M: mat, S: I.STICK }, out: { id: sword, count: 1 } },
    ]),

  // Rüstung
  ...[[I.LEATHER, I.L_HELM, I.L_CHEST, I.L_LEGS, I.L_BOOTS],
      [I.IRON_INGOT, I.I_HELM, I.I_CHEST, I.I_LEGS, I.I_BOOTS],
      [I.DIAMOND, I.D_HELM, I.D_CHEST, I.D_LEGS, I.D_BOOTS]]
    .flatMap(([mat, helm, chest, legs, boots]) => [
      { shape: ['MMM', 'M.M'], key: { M: mat }, out: { id: helm, count: 1 } },
      { shape: ['M.M', 'MMM', 'MMM'], key: { M: mat }, out: { id: chest, count: 1 } },
      { shape: ['MMM', 'M.M', 'M.M'], key: { M: mat }, out: { id: legs, count: 1 } },
      { shape: ['M.M', 'M.M'], key: { M: mat }, out: { id: boots, count: 1 } },
    ]),

  // Kampf & Werkzeuge
  { shape: ['.SF', 'S.F', '.SF'], key: { S: I.STICK, F: I.STRING }, out: { id: I.BOW, count: 1 } },
  { shape: ['F', 'S'], key: { F: I.FLINT, S: I.STICK }, out: { id: I.ARROW, count: 4 } },
  { ingredients: [I.IRON_INGOT, I.FLINT], out: { id: I.FLINT_STEEL, count: 1 } },
  { shape: ['I.I', '.I.'], key: { I: I.IRON_INGOT }, out: { id: I.BUCKET, count: 1 } },
  { shape: ['I.I', 'ISI', 'I.I'], key: { I: I.IRON_INGOT, S: I.STICK }, out: { id: B.RAIL, count: 16 } },
  { shape: ['GSG', 'SGS', 'GSG'], key: { G: I.GUNPOWDER, S: B.SAND }, out: { id: B.TNT, count: 1 } },

  // Einrichtung & Essen
  { shape: ['WWW', 'PPP'], key: { W: B.WOOL, P: B.PLANKS }, out: { id: B.BED_FOOT, count: 1 } },
  { shape: ['PP', 'PP', 'PP'], key: { P: B.PLANKS }, out: { id: B.DOOR_L, count: 3 } },
  { shape: ['WWW'], key: { W: I.WHEAT }, out: { id: I.BREAD, count: 1 } },
  { shape: ['WWW', 'WWW', 'WWW'], key: { W: I.WHEAT }, out: { id: B.HAY, count: 1 } },
  { ingredients: [B.HAY], out: { id: I.WHEAT, count: 9 } },
  { ingredients: [I.BLAZE_ROD], out: { id: I.BLAZE_POWDER, count: 2 } },
  { ingredients: [I.BLAZE_POWDER, I.ENDER_PEARL], out: { id: I.ENDER_EYE, count: 1 } },
  { shape: ['GGG', 'GAG', 'GGG'], key: { G: I.GOLD_INGOT, A: I.APPLE }, out: { id: I.GOLDEN_APPLE, count: 1 } },
];

function gridCells(gridSlots, width) {
  const cells = [];
  let minR = 9, maxR = -1, minC = 9, maxC = -1, used = 0;
  for (let r = 0; r < width; r++) {
    for (let c = 0; c < width; c++) {
      const s = gridSlots[r * width + c];
      cells.push(s ? s.id : 0);
      if (s) {
        used++;
        if (r < minR) minR = r; if (r > maxR) maxR = r;
        if (c < minC) minC = c; if (c > maxC) maxC = c;
      }
    }
  }
  return { cells, width, minR, maxR, minC, maxC, used };
}

function matchesShape(g, rows, key) {
  const h = rows.length, w = rows[0].length;
  if (g.maxR - g.minR + 1 !== h || g.maxC - g.minC + 1 !== w) return false;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = rows[r][c];
      const want = ch === '.' ? 0 : key[ch];
      if (g.cells[(g.minR + r) * g.width + (g.minC + c)] !== want) return false;
    }
  }
  return true;
}

export function matchRecipe(gridSlots, width) {
  const g = gridCells(gridSlots, width);
  if (g.used === 0) return null;

  const ids = [];
  for (const c of g.cells) if (c) ids.push(c);
  ids.sort((a, b) => a - b);

  for (const r of RECIPES) {
    if (r.ingredients) {
      if (r.ingredients.length !== ids.length) continue;
      const want = [...r.ingredients].sort((a, b) => a - b);
      if (want.every((id, i) => id === ids[i])) return r;
    } else {
      if (matchesShape(g, r.shape, r.key)) return r;
      const mirrored = r.shape.map(row => [...row].reverse().join(''));
      if (matchesShape(g, mirrored, r.key)) return r;
    }
  }
  return null;
}

// Zutatenliste eines Rezepts: [{id, count}]
export function recipeNeeds(r) {
  const needs = new Map();
  if (r.ingredients) {
    for (const id of r.ingredients) needs.set(id, (needs.get(id) || 0) + 1);
  } else {
    for (const row of r.shape) {
      for (const ch of row) {
        if (ch === '.') continue;
        const id = r.key[ch];
        needs.set(id, (needs.get(id) || 0) + 1);
      }
    }
  }
  return [...needs.entries()].map(([id, count]) => ({ id, count }));
}

// Passt das Rezept überhaupt ins Grid (2x2 vs 3x3)?
export function recipeFits(r, width) {
  if (r.ingredients) return r.ingredients.length <= width * width;
  return r.shape.length <= width && r.shape[0].length <= width;
}

// --- Villager-Handel ---
export const TRADES = [
  { give: [{ id: I.FLESH, count: 5 }], get: { id: I.EMERALD, count: 1 } },
  { give: [{ id: I.BEEF, count: 3 }], get: { id: I.EMERALD, count: 1 } },
  { give: [{ id: I.COAL, count: 4 }], get: { id: I.EMERALD, count: 1 } },
  { give: [{ id: I.WHEAT, count: 8 }], get: { id: I.EMERALD, count: 1 } },
  { give: [{ id: B.WOOL, count: 6 }], get: { id: I.EMERALD, count: 1 } },
  { give: [{ id: I.EMERALD, count: 1 }], get: { id: I.APPLE, count: 4 } },
  { give: [{ id: I.EMERALD, count: 1 }], get: { id: I.BREAD, count: 3 } },
  { give: [{ id: I.EMERALD, count: 1 }], get: { id: I.COOKED_BEEF, count: 2 } },
  { give: [{ id: I.EMERALD, count: 2 }], get: { id: I.ARROW, count: 8 } },
  { give: [{ id: I.EMERALD, count: 3 }], get: { id: I.I_PICK, count: 1 } },
  { give: [{ id: I.EMERALD, count: 4 }], get: { id: I.ENDER_PEARL, count: 2 } },
  { give: [{ id: I.EMERALD, count: 8 }], get: { id: I.DIAMOND, count: 1 } },
];

export class Inventory {
  constructor() {
    this.slots = new Array(36).fill(null); // 0-8 Hotbar, 9-35 Hauptinventar
    this.armor = new Array(4).fill(null);
  }

  add(id, count, dur = undefined) {
    const max = itemInfo(id).stack;
    if (max > 1 && dur === undefined) {
      for (let i = 0; i < 36 && count > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.dur === undefined && s.count < max) {
          const move = Math.min(count, max - s.count);
          s.count += move;
          count -= move;
        }
      }
    }
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!this.slots[i]) {
        const move = Math.min(count, max);
        this.slots[i] = { id, count: move };
        if (dur !== undefined) this.slots[i].dur = dur;
        count -= move;
      }
    }
    return count;
  }

  removeFromSlot(i, n = 1) {
    const s = this.slots[i];
    if (!s) return;
    s.count -= n;
    if (s.count <= 0) this.slots[i] = null;
  }

  removeById(id, n) {
    for (let i = 35; i >= 0 && n > 0; i--) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(n, s.count);
      s.count -= take;
      n -= take;
      if (s.count <= 0) this.slots[i] = null;
    }
    return n;
  }

  countOf(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  armorPoints() {
    let n = 0;
    for (const s of this.armor) {
      if (!s) continue;
      const a = itemInfo(s.id).armor;
      if (a) n += a.points;
    }
    return n;
  }

  // Rüstung nimmt Schaden; kaputte Teile verschwinden
  damageArmor(amount = 1) {
    for (let i = 0; i < 4; i++) {
      const s = this.armor[i];
      if (!s) continue;
      const max = maxDurOf(s.id);
      if (!max) continue;
      if (s.dur === undefined) s.dur = max;
      s.dur -= amount;
      if (s.dur <= 0) this.armor[i] = null;
    }
  }

  drainAll() {
    const out = [];
    for (let i = 0; i < 36; i++) {
      if (this.slots[i]) { out.push(this.slots[i]); this.slots[i] = null; }
    }
    for (let i = 0; i < 4; i++) {
      if (this.armor[i]) { out.push(this.armor[i]); this.armor[i] = null; }
    }
    return out;
  }

  clear() {
    this.slots.fill(null);
    this.armor.fill(null);
  }

  serialize() {
    const pack = s => (s ? (s.dur !== undefined ? [s.id, s.count, s.dur] : [s.id, s.count]) : null);
    return { s: this.slots.map(pack), a: this.armor.map(pack) };
  }

  load(data) {
    this.slots = new Array(36).fill(null);
    this.armor = new Array(4).fill(null);
    if (!data) return;
    const unpack = v => {
      if (!v) return null;
      const s = { id: v[0], count: v[1] };
      if (v.length > 2) s.dur = v[2];
      return s;
    };
    const arr = Array.isArray(data) ? data : data.s;
    if (arr) arr.forEach((v, i) => { if (v && i < 36) this.slots[i] = unpack(v); });
    if (!Array.isArray(data) && data.a) {
      data.a.forEach((v, i) => { if (v && i < 4) this.armor[i] = unpack(v); });
    }
  }
}

// --- UI (Inventar / Werkbank / Ofen / Truhe / Handel / Kreativ) ---
const ARMOR_LABELS = ['Helm', 'Brust', 'Beine', 'Füsse'];

export class InventoryUI {
  constructor(inventory, atlasCanvas, hooks) {
    this.inv = inventory;
    this.atlas = atlasCanvas;
    this.hooks = hooks;          // { onChange(), onLeftover(id,count), onTrade(), creativeItems() }
    this.cursor = null;
    this.craftSlots = new Array(9).fill(null);
    this.mode = 'inv';           // inv | table | furnace | chest | trade | creative
    this.furnace = null;
    this.chest = null;           // { slots: Array(27) }
    this.showBook = false;
    this.openFlag = false;

    this.root = document.getElementById('inv-screen');
    this.cursorEl = document.getElementById('cursor-item');
    document.addEventListener('mousemove', e => {
      if (!this.openFlag) return;
      this.cursorEl.style.left = e.clientX + 8 + 'px';
      this.cursorEl.style.top = e.clientY + 8 + 'px';
    });
  }

  gridWidth() { return this.mode === 'table' ? 3 : 2; }
  gridSize() { const w = this.gridWidth(); return w * w; }

  open(mode, ctx = null) {
    this.mode = mode;
    if (mode === 'furnace') this.furnace = ctx;
    if (mode === 'chest') this.chest = ctx;
    this.openFlag = true;
    this.root.classList.remove('hidden');
    this.render();
  }

  close() {
    if (!this.openFlag) return;
    this.openFlag = false;
    this.root.classList.add('hidden');
    this.cursorEl.classList.add('hidden');
    const giveBack = (stack) => {
      if (!stack) return;
      if (this.mode === 'creative') return; // Kreativ: Cursor-Items verwerfen
      const rest = this.inv.add(stack.id, stack.count, stack.dur);
      if (rest > 0 && this.hooks.onLeftover) this.hooks.onLeftover(stack.id, rest);
    };
    giveBack(this.cursor);
    this.cursor = null;
    for (let i = 0; i < 9; i++) { giveBack(this.craftSlots[i]); this.craftSlots[i] = null; }
    this.furnace = null;
    this.chest = null;
    if (this.hooks.onChange) this.hooks.onChange();
  }

  slotEl(stack, cb, extraClass = '') {
    const el = document.createElement('div');
    el.className = 'islot ' + extraClass;
    if (stack) {
      const icon = itemIcon(stack.id, this.atlas);
      const img = icon.cloneNode();
      img.getContext('2d').drawImage(icon, 0, 0);
      el.appendChild(img);
      if (stack.count > 1) {
        const c = document.createElement('span');
        c.className = 'cnt';
        c.textContent = stack.count;
        el.appendChild(c);
      }
      // Haltbarkeitsbalken
      const max = maxDurOf(stack.id);
      if (max && stack.dur !== undefined && stack.dur < max) {
        const bar = document.createElement('div');
        bar.className = 'dur';
        const f = Math.max(0, stack.dur / max);
        bar.style.width = (f * 80) + '%';
        bar.style.background = f > 0.5 ? '#5ad838' : f > 0.25 ? '#e8c838' : '#e84838';
        el.appendChild(bar);
      }
      el.title = itemInfo(stack.id).name;
    }
    if (cb) {
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        cb(e.button);
      });
    }
    return el;
  }

  clickSlot(list, idx, button, validate = null) {
    const s = list[idx];
    if (this.cursor && validate && !validate(this.cursor)) { this.render(); return; }
    if (button === 0) {
      if (!this.cursor) {
        if (s) { this.cursor = s; list[idx] = null; }
      } else if (!s) {
        list[idx] = this.cursor;
        this.cursor = null;
      } else if (s.id === this.cursor.id && s.dur === undefined && this.cursor.dur === undefined) {
        const max = itemInfo(s.id).stack;
        const move = Math.min(this.cursor.count, max - s.count);
        s.count += move;
        this.cursor.count -= move;
        if (this.cursor.count <= 0) this.cursor = null;
      } else {
        list[idx] = this.cursor;
        this.cursor = s;
      }
    } else if (button === 2) {
      if (!this.cursor) {
        if (s) {
          const half = Math.ceil(s.count / 2);
          this.cursor = { id: s.id, count: half };
          if (s.dur !== undefined) this.cursor.dur = s.dur;
          s.count -= half;
          if (s.count <= 0) list[idx] = null;
        }
      } else {
        const max = itemInfo(this.cursor.id).stack;
        if (!s) {
          list[idx] = { id: this.cursor.id, count: 1 };
          if (this.cursor.dur !== undefined) list[idx].dur = this.cursor.dur;
          this.cursor.count--;
        } else if (s.id === this.cursor.id && s.count < max && s.dur === undefined) {
          s.count++;
          this.cursor.count--;
        }
        if (this.cursor.count <= 0) this.cursor = null;
      }
    }
    this.render();
    if (this.hooks.onChange) this.hooks.onChange();
  }

  takeResult() {
    const w = this.gridWidth();
    const r = matchRecipe(this.craftSlots.slice(0, w * w), w);
    if (!r) return;
    const max = itemInfo(r.out.id).stack;
    if (this.cursor) {
      if (this.cursor.id !== r.out.id || this.cursor.count + r.out.count > max) return;
      this.cursor.count += r.out.count;
    } else {
      this.cursor = { id: r.out.id, count: r.out.count };
    }
    for (let i = 0; i < this.gridSize(); i++) {
      const s = this.craftSlots[i];
      if (s) {
        s.count--;
        if (s.count <= 0) this.craftSlots[i] = null;
      }
    }
    this.render();
    if (this.hooks.onChange) this.hooks.onChange();
  }

  // Rezeptbuch: Grid leeren und Rezept aus dem Inventar einfüllen
  fillRecipe(r) {
    const w = this.gridWidth();
    // Grid zurücklegen
    for (let i = 0; i < 9; i++) {
      const s = this.craftSlots[i];
      if (s) { this.inv.add(s.id, s.count, s.dur); this.craftSlots[i] = null; }
    }
    // Material prüfen
    for (const n of recipeNeeds(r)) {
      if (this.inv.countOf(n.id) < n.count) { this.render(); return false; }
    }
    if (r.ingredients) {
      let i = 0;
      for (const id of r.ingredients) {
        this.inv.removeById(id, 1);
        this.craftSlots[i++] = { id, count: 1 };
      }
    } else {
      for (let row = 0; row < r.shape.length; row++) {
        for (let col = 0; col < r.shape[row].length; col++) {
          const ch = r.shape[row][col];
          if (ch === '.') continue;
          const id = r.key[ch];
          this.inv.removeById(id, 1);
          this.craftSlots[row * w + col] = { id, count: 1 };
        }
      }
    }
    this.render();
    if (this.hooks.onChange) this.hooks.onChange();
    return true;
  }

  takeFurnaceOut() {
    const f = this.furnace;
    if (!f || !f.out) return;
    if (!this.cursor) {
      this.cursor = f.out;
      f.out = null;
    } else if (this.cursor.id === f.out.id) {
      const max = itemInfo(f.out.id).stack;
      const move = Math.min(f.out.count, max - this.cursor.count);
      this.cursor.count += move;
      f.out.count -= move;
      if (f.out.count <= 0) f.out = null;
    }
    this.render();
    if (this.hooks.onChange) this.hooks.onChange();
  }

  refresh() {
    if (this.openFlag && this.mode === 'furnace') this.render();
  }

  render() {
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    panel.id = 'inv-panel';

    const title = document.createElement('h3');
    title.textContent =
      this.mode === 'table' ? 'Werkbank' :
      this.mode === 'furnace' ? 'Ofen' :
      this.mode === 'chest' ? 'Truhe' :
      this.mode === 'trade' ? 'Dorfbewohner – Handel' :
      this.mode === 'creative' ? 'Kreativ-Inventar' : 'Inventar';
    panel.appendChild(title);

    if (this.mode === 'furnace') this.renderFurnace(panel);
    else if (this.mode === 'trade') this.renderTrades(panel);
    else if (this.mode === 'chest') this.renderChest(panel);
    else if (this.mode === 'creative') this.renderCreative(panel);
    else this.renderCrafting(panel);

    // Hauptinventar + Hotbar
    const main = document.createElement('div');
    main.className = 'inv-grid';
    for (let i = 9; i < 36; i++) {
      main.appendChild(this.slotEl(this.inv.slots[i], b => this.clickSlot(this.inv.slots, i, b)));
    }
    panel.appendChild(main);

    const hot = document.createElement('div');
    hot.className = 'inv-grid hotrow';
    for (let i = 0; i < 9; i++) {
      hot.appendChild(this.slotEl(this.inv.slots[i], b => this.clickSlot(this.inv.slots, i, b)));
    }
    panel.appendChild(hot);

    this.root.appendChild(panel);
    this.renderCursor();
  }

  renderCrafting(panel) {
    const wrap = document.createElement('div');
    wrap.id = 'craft-area';

    if (this.mode === 'inv') {
      const armorCol = document.createElement('div');
      armorCol.className = 'armor-col';
      for (let i = 0; i < 4; i++) {
        const slot = this.slotEl(this.inv.armor[i],
          b => this.clickSlot(this.inv.armor, i, b, st => itemInfo(st.id).armor?.slot === i),
          'armor');
        slot.title = this.inv.armor[i] ? itemInfo(this.inv.armor[i].id).name : ARMOR_LABELS[i];
        armorCol.appendChild(slot);
      }
      wrap.appendChild(armorCol);
    }

    const grid = document.createElement('div');
    const w = this.gridWidth();
    grid.className = 'craft-grid ' + (w === 3 ? 'g3' : 'g2');
    for (let r = 0; r < w; r++) {
      for (let c = 0; c < w; c++) {
        const i = r * w + c;
        grid.appendChild(this.slotEl(this.craftSlots[i], b => this.clickSlot(this.craftSlots, i, b)));
      }
    }
    wrap.appendChild(grid);

    const arrow = document.createElement('div');
    arrow.className = 'craft-arrow';
    arrow.textContent = '→';
    wrap.appendChild(arrow);

    const r = matchRecipe(this.craftSlots.slice(0, w * w), w);
    const resultStack = r ? { id: r.out.id, count: r.out.count } : null;
    wrap.appendChild(this.slotEl(resultStack, () => this.takeResult(), 'result'));

    // Rezeptbuch-Knopf
    const bookBtn = document.createElement('button');
    bookBtn.className = 'book-btn';
    bookBtn.textContent = this.showBook ? '📖 ✕' : '📖';
    bookBtn.title = 'Rezeptbuch';
    bookBtn.addEventListener('click', () => { this.showBook = !this.showBook; this.render(); });
    wrap.appendChild(bookBtn);

    panel.appendChild(wrap);
    if (this.showBook) this.renderBook(panel);
  }

  renderBook(panel) {
    const w = this.gridWidth();
    const book = document.createElement('div');
    book.id = 'recipe-book';
    for (const r of RECIPES) {
      const fits = recipeFits(r, w);
      const canCraft = fits && recipeNeeds(r).every(n => {
        // Grid-Inhalt zählt mit (liegt beim Füllen zurück im Inventar)
        let have = this.inv.countOf(n.id);
        for (const s of this.craftSlots) if (s && s.id === n.id) have += s.count;
        return have >= n.count;
      });
      const cls = canCraft ? 'craftable' : fits ? 'known' : 'needs-table';
      const el = this.slotEl({ id: r.out.id, count: r.out.count }, () => {
        if (canCraft) this.fillRecipe(r);
      }, 'recipe ' + cls);
      el.title = itemInfo(r.out.id).name +
        (!fits ? ' (Werkbank nötig)' : '') +
        ' – ' + recipeNeeds(r).map(n => `${n.count}× ${itemInfo(n.id).name}`).join(', ');
      book.appendChild(el);
    }
    panel.appendChild(book);
  }

  renderFurnace(panel) {
    const f = this.furnace;
    const wrap = document.createElement('div');
    wrap.id = 'furnace-area';

    const col = document.createElement('div');
    col.className = 'furnace-col';
    col.appendChild(this.slotEl(f.in, b => {
      const list = [f.in];
      this.clickSlot(list, 0, b, st => SMELT[st.id] !== undefined);
      f.in = list[0];
      this.render();
    }));
    const flame = document.createElement('div');
    flame.className = 'furnace-flame' + (f.burn > 0 ? ' lit' : '');
    flame.textContent = '🔥';
    if (f.burnMax > 0) flame.style.opacity = Math.max(0.15, f.burn / f.burnMax);
    col.appendChild(flame);
    col.appendChild(this.slotEl(f.fuel, b => {
      const list = [f.fuel];
      this.clickSlot(list, 0, b, st => FUEL[st.id] !== undefined);
      f.fuel = list[0];
      this.render();
    }));
    wrap.appendChild(col);

    const prog = document.createElement('div');
    prog.className = 'furnace-progress';
    const bar = document.createElement('div');
    bar.style.width = Math.min(100, (f.progress / 10) * 100) + '%';
    prog.appendChild(bar);
    wrap.appendChild(prog);

    wrap.appendChild(this.slotEl(f.out, () => this.takeFurnaceOut(), 'result'));
    panel.appendChild(wrap);
  }

  renderChest(panel) {
    const grid = document.createElement('div');
    grid.className = 'inv-grid chest-grid';
    for (let i = 0; i < 27; i++) {
      grid.appendChild(this.slotEl(this.chest.slots[i], b => this.clickSlot(this.chest.slots, i, b)));
    }
    panel.appendChild(grid);
  }

  renderCreative(panel) {
    const items = [...CREATIVE_BLOCKS, ...(this.hooks.creativeItems ? this.hooks.creativeItems() : [])];
    const wrap = document.createElement('div');
    wrap.id = 'creative-list';
    for (const id of items) {
      const info = itemInfo(id);
      if (!info) continue;
      const el = this.slotEl({ id, count: 1 }, b => {
        if (b === 0) this.cursor = { id, count: info.stack };
        else this.cursor = { id, count: 1 };
        this.render();
      }, 'creative-item');
      wrap.appendChild(el);
    }
    panel.appendChild(wrap);
    const hint = document.createElement('p');
    hint.className = 'creative-hint';
    hint.textContent = 'Linksklick: voller Stapel · Rechtsklick: 1 Stück · Klick auf Inventar-Slot legt ab';
    panel.appendChild(hint);
  }

  renderTrades(panel) {
    const wrap = document.createElement('div');
    wrap.id = 'trade-list';
    for (const t of TRADES) {
      const row = document.createElement('div');
      row.className = 'trade-row';
      for (const g of t.give) {
        row.appendChild(this.slotEl({ id: g.id, count: g.count }, null, 'trade-item'));
      }
      const arrow = document.createElement('div');
      arrow.className = 'craft-arrow';
      arrow.textContent = '→';
      row.appendChild(arrow);
      row.appendChild(this.slotEl({ id: t.get.id, count: t.get.count }, null, 'trade-item'));

      const canTrade = t.give.every(g => this.inv.countOf(g.id) >= g.count);
      const btn = document.createElement('button');
      btn.className = 'trade-btn';
      btn.textContent = 'Tauschen';
      btn.disabled = !canTrade;
      btn.addEventListener('click', () => {
        if (!t.give.every(g => this.inv.countOf(g.id) >= g.count)) return;
        for (const g of t.give) this.inv.removeById(g.id, g.count);
        const rest = this.inv.add(t.get.id, t.get.count);
        if (rest > 0 && this.hooks.onLeftover) this.hooks.onLeftover(t.get.id, rest);
        if (this.hooks.onTrade) this.hooks.onTrade();
        this.render();
        if (this.hooks.onChange) this.hooks.onChange();
      });
      row.appendChild(btn);
      wrap.appendChild(row);
    }
    panel.appendChild(wrap);
  }

  renderCursor() {
    if (this.cursor) {
      this.cursorEl.classList.remove('hidden');
      this.cursorEl.innerHTML = '';
      const icon = itemIcon(this.cursor.id, this.atlas);
      const img = icon.cloneNode();
      img.getContext('2d').drawImage(icon, 0, 0);
      this.cursorEl.appendChild(img);
      if (this.cursor.count > 1) {
        const c = document.createElement('span');
        c.className = 'cnt';
        c.textContent = this.cursor.count;
        this.cursorEl.appendChild(c);
      }
    } else {
      this.cursorEl.classList.add('hidden');
    }
  }
}
