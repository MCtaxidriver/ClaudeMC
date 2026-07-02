// Einstellungen: Renderdistanz, Grafik, Sound, Keybindings (localStorage)

const STORE_KEY = 'claudecraft_settings';

export const DEFAULT_KEYS = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  sneak: 'ShiftLeft',
  sprint: 'ControlLeft',
  inventory: 'KeyE',
  drop: 'KeyQ',
};

// Anzeigenamen für das Keybinding-Menü
export const KEY_LABELS = {
  forward: 'Vorwärts',
  back: 'Rückwärts',
  left: 'Links',
  right: 'Rechts',
  jump: 'Springen / Fliegen',
  sneak: 'Schleichen / Sinken',
  sprint: 'Sprinten',
  inventory: 'Inventar',
  drop: 'Item wegwerfen',
};

const DEFAULTS = {
  renderDistance: 6,   // Chunk-Radius (3-10)
  quality: 'normal',   // low | normal | high (Pixel-Ratio + Wolken/Sterne)
  volume: 0.5,         // Effekt-Lautstärke 0..1
  music: 0.4,          // Musik-Lautstärke 0..1
  keys: { ...DEFAULT_KEYS },
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULTS, keys: { ...DEFAULT_KEYS } };
    const d = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...d,
      keys: { ...DEFAULT_KEYS, ...(d.keys || {}) },
    };
  } catch {
    return { ...DEFAULTS, keys: { ...DEFAULT_KEYS } };
  }
}

// Zentrale, live veränderbare Instanz – Module lesen daraus (kein Re-Import nötig)
export const SETTINGS = loadSettings();

const listeners = new Set();
export function onSettingsChange(fn) { listeners.add(fn); }

export function saveSettings() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(SETTINGS)); } catch { /* voll */ }
  for (const fn of listeners) fn(SETTINGS);
}

export function resetKeys() {
  SETTINGS.keys = { ...DEFAULT_KEYS };
  saveSettings();
}

// Hilfen für Grafikqualität
export function pixelRatioFor(quality) {
  return quality === 'low' ? 0.75 : quality === 'high' ? Math.min(window.devicePixelRatio, 2) : 1;
}
