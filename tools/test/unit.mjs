// Unit, build-integrity and static checks. No browser needed.
import { readFile, readdir, stat, access } from 'node:fs/promises';
import { join, dirname, extname, relative } from 'node:path';
import { section, test, assert, eq } from './lib.mjs';
import { normPhrase, normPhone, normDate, keyMaterial, geoMaterial } from '../../assets/js/normalize.js';
import { encode as geohash, withNeighbours } from '../../assets/js/geohash.js';
import { deriveRaw, seal, unseal, randomB64, fromB64, sha256hex } from '../../assets/js/vault.js';
import { TRIGGER_SALT } from '../../assets/js/hints.js';

const exists = (p) => access(p).then(() => true, () => false);
const answerObj = (a) => (typeof a === 'string' ? { text: a } : a);

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(e.name)) continue;
    const p = join(dir, e.name);
    e.isDirectory() ? await walk(p, out) : out.push(p);
  }
  return out;
}

/** Opens the case with an answer and returns the case key, or null. */
async function open(c, kind, answer) {
  const m = keyMaterial(c.id, kind, answer);
  if (!m) return null;
  const raw = await deriveRaw(m, c.salt, c.iterations);
  for (const box of c.seals) { const v = await unseal(raw, box); if (v?.ck) return v.ck; }
  return null;
}

export async function runUnit({ ROOT, SRC, cfg, release }) {
  section('Normalization');
  await test('leetspeak: 1, i and l are the same letter', () => {
    eq(normPhrase('6r34t_610ry_1n_r3d_l1n35'), normPhrase('Great glory in red lines'), 'leet vs plain');
    eq(normPhrase('7h1s_1s_4_7357'), 'thisisatest', 'decoded');
  });
  await test('Icelandic letters: Þ and ó fold to p and o', () => eq(normPhrase('Þingvellir Ósló'), normPhrase('p1n6v3ll1r_05l0'), 'thorn'));
  await test('phone numbers: prefix, spaces and missing 0', () => {
    for (const p of ['+39 081 234 5678', '0039 0812345678', '081-234-5678', '812345678']) eq(normPhone(p), '0812345678', p);
  });
  await test('dates in every common format', () => {
    for (const d of ['2023-05-14', '14/05/2023', '14.05.2023', '05/14/2023', '14 May 2023', '14 maggio 2023', 'npw{14052023}', '20230514']) eq(normDate(d), '2023-05-14', d);
    eq(normDate('nonsense'), '', 'invalid input');
  });
  await test('flag parsing for phrase + phone', () => {
    eq(keyMaterial('x', 'phrase+phone', { flag: 'npw{h3ll0_w0r1d_0812345678}' }), 'x|heiioworid|0812345678', 'flag');
    eq(keyMaterial('x', 'phrase+phone', { phrase: '', phone: '' }), null, 'empty answer');
  });

  section('Geohash and crypto');
  await test('geohash matches the reference value', () => eq(geohash(57.64911, 10.40744, 11), 'u4pruydqqvj', 'reference'));
  await test('a cell has 9 distinct neighbours (itself included)', () => eq(withNeighbours(40.8386, 14.2527, 7).length, 9, 'neighbours'));
  await test('AES-GCM seal/unseal round trip, wrong key rejected', async () => {
    const k1 = await deriveRaw('a', randomB64(16), 1000), k2 = await deriveRaw('b', randomB64(16), 1000);
    const box = await seal(k1, { hi: 1 });
    eq((await unseal(k1, box))?.hi, 1, 'right key');
    eq(await unseal(k2, box), null, 'wrong key');
  });
  await test('SHA-256 matches the reference value', async () => eq(await sha256hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'sha256'));

  section('Case archive (cases/)');
  const index = JSON.parse(await readFile(join(ROOT, 'cases/index.json'), 'utf8'));
  await test('index.json lists every case in order', () => {
    eq(index.version, 2, 'format version');
    eq(index.cases.map((c) => c.id).join(','), cfg.cases.map((c) => c.id).join(','), 'case ids');
    assert(index.cases[0].open && index.cases.slice(1).every((c) => !c.open && c.locked), 'only the first case is open');
  });

  const keys = {};
  for (const [i, c] of cfg.cases.entries()) {
    const pub = index.cases[i];
    await test(`${c.id}: every accepted answer opens the case`, async () => {
      for (const a of c.answers) {
        const ck = await open(pub, c.kind, answerObj(a));
        assert(ck, `answer ${JSON.stringify(a)} rejected`);
        keys[c.id] = ck;
      }
    });
    await test(`${c.id}: wrong answers are rejected`, async () => {
      const wrong = c.kind === 'date' ? { date: '1900-01-01' } : c.kind === 'phrase+phone' ? { phrase: 'wrong', phone: '0811111111' } : { text: 'definitely not it' };
      eq(await open(pub, c.kind, wrong), null, 'wrong answer');
    });
    if (c.kind !== 'date') {
      await test(`${c.id}: the leetspeak version of the answer works too`, async () => {
        const leet = (s) => s.replace(/o/gi, '0').replace(/e/gi, '3').replace(/t/gi, '7').replace(/s/gi, '5').replace(/\s+/g, '_');
        const a = answerObj(c.answers[0]);
        const v = c.kind === 'phrase+phone' ? { flag: `npw{${leet(a.phrase)}_${a.phone}}` } : { flag: `npw{${leet(a.text)}}` };
        assert(await open(pub, c.kind, v), `flag ${v.flag} rejected`);
      });
    }
    if (i > 0) {
      await test(`${c.id}: decrypts with the key of ${cfg.cases[i - 1].id}`, async () => {
        const body = await unseal(fromB64(keys[cfg.cases[i - 1].id]), pub.locked);
        assert(body, 'cannot decrypt');
        eq(body.title, c.title, 'title');
        eq(body.hints.length, (c.hints || []).length, 'hint count');
        for (const f of c.files || []) {
          const present = await exists(join(SRC, f));
          const inPayload = body.files.some((x) => x.name === f.split('/').pop());
          if (present) assert(inPayload, `${f} missing from the payload`);
          else throw new Error(`${f} is not in the private folder`);
        }
      });
    } else {
      await test(`${c.id}: public files are in place`, async () => {
        for (const f of pub.content.files) assert(await exists(join(ROOT, f.path)), `${f.path} missing`);
        eq(pub.content.files.length, (c.files || []).length, 'file count');
      });
    }
    if (c.geo) {
      await test(`${c.id}: the right pin passes, a pin 25 km away fails`, async () => {
        const g = i === 0 ? pub.content.geo : (await unseal(fromB64(keys[cfg.cases[i - 1].id]), pub.locked)).geo;
        const tryPin = async (lat, lon) => {
          const raw = await deriveRaw(geoMaterial(c.id, geohash(lat, lon, g.precision)), g.salt, g.iterations);
          for (const b of g.boxes) if (await unseal(raw, b)) return true;
          return false;
        };
        assert(await tryPin(c.geo.lat, c.geo.lon), 'exact location rejected');
        assert(!(await tryPin(c.geo.lat + 0.23, c.geo.lon)), 'far location accepted');
      });
      await test(`${c.id}: the real location is revealed only after solving`, async () => {
        const where = await unseal(fromB64(keys[c.id]), pub.after);
        assert(where && Math.abs(where.lat - c.geo.lat) < 1e-9, 'after-solve location');
      });
    }
    await test(`${c.id}: hint triggers are stored hashed`, async () => {
      const body = i === 0 ? pub.content : await unseal(fromB64(keys[cfg.cases[i - 1].id]), pub.locked);
      for (const [k, h] of (c.hints || []).entries()) {
        if (h.on) assert(body.hints[k].t.includes(await sha256hex(TRIGGER_SALT + h.on)), `hint #${k + 1} trigger`);
        if (h.globeArea) {
          const [s, w, n, e] = h.globeArea;
          assert(body.hints[k].t.includes(await sha256hex(`${TRIGGER_SALT}globe:${geohash((s + n) / 2, (w + e) / 2, 3)}`)), `hint #${k + 1} globe area`);
        }
      }
    });
  }

  if (cfg.hidden) {
    const hid = JSON.parse(await readFile(join(ROOT, 'cases/hidden.json'), 'utf8')), h = cfg.hidden;
    await test('hidden case: accepted answers open it', async () => {
      for (const a of h.answers) assert(await open(hid, h.kind, answerObj(a)), `answer ${JSON.stringify(a)} rejected`);
    });
    await test('hidden case: its files are published', async () => {
      for (const f of h.files || []) {
        if (!(await exists(join(SRC, f)))) throw new Error(`${f} is not in the private folder`);
        assert(hid.content.files.some((x) => x.name === f.split('/').pop()), `${f} not published`);
      }
      for (const f of hid.content.files) assert(await exists(join(ROOT, f.path)), `${f.path} missing`);
    });
  }

  section('Secrets must not be public');
  const files = await walk(ROOT);
  await test('no private files inside the repository', () => {
    const bad = files.filter((f) => /cases\.config\.mjs$|salts\.json$/.test(f));
    assert(!bad.length, `found: ${bad.map((f) => relative(ROOT, f)).join(', ')}`);
  });
  await test('no answer appears in any public file', async () => {
    const needles = new Set();
    for (const c of [...cfg.cases, cfg.hidden].filter(Boolean)) for (const a of c.answers) {
      const o = answerObj(a);
      for (const v of [o.phrase, o.text]) if (v) { needles.add(v.toLowerCase()); needles.add(normPhrase(v)); }
      if (o.phone) needles.add(normPhone(o.phone));
      if (o.date) { needles.add(o.date); needles.add(o.date.split('-').reverse().join('')); }
    }
    const secrets = JSON.parse(await readFile(join(SRC, 'salts.json'), 'utf8').catch(() => '{}'));
    Object.entries(secrets).filter(([k]) => k.endsWith(':ck')).forEach(([, v]) => needles.add(v));
    const hits = [];
    for (const f of files) {
      if (!/\.(html|js|mjs|json|css|md|txt)$/i.test(f)) continue;
      const txt = (await readFile(f, 'utf8')).toLowerCase();
      for (const n of needles) if (n.length > 5 && txt.includes(n.toLowerCase())) hits.push(`${relative(ROOT, f)} contains "${n}"`);
    }
    assert(!hits.length, hits.join('\n'));
  });
  await test('published case files contain no plaintext triggers', async () => {
    for (const f of ['cases/index.json', 'cases/hidden.json']) {
      if (!(await exists(join(ROOT, f)))) continue;
      const txt = await readFile(join(ROOT, f), 'utf8');
      assert(!/"on"\s*:|"globeArea"|cmd:|redact:|globe:site/.test(txt), `${f} leaks trigger names`);
    }
  });
  await test('.gitignore protects the private folder', async () => {
    const gi = await readFile(join(ROOT, '.gitignore'), 'utf8');
    for (const p of ['cases.config.mjs', '*-private/', 'node_modules/']) assert(gi.includes(p), `missing ${p}`);
  });

  section('Static checks');
  await test('every local file referenced by the pages exists', async () => {
    const missing = [];
    for (const page of ['index.html', 'evidence/index.html']) {
      const html = await readFile(join(ROOT, page), 'utf8');
      for (const [, u] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
        if (/^(https?:|mailto:|#|data:|%%)/.test(u) || u === '../' || u.endsWith('/')) continue;
        if (!(await exists(join(ROOT, dirname(page), u.split('#')[0])))) missing.push(`${page}: ${u}`);
      }
    }
    assert(!missing.length, missing.join('\n'));
  });
  await test('every JS import and CSS url() resolves', async () => {
    const missing = [];
    for (const f of files.filter((x) => extname(x) === '.js' && x.includes(join('assets', 'js')))) {
      for (const [, u] of (await readFile(f, 'utf8')).matchAll(/(?:import|from)\s*\(?\s*'(\.[^']+)'/g)) if (!(await exists(join(dirname(f), u)))) missing.push(`${relative(ROOT, f)}: ${u}`);
    }
    const css = join(ROOT, 'assets/css/style.css');
    for (const [, u] of (await readFile(css, 'utf8')).matchAll(/url\("?(\.\.\/[^")]+)"?\)/g)) if (!(await exists(join(dirname(css), u)))) missing.push(`style.css: ${u}`);
    assert(!missing.length, missing.join('\n'));
  });
  await test('no third-party scripts, styles or fonts', async () => {
    const bad = [];
    for (const page of ['index.html', 'evidence/index.html']) {
      const html = await readFile(join(ROOT, page), 'utf8');
      if (/<script[^>]+src="https?:/.test(html)) bad.push(`${page}: external script`);
      if (/<link[^>]+rel="stylesheet"[^>]+href="https?:/.test(html)) bad.push(`${page}: external stylesheet`);
      assert(/Content-Security-Policy/.test(html), `${page}: CSP missing`);
    }
    for (const f of files.filter((x) => /assets[\\/]js[\\/].+\.js$/.test(x))) {
      const js = await readFile(f, 'utf8');
      for (const [, host] of js.matchAll(/fetch\(\s*['"`]https?:\/\/([^/'"`]+)/g)) bad.push(`${relative(ROOT, f)}: fetch to ${host}`);
    }
    assert(!bad.length, bad.join('\n'));
  });
  await test('data files are valid and reasonably small', async () => {
    for (const f of ['assets/data/land.json', 'cases/index.json']) {
      const s = await stat(join(ROOT, f));
      JSON.parse(await readFile(join(ROOT, f), 'utf8'));
      assert(s.size < 8 * 1024 * 1024, `${f} is ${Math.round(s.size / 1024)} KB`);
    }
  });
  await test('GitHub Pages files present (.nojekyll, robots.txt)', async () => {
    assert(await exists(join(ROOT, '.nojekyll')), '.nojekyll missing');
    assert((await readFile(join(ROOT, 'robots.txt'), 'utf8')).includes('/evidence/'), 'robots trail missing');
  });
  await test('personal placeholders filled in', async () => {
    const html = await readFile(join(ROOT, 'index.html'), 'utf8');
    const left = [...new Set(html.match(/%%[A-Z0-9_]+%%/g) || [])];
    const og = html.match(/property="og:url" content="([^"]*)"/)?.[1];
    if (og && !og.includes('%%')) assert(/^https:\/\/[^\s/]+\.[^\s/]+\/?/.test(og), `og:url must be the site URL (https://…), got "${og}"`);
    assert(!left.length,`still to fill: ${left.join(', ')}${release ? '' : ' (fine for now, required before publishing)'}`);
  }, { warnOnly: !release });
}
