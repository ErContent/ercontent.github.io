// Answer normalization shared by the browser and tools/build-cases.mjs.
// Any change here requires rebuilding the cases.

// 1, i and l collapse to the same letter: leet uses 1 for both ("1n", "610ry").
const LEET = { 0: 'o', 1: 'i', l: 'i', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };
const EXTRA = { 'þ': 'p', 'ð': 'd', 'æ': 'ae', 'ø': 'o', 'ß': 'ss' };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

const fold = (s) => [...String(s ?? '').toLowerCase()].map((c) => EXTRA[c] ?? c).join('').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Inner content of a flag like npw{...}, or null if the input is not a flag. */
export function flagInner(raw) {
  const m = String(raw ?? '').trim().match(/^[a-z0-9_-]{2,12}\{(.*)\}$/i);
  return m ? m[1] : null;
}

/** Letters only, leetspeak decoded: "1_d0_n07 kn0w" -> "idonotknow" (note: every l becomes i). */
export function normPhrase(raw) {
  return [...fold(raw)].map((c) => LEET[c] ?? c).join('').replace(/[^a-z]/g, '');
}

/** Italian phone number: digits only, country prefix removed, leading 0 restored. */
export function normPhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('0039')) d = d.slice(4);
  else if (d.startsWith('39') && d.length > 10) d = d.slice(2);
  if (d.length === 9 && !d.startsWith('0') && !d.startsWith('3')) d = '0' + d;
  return d;
}

/** Free text: accents folded, lowercase, letters and digits only. */
export function normText(raw) {
  return fold(raw).replace(/[^a-z0-9]/g, '');
}

/** Any reasonable date ("04/05/2023", "2023-05-04", "4 May 2023", "04052023") -> "2023-05-04". */
export function normDate(raw) {
  let s = fold(flagInner(raw) ?? raw).trim();
  if (!s) return '';
  let y, m, d;
  const word = s.match(/[a-z]{3,}/);
  if (word) {
    const key = word[0].slice(0, 3);
    const idx = MONTHS.indexOf(key) >= 0 ? MONTHS.indexOf(key) : MESI.indexOf(key);
    const nums = s.match(/\d+/g) || [];
    if (idx < 0 || nums.length !== 2) return '';
    m = idx + 1;
    [d, y] = nums[0].length === 4 ? [nums[1], nums[0]] : nums;
  } else {
    const nums = s.match(/\d+/g) || [];
    if (nums.length === 1 && nums[0].length === 8) {
      const p = nums[0];
      const isoFirst = /^(1[5-9]|20)\d\d/.test(p) && +p.slice(4, 6) <= 12;
      [y, m, d] = isoFirst ? [p.slice(0, 4), p.slice(4, 6), p.slice(6)] : [p.slice(4), p.slice(2, 4), p.slice(0, 2)];
    } else if (nums.length === 3) {
      if (nums[0].length === 4) [y, m, d] = nums;
      else {
        [d, m, y] = nums;
        if (+m > 12 && +d <= 12) [d, m] = [m, d];
      }
    } else return '';
  }
  y = +y; m = +m; d = +d;
  if (!(y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return '';
  const pad = (n, w) => String(n).padStart(w, '0');
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

/**
 * Builds the key material for a case from the visitor's answer.
 * kind "phrase+phone": { phrase, phone } or { flag }
 * kind "date":         { date } or { flag }
 * kind "text":         { text } or { flag }
 * kind "phrase":       { text } or { flag }   (leetspeak-insensitive)
 * Returns null when the answer cannot be normalized.
 */
export function keyMaterial(caseId, kind, answer) {
  const flag = answer.flag != null && answer.flag !== '' ? flagInner(answer.flag) ?? answer.flag : null;
  if (kind === 'phrase+phone') {
    let { phrase, phone } = answer;
    if (flag != null) {
      const parts = flag.split(/[_\s]+/).filter(Boolean);
      phone = parts.pop() ?? '';
      phrase = parts.join('');
    }
    const p = normPhrase(phrase), t = normPhone(phone);
    return p && t.length >= 6 ? `${caseId}|${p}|${t}` : null;
  }
  if (kind === 'date') {
    const v = normDate(flag ?? answer.date);
    return v ? `${caseId}|${v}` : null;
  }
  if (kind === 'phrase') {
    const v = normPhrase(flag ?? answer.text);
    return v ? `${caseId}|${v}` : null;
  }
  if (kind === 'text') {
    const v = normText(flag ?? answer.text);
    return v ? `${caseId}|${v}` : null;
  }
  throw new Error(`Unknown answer kind: ${kind}`);
}

export const geoMaterial = (caseId, cell) => `${caseId}|geo|${cell}`;
