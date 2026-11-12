// PBKDF2-SHA256 key derivation + AES-256-GCM, identical in browser and Node >= 20.
const subtle = globalThis.crypto.subtle;
const te = new TextEncoder(), td = new TextDecoder();

export function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(b64) {
  const s = atob(b64), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
export const randomB64 = (n) => toB64(globalThis.crypto.getRandomValues(new Uint8Array(n)));

/** Raw 256-bit key derived from the answer material. */
export async function deriveRaw(material, saltB64, iterations) {
  const base = await subtle.importKey('raw', te.encode(material), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations }, base, 256);
  return new Uint8Array(bits);
}

const aes = (raw) => subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function seal(raw, obj) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, await aes(raw), te.encode(JSON.stringify(obj)));
  return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

/** Decrypted object, or null when the key is wrong. */
export async function unseal(raw, box) {
  try {
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, await aes(raw), fromB64(box.ct));
    return JSON.parse(td.decode(pt));
  } catch {
    return null;
  }
}

/** Hex SHA-256 of a string (used to hide hint triggers). */
export async function sha256hex(str) {
  const d = new Uint8Array(await subtle.digest('SHA-256', te.encode(str)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}
