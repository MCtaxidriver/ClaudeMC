// Speicherslots in localStorage (3 Slots)

const KEY = slot => 'claudecraft_slot_' + slot;

export const SLOT_COUNT = 3;

export function slotMeta(slot) {
  const raw = localStorage.getItem(KEY(slot));
  if (!raw) return { exists: false };
  try {
    const d = JSON.parse(raw);
    return {
      exists: true,
      mode: d.mode,
      seed: d.seed,
      dim: d.dim,
      name: d.name,
      version: d.version || 1,
      savedAt: d.savedAt,
    };
  } catch {
    return { exists: false };
  }
}

export function saveState(slot, state) {
  state.savedAt = Date.now();
  try {
    localStorage.setItem(KEY(slot), JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('[Save] Speichern fehlgeschlagen:', e);
    return false;
  }
}

export function loadState(slot) {
  const raw = localStorage.getItem(KEY(slot));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function deleteSlot(slot) {
  localStorage.removeItem(KEY(slot));
}
