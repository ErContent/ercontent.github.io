#!/usr/bin/env node
// Encrypts the case chain into ./cases from a PRIVATE source folder kept outside the repo.
// Usage: node tools/build-cases.mjs ../osint-cases-private
//
// Scheme: every case has a random 256-bit case key (CK).
//  - each accepted answer derives a key with PBKDF2 and seals {ck}: any valid answer opens the case
//  - case N+1 (brief, files, hints) is encrypted with CK of case N
//  - "after" (e.g. the real location of a GEOINT case) is encrypted with the case's own CK
//  - hint triggers are stored as salted SHA-256 hashes, never in clear
import { readFile, writeFile, mkdir, rm, copyFile, stat, access } from 'node:fs/promises';
import { resolve, basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { keyMaterial, geoMaterial } from '../assets/js/normalize.js';
import { withNeighbours, encode as geohash, cellSize } from '../assets/js/geohash.js';
import { deriveRaw, seal, unseal, randomB64, toB64, fromB64, sha256hex } from '../assets/js/vault.js';
import { TRIGGER_SALT } from '../assets/js/hints.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] ? resolve(process.argv[2]) : null;
if (!SRC) { console.error('Usage: node tools/build-cases.mjs <private-cases-folder>'); process.exit(1); }
if (SRC.startsWith(ROOT)) { console.error('Refusing: the private folder must live outside the public repository.'); process.exit(1); }

const { default: cfg } = await import(pathToFileURL(join(SRC, 'cases.config.mjs')).href);
const OUT = join(ROOT, 'cases');
await rm(OUT, { recursive: true, force: true });
await mkdir(join(OUT, 'files'), { recursive: true });

// Salts and case keys are generated once and kept in the private folder,
// so rebuilding or adding cases never resets visitors' progress.
const SECRETS = join(SRC, 'salts.json');
const secrets = JSON.parse(await readFile(SECRETS, 'utf8').catch(() => '{}'));
const keep = (key, n) => (secrets[key] ||= randomB64(n));

const TEXT = /\.(txt|md|csv|json|log)$/i;
const preview = (name) => (TEXT.test(name) ? 'text' : /\.(png|jpe?g|webp|gif)$/i.test(name) ? 'image' : null);
const exists = (p) => access(p).then(() => true, () => false);
const warnings = [];

async function briefOf(c) { return (await readFile(join(SRC, c.brief), 'utf8')).replace(/\r\n/g, '\n').trim(); }

async function presentFiles(c) {
  const out = [];
  for (const f of c.files || []) {
    if (await exists(join(SRC, f))) out.push(f);
    else warnings.push(`${c.id}: missing file ${f} (skipped, add it and rebuild)`);
  }
  return out;
}

async function publicFiles(c, dir) {
  await mkdir(join(OUT, dir), { recursive: true });
  const list = [];
  for (const f of await presentFiles(c)) {
    const name = basename(f);
    await copyFile(join(SRC, f), join(OUT, dir, name));
    list.push({ name, size: (await stat(join(SRC, f))).size, preview: preview(name), path: `cases/${dir}/${name}` });
  }
  return list;
}

async function inlineFiles(c) {
  const list = [];
  for (const f of await presentFiles(c)) {
    const buf = await readFile(join(SRC, f));
    list.push({ name: basename(f), size: buf.length, preview: preview(f), data: toB64(new Uint8Array(buf)) });
  }
  return list;
}

async function geoBlock(c) {
  if (!c.geo) return undefined;
  const { lat, lon, precision, prompt, gate } = c.geo;
  const salt = keep(`${c.id}:geo`, 16), boxes = [];
  for (const cell of withNeighbours(lat, lon, precision)) {
    const raw = await deriveRaw(geoMaterial(c.id, cell), salt, cfg.geoIterations);
    boxes.push(await seal(raw, { ok: true }));
  }
  boxes.sort(() => Math.random() - 0.5);
  return { precision, prompt, gate: gate !== false, salt, iterations: cfg.geoIterations, boxes };
}

async function hintBlock(c) {
  const out = [];
  for (const h of c.hints || []) {
    let triggers = [];
    if (h.on) triggers = [h.on];
    if (h.globeArea) {
      // every precision-3 geohash cell covering the box
      const [s, w, n, e] = h.globeArea, { dLat, dLon } = cellSize(3), cells = new Set();
      for (let la = s; la <= n + dLat; la += dLat / 2) for (let lo = w; lo <= e + dLon; lo += dLon / 2) cells.add(geohash(Math.min(la, n), Math.min(lo, e), 3));
      triggers = [...cells].map((g) => `globe:${g}`);
    }
    out.push({ text: h.text, t: await Promise.all(triggers.map((x) => sha256hex(TRIGGER_SALT + x))) });
  }
  return out;
}

async function seals(c, ck) {
  const salt = keep(c.id, 16), list = [];
  for (const a of c.answers) {
    const material = keyMaterial(c.id, c.kind, typeof a === 'string' ? { text: a } : a);
    if (!material) throw new Error(`${c.id}: an answer cannot be normalized`);
    const raw = await deriveRaw(material, salt, cfg.iterations);
    const box = await seal(raw, { ck: toB64(ck) });
    if (!(await unseal(raw, box))) throw new Error(`${c.id}: self-check failed`);
    list.push(box);
  }
  return { salt, iterations: cfg.iterations, seals: list.sort(() => Math.random() - 0.5) };
}

async function after(c, ck) {
  return c.geo ? seal(ck, { lat: c.geo.lat, lon: c.geo.lon }) : undefined;
}

const body = async (c) => ({
  title: c.title, tags: c.tags, difficulty: c.difficulty, kind: c.kind, fields: c.fields,
  brief: await briefOf(c), geo: await geoBlock(c), hints: await hintBlock(c),
});

const index = { version: 2, built: new Date().toISOString().slice(0, 10), cases: [] };
let prevCk = null, prevId = null;

for (const [i, c] of cfg.cases.entries()) {
  const ck = fromB64(keep(`${c.id}:ck`, 32));
  const head = { id: c.id, n: i + 1, ...(await seals(c, ck)), after: await after(c, ck) };
  if (i === 0) index.cases.push({ ...head, open: true, content: { ...(await body(c)), files: await publicFiles(c, `files/${c.id}`) } });
  else index.cases.push({ ...head, open: false, lockedBy: prevId, locked: await seal(prevCk, { ...(await body(c)), files: await inlineFiles(c) }) });
  console.log(`✔ ${c.id}  ${c.kind}  ${c.answers.length} answer(s)  ${(c.hints || []).length} hint(s)`);
  prevCk = ck; prevId = c.id;
}
await writeFile(join(OUT, 'index.json'), JSON.stringify(index));

if (cfg.hidden) {
  const h = cfg.hidden, ck = fromB64(keep(`${h.id}:ck`, 32));
  const hidden = { id: h.id, ...(await seals(h, ck)), content: { ...(await body(h)), files: await publicFiles(h, 'files/hidden') } };
  await writeFile(join(OUT, 'hidden.json'), JSON.stringify(hidden));
  console.log(`✔ ${h.id}  hidden case`);
}

await writeFile(SECRETS, JSON.stringify(secrets, null, 2));
warnings.forEach((w) => console.warn(`! ${w}`));
console.log(`Wrote cases/ (${index.cases.length} cases${cfg.hidden ? ' + hidden' : ''}). No answers were written.`);
