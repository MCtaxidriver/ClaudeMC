// Menüsystem: Hauptmenü (Slots mit Modus-Wechsel + Lösch-Bestätigung),
// Welterstellung (Name/Seed/Modus), Einstellungen (Renderdistanz, Grafik,
// Lautstärke, Keybindings). Das 3D-Panorama rendert main.js dahinter.

import { SETTINGS, saveSettings, resetKeys, KEY_LABELS } from './settings.js';
import { SLOT_COUNT, slotMeta, loadState, saveState, deleteSlot } from './save.js';

const el = id => document.getElementById(id);

export class Menus {
  // hooks: { startWorld(slot, mode, saved, opts), applySettings() }
  constructor(hooks) {
    this.hooks = hooks;
    this.pendingSlot = 0;
    this.capturingKey = null;
    this.confirmYes = null;
    this.returnSection = 'menu-main';
    this.overlay = el('overlay');
    this.wire();

    // Keybinding-Capture
    window.addEventListener('keydown', e => {
      if (!this.capturingKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') {
        SETTINGS.keys[this.capturingKey] = e.code;
        saveSettings();
      }
      this.capturingKey = null;
      this.renderSettings();
    }, true);
  }

  show(id) {
    for (const m of this.overlay.querySelectorAll('.menu')) m.classList.add('hidden');
    if (id) el(id).classList.remove('hidden');
    this.overlay.classList.toggle('hidden', !id);
  }

  wire() {
    el('btn-open-settings').addEventListener('click', () => { this.returnSection = 'menu-main'; this.renderSettings(); this.show('menu-settings'); });
    el('btn-pause-settings').addEventListener('click', () => { this.returnSection = 'menu-pause'; this.renderSettings(); this.show('menu-settings'); });
    el('btn-settings-back').addEventListener('click', () => {
      saveSettings();
      this.hooks.applySettings();
      this.show(this.returnSection);
    });
    el('btn-new-back').addEventListener('click', () => this.show('menu-main'));
    el('btn-confirm-no').addEventListener('click', () => { this.confirmYes = null; this.show(this.returnSection); });
    el('btn-confirm-yes').addEventListener('click', () => {
      const fn = this.confirmYes;
      this.confirmYes = null;
      if (fn) fn();
    });
    el('btn-create-world').addEventListener('click', () => {
      const name = el('world-name').value.trim() || `Welt ${this.pendingSlot + 1}`;
      const seedStr = el('world-seed').value.trim();
      const mode = el('mode-creative-toggle').checked ? 'creative' : 'survival';
      let seed;
      if (seedStr) {
        seed = Number(seedStr);
        if (!Number.isFinite(seed)) {
          // Text-Seed hashen
          seed = 0;
          for (const ch of seedStr) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
        }
        seed = seed >>> 0;
      } else {
        seed = (Math.random() * 0xffffffff) >>> 0;
      }
      this.hooks.startWorld(this.pendingSlot, mode, null, { seed, name });
    });
  }

  confirm(message, onYes, returnTo = 'menu-main') {
    this.returnSection = returnTo;
    el('confirm-text').textContent = message;
    this.confirmYes = onYes;
    this.show('menu-confirm');
  }

  refreshSlots() {
    const wrap = el('slots');
    wrap.innerHTML = '';
    for (let s = 0; s < SLOT_COUNT; s++) {
      const meta = slotMeta(s);
      const card = document.createElement('div');
      card.className = 'slot-card';
      const info = document.createElement('div');
      info.className = 'info';
      if (meta.exists) {
        const date = new Date(meta.savedAt).toLocaleString('de-CH');
        const dimLabel = meta.dim === 'nether' ? 'Nether' : meta.dim === 'end' ? 'End' : 'Overworld';
        info.innerHTML = `<div class="t">${meta.name || 'Welt ' + (s + 1)} – ${meta.mode === 'creative' ? 'Kreativ' : 'Überleben'}</div>
          <div class="d">Seed ${meta.seed} · ${dimLabel} · ${date}</div>`;
      } else {
        info.innerHTML = `<div class="t">Slot ${s + 1}</div><div class="d">Leer</div>`;
      }
      card.appendChild(info);

      const btns = document.createElement('div');
      btns.className = 'slot-btns';

      const incompatible = meta.exists && meta.version !== 2;
      const play = document.createElement('button');
      play.className = 'mbtn slot-btn';
      play.textContent = meta.exists ? (incompatible ? 'Inkompatibel' : 'Spielen') : 'Neue Welt';
      play.disabled = incompatible;
      if (incompatible) play.title = 'Alte Weltversion – bitte löschen und neu erstellen';
      play.addEventListener('click', () => {
        if (incompatible) return;
        if (meta.exists) this.hooks.startWorld(s, meta.mode, loadState(s), {});
        else {
          this.pendingSlot = s;
          el('new-slot-nr').textContent = s + 1;
          el('world-name').value = '';
          el('world-seed').value = '';
          el('mode-creative-toggle').checked = false;
          this.show('menu-new');
        }
      });
      btns.appendChild(play);

      if (meta.exists) {
        // Sofortiger Modus-Wechsel Kreativ <-> Überleben
        const swap = document.createElement('button');
        swap.className = 'mbtn secondary slot-btn';
        swap.textContent = meta.mode === 'creative' ? '→ Überleben' : '→ Kreativ';
        swap.title = 'Spielmodus dieser Welt wechseln';
        swap.addEventListener('click', () => {
          const state = loadState(s);
          if (!state) return;
          state.mode = state.mode === 'creative' ? 'survival' : 'creative';
          saveState(s, state);
          this.refreshSlots();
        });
        btns.appendChild(swap);

        const del = document.createElement('button');
        del.className = 'mbtn danger slot-btn';
        del.textContent = 'Löschen';
        del.addEventListener('click', () => {
          this.confirm(`Welt "${meta.name || 'Welt ' + (s + 1)}" wirklich unwiderruflich löschen?`, () => {
            deleteSlot(s);
            this.refreshSlots();
            this.show('menu-main');
          });
        });
        btns.appendChild(del);
      }
      card.appendChild(btns);
      wrap.appendChild(card);
    }
  }

  renderSettings() {
    const wrap = el('settings-body');
    wrap.innerHTML = '';

    const row = (label, control) => {
      const r = document.createElement('div');
      r.className = 'set-row';
      const l = document.createElement('label');
      l.textContent = label;
      r.appendChild(l);
      r.appendChild(control);
      wrap.appendChild(r);
      return r;
    };

    // Renderdistanz
    const rd = document.createElement('input');
    rd.type = 'range'; rd.min = 3; rd.max = 10; rd.step = 1; rd.value = SETTINGS.renderDistance;
    const rdVal = document.createElement('span');
    rdVal.className = 'set-val';
    rdVal.textContent = SETTINGS.renderDistance + ' Chunks';
    rd.addEventListener('input', () => {
      SETTINGS.renderDistance = Number(rd.value);
      rdVal.textContent = rd.value + ' Chunks';
    });
    const rdWrap = document.createElement('div');
    rdWrap.className = 'set-control';
    rdWrap.append(rd, rdVal);
    row('Renderdistanz', rdWrap);

    // Grafikqualität
    const q = document.createElement('select');
    for (const [v, label] of [['low', 'Schnell'], ['normal', 'Normal'], ['high', 'Schön']]) {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      if (SETTINGS.quality === v) o.selected = true;
      q.appendChild(o);
    }
    q.addEventListener('change', () => { SETTINGS.quality = q.value; });
    row('Grafikqualität', q);

    // Lautstärke
    const mkVol = (key) => {
      const v = document.createElement('input');
      v.type = 'range'; v.min = 0; v.max = 1; v.step = 0.05; v.value = SETTINGS[key];
      v.addEventListener('input', () => { SETTINGS[key] = Number(v.value); });
      return v;
    };
    row('Sound-Lautstärke', mkVol('volume'));
    row('Musik-Lautstärke', mkVol('music'));

    // Keybindings
    const kbTitle = document.createElement('h4');
    kbTitle.textContent = 'Tastenbelegung';
    wrap.appendChild(kbTitle);
    for (const action of Object.keys(KEY_LABELS)) {
      const btn = document.createElement('button');
      btn.className = 'key-btn';
      btn.textContent = this.capturingKey === action ? 'Taste drücken…' : prettyKey(SETTINGS.keys[action]);
      btn.addEventListener('click', () => {
        this.capturingKey = action;
        this.renderSettings();
      });
      row(KEY_LABELS[action], btn);
    }
    const reset = document.createElement('button');
    reset.className = 'mbtn secondary';
    reset.style.marginTop = '10px';
    reset.textContent = 'Tasten zurücksetzen';
    reset.addEventListener('click', () => { resetKeys(); this.renderSettings(); });
    wrap.appendChild(reset);
  }
}

function prettyKey(code) {
  if (!code) return '–';
  return code
    .replace('Key', '')
    .replace('Digit', '')
    .replace('ControlLeft', 'Strg L').replace('ControlRight', 'Strg R')
    .replace('ShiftLeft', 'Shift L').replace('ShiftRight', 'Shift R')
    .replace('Space', 'Leertaste');
}
