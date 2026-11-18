// IRON TIDE — save: progress persists in localStorage under one key.
// Mission index, cash, weapons, collectibles, best race time, crew and
// district standing all survive a reload; Continue on the start screen
// picks up where Mara left off.
const KEY = 'iron-tide-rustport-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
