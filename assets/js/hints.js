// Hidden hints: actions around the site "fire" triggers; a hint is found when one of its
// hashed triggers has been fired. Nothing here names a real trigger.
import { sha256hex } from './vault.js';

export const TRIGGER_SALT = 'ercontent77|';
const KEY = 'hints.v1', MAX = 600;
const hasStorage = typeof localStorage !== 'undefined';
const listeners = new Set();

function load() {
  if (!hasStorage) return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
let fired = new Set(load());

/** Normalizes and records an action. Resolves to true the first time it happens. */
export async function fire(trigger) {
  const t = String(trigger).toLowerCase().trim().replace(/\s+/g, ' ');
  if (!t) return false;
  const h = await sha256hex(TRIGGER_SALT + t);
  if (fired.has(h)) return false;
  fired.add(h);
  if (hasStorage) {
    try { localStorage.setItem(KEY, JSON.stringify([...fired].slice(-MAX))); } catch { /* storage full or blocked */ }
  }
  listeners.forEach((fn) => fn(h));
  return true;
}

export const onFire = (fn) => listeners.add(fn);
export const isFound = (hint) => (hint.t || []).some((h) => fired.has(h));
export const matches = (hint, h) => (hint.t || []).includes(h);
export function resetHints() {
  fired = new Set();
  if (hasStorage) { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
}
