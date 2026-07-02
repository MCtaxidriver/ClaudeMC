// Audio-Engine: prozedurale Effekte über WebAudio (keine Asset-Pflicht).
// Musik: spielt OGG/MP3-Dateien ab, wenn sie unter ./texturepack/music/ liegen
// (z. B. calm1.ogg – dort kann man die C418-Stücke aus dem eigenen Spiel ablegen).

import { B } from './blocks.js';
import { SETTINGS } from './settings.js';

let ctx = null;
let master = null;

function ensureCtx() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.25 * SETTINGS.volume * 2;
    master.connect(ctx.destination);
    return true;
  } catch {
    return false;
  }
}

export function applyVolume() {
  if (master) master.gain.value = 0.25 * SETTINGS.volume * 2;
  music.el && (music.el.volume = 0.5 * SETTINGS.music);
}

export function unlockAudio() {
  if (!ensureCtx()) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  music.tryStart();
}

function noiseBurst(duration, freq, vol = 1, type = 'lowpass') {
  if (!ensureCtx() || ctx.state !== 'running') return;
  const n = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(master);
  src.start();
}

function tone(freq0, freq1, duration, vol = 0.5, type = 'square') {
  if (!ensureCtx() || ctx.state !== 'running') return;
  const osc = ctx.createOscillator();
  osc.type = type;
  const t0 = ctx.currentTime;
  osc.frequency.setValueAtTime(freq0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), t0 + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + duration);
}

// --- Hintergrundmusik (nur wenn Dateien vorhanden) ---
const MUSIC_CANDIDATES = [
  'texturepack/music/calm1.ogg', 'texturepack/music/calm2.ogg', 'texturepack/music/calm3.ogg',
  'texturepack/music/music1.ogg', 'texturepack/music/music2.ogg', 'texturepack/music/music3.ogg',
  'texturepack/music/calm1.mp3', 'texturepack/music/music1.mp3',
  'texturepack/assets/minecraft/sounds/music/game/calm1.ogg',
  'texturepack/assets/minecraft/sounds/music/game/calm2.ogg',
];

const music = {
  el: null,
  playlist: [],
  probing: false,
  started: false,
  async probe() {
    if (this.probing) return;
    this.probing = true;
    for (const url of MUSIC_CANDIDATES) {
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) this.playlist.push(url);
      } catch { /* nicht vorhanden */ }
    }
    if (this.playlist.length) console.log(`[Audio] ${this.playlist.length} Musikstücke gefunden`);
  },
  tryStart() {
    if (this.started || !this.playlist.length || SETTINGS.music <= 0) return;
    this.started = true;
    this.playNext();
  },
  playNext() {
    if (!this.playlist.length) return;
    const url = this.playlist[Math.floor(Math.random() * this.playlist.length)];
    this.el = new Audio(url);
    this.el.volume = 0.5 * SETTINGS.music;
    this.el.play().catch(() => { this.started = false; });
    this.el.addEventListener('ended', () => {
      setTimeout(() => this.playNext(), 30000 + Math.random() * 60000);
    });
  },
};
music.probe();

// Schrittgeräusche nach Material
function stepSound(blockId) {
  switch (blockId) {
    case B.GRASS: case B.TALL_GRASS: case B.LEAVES: case B.SNOWY_GRASS:
      noiseBurst(0.05, 1400, 0.25); break;
    case B.SAND: case B.GRAVEL: case B.SNOW_BLOCK:
      noiseBurst(0.07, 700, 0.3); break;
    case B.PLANKS: case B.LOG: case B.BIRCH_LOG: case B.DARK_LOG: case B.ACACIA_LOG: case B.CRAFTING_TABLE:
      tone(160, 120, 0.06, 0.15, 'triangle'); noiseBurst(0.04, 500, 0.2); break;
    default:
      noiseBurst(0.05, 900, 0.25); break;
  }
}

export const S = {
  dig: () => noiseBurst(0.09, 900, 0.8),
  place: () => noiseBurst(0.06, 1400, 0.6),
  step: (blockId) => stepSound(blockId),
  hurt: () => tone(320, 110, 0.22, 0.4, 'sawtooth'),
  mobHurt: () => tone(220, 90, 0.18, 0.3, 'square'),
  eat: () => noiseBurst(0.06, 2000, 0.5),
  burp: () => tone(180, 60, 0.25, 0.3, 'sawtooth'),
  explode: () => { noiseBurst(0.6, 320, 1.2); tone(90, 30, 0.5, 0.5, 'sine'); },
  fuse: () => noiseBurst(0.3, 4200, 0.4, 'highpass'),
  click: () => tone(700, 500, 0.05, 0.2, 'square'),
  pickup: () => tone(500, 900, 0.09, 0.2, 'sine'),
  portal: () => { tone(180, 600, 0.8, 0.25, 'sine'); tone(240, 700, 0.8, 0.15, 'triangle'); },
  trade: () => { tone(520, 660, 0.1, 0.3, 'sine'); setTimeout(() => tone(660, 880, 0.12, 0.3, 'sine'), 110); },
  ignite: () => noiseBurst(0.25, 3200, 0.6, 'highpass'),
  eye: () => tone(880, 1400, 0.4, 0.2, 'sine'),
  bow: () => { noiseBurst(0.08, 2600, 0.4, 'highpass'); tone(400, 900, 0.12, 0.2, 'sine'); },
  door: () => { tone(140, 90, 0.1, 0.25, 'square'); noiseBurst(0.05, 800, 0.3); },
  chest: () => { tone(120, 80, 0.15, 0.2, 'triangle'); noiseBurst(0.08, 600, 0.3); },
  splash: () => noiseBurst(0.25, 1200, 0.5),
  levelup: () => { tone(440, 440, 0.1, 0.25, 'sine'); setTimeout(() => tone(660, 660, 0.1, 0.25, 'sine'), 120); setTimeout(() => tone(880, 880, 0.18, 0.25, 'sine'), 240); },
  sleep: () => { tone(400, 200, 0.5, 0.15, 'sine'); },
  ambient: () => { tone(90 + Math.random() * 60, 60, 1.5, 0.12, 'sine'); },
  dragon: () => { tone(70, 45, 0.7, 0.6, 'sawtooth'); tone(140, 80, 0.7, 0.3, 'square'); },
  dragonDeath: () => {
    tone(200, 40, 1.6, 0.5, 'sawtooth');
    noiseBurst(1.2, 240, 1.0);
    setTimeout(() => tone(520, 1040, 0.8, 0.3, 'sine'), 700);
  },
};
