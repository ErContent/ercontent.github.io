import { api } from './cases.js';
import { fire, isFound } from './hints.js';
import { loadLeaflet, osmLayer, coordButton } from './geo.js';
import { encode as geohash } from './geohash.js';
import { REDUCED } from './fx.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nnn = (n) => String(n).padStart(3, '0');
const WRONG = 'Io la ringrazio e le auguro il meglio.';
const PROMPT = 'ercontent77@osint:~$';

let root, out, input, hist = [], hIdx = 0, busy = false;

/* ---------- Output helpers ---------- */
function line(html = '', cls = '') {
  const d = document.createElement('div');
  d.className = `t-line ${cls}`;
  d.innerHTML = html;
  out.append(d);
  out.scrollTop = out.scrollHeight;
  return d;
}
async function lines(arr, delay = REDUCED ? 0 : 18) {
  for (const l of arr) {
    Array.isArray(l) ? line(l[0], l[1]) : line(l);
    if (delay) await new Promise((r) => setTimeout(r, delay));
  }
}
const pad = (s, n) => String(s).padEnd(n, ' ').replace(/ /g, '&nbsp;');

/* ---------- Case helpers ---------- */
function findCase(arg) {
  const n = parseInt(String(arg ?? '').replace(/\D/g, ''), 10);
  return api.cases().find((c) => c.n === n);
}
async function needCase(arg, cmd) {
  const c = findCase(arg);
  if (!c) { line(`${cmd}: which case? usage: <span class="acc">${cmd} 1</span>`, 'err'); return null; }
  const b = await api.contentOf(c);
  if (!b) { line(`${cmd}: case ${nnn(c.n)} is encrypted. close case ${nnn(c.n - 1)} first.`, 'err'); return null; }
  return { c, b };
}

/* ---------- Geo helpers ---------- */
const PLACES = { napoli: [40.8518, 14.2681], naples: [40.8518, 14.2681], vesuvio: [40.8213, 14.4261], maradona: [40.828, 14.1931], fuorigrotta: [40.828, 14.1931] };
function parseLatLon(args) {
  const s = args.join(' ').trim().toLowerCase();
  if (PLACES[s]) return PLACES[s];
  const m = s.replace(/[°nNeE]/g, ' ').match(/(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(',', '.')), lon = parseFloat(m[2].replace(',', '.'));
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
}
const dms = (v, pos, neg) => {
  const a = Math.abs(v), d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf), s = ((mf - m) * 60).toFixed(2);
  return `${d}°${String(m).padStart(2, '0')}'${s.padStart(5, '0')}"${v >= 0 ? pos : neg}`;
};

/* ---------- Fun ---------- */
function confetti() {
  if (REDUCED) return;
  const cv = document.createElement('canvas');
  cv.className = 'confetti';
  document.body.append(cv);
  const ctx = cv.getContext('2d'), W = (cv.width = innerWidth), H = (cv.height = innerHeight);
  const P = Array.from({ length: 220 }, () => ({ x: W / 2 + (Math.random() - 0.5) * 200, y: H * 0.7, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 18 - 6, r: Math.random() * 6 + 3, c: ['#1C9AD6', '#62C4F0', '#FFFFFF', '#0E2A47'][(Math.random() * 4) | 0], a: Math.random() * 6 }));
  const t0 = performance.now();
  const f = (now) => {
    ctx.clearRect(0, 0, W, H);
    for (const p of P) { p.vy += 0.45; p.x += p.vx; p.y += p.vy; p.a += 0.2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
    now - t0 < 3200 ? requestAnimationFrame(f) : cv.remove();
  };
  requestAnimationFrame(f);
}
function shake() { if (!REDUCED) document.body.animate([{ transform: 'translate(0)' }, { transform: 'translate(-8px,3px)' }, { transform: 'translate(7px,-4px)' }, { transform: 'translate(-5px,2px)' }, { transform: 'translate(0)' }], { duration: 420 }); }

/* ---------- DOGMA ---------- */
function dogma() {
  document.querySelector('.dogma')?.remove();
  const el = document.createElement('div');
  el.className = 'dogma';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Dogma');
  el.innerHTML = `<div class="dogma-plate" lang="la">
      <p class="dogma-1">Verbum meum<br>unicum verbum est.</p>
      <span class="dogma-rule" aria-hidden="true"></span>
      <p class="dogma-2">Verba ventus aufert;<br>mea non.</p>
    </div>
    <p class="dogma-hint">click or press any key</p>`;
  document.body.append(el);
  let timer, closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer); clearTimeout(arm); removeEventListener('keydown', onKey, true);
    el.classList.add('out'); setTimeout(() => el.remove(), 500); input?.focus();
  };
  const onKey = (e) => { e.preventDefault(); e.stopPropagation(); close(); };
  // let the Enter that launched the command finish before listening for keys;
  // cleared on close, or an early click would leave a listener that swallows the next key
  const arm = setTimeout(() => addEventListener('keydown', onKey, true), 300);
  el.addEventListener('click', close);
  timer = setTimeout(close, 9000);
}

/* ---------- Commands ---------- */
const OSINT = {
  geoint: { name: 'GEOINT', what: 'Where was this taken?', steps: ['Read the scene: language on signs, driving side, plates, vegetation, architecture.', 'Measure shadows: direction and length give orientation and time of day.', 'Match the skyline or terrain against satellite imagery and street-level photos.', 'Confirm with two independent features before you commit to a pin.'], tools: ['Satellite & street-level imagery', 'SunCalc (sun position)', 'Overpass Turbo (OpenStreetMap queries)', 'PeakVisor (mountain ridges)'] },
  imint: { name: 'IMINT', what: 'What does the image itself reveal?', steps: ['Run reverse image search on several engines: they index differently.', 'Crop to the distinctive part and search again.', 'Look for reflections, screens, papers: zoom is evidence.', 'Check for edits: lighting, edges, compression artifacts.'], tools: ['Reverse image search engines', 'Forensically / error level analysis', 'ExifTool'] },
  socmint: { name: 'SOCMINT', what: 'Who is behind the account?', steps: ['Collect every username variant and check reuse across platforms.', 'Compare avatars by hash, not by eye.', 'Build a timeline of posts: time zones leak.', 'Map the network: who replies, who tags, who follows back.'], tools: ['Username enumeration tools', 'Platform advanced search', 'Archived profiles'] },
  meta: { name: 'METADATA', what: 'What do the files remember?', steps: ['Dump all metadata, not just EXIF: XMP, IPTC, document properties.', 'Authors, software versions and timestamps tie files together.', 'PDFs keep revision history: look at incremental updates.', 'Absence is evidence too: stripped metadata means someone cared.'], tools: ['ExifTool', 'pdfinfo / qpdf', 'strings'] },
  archive: { name: 'ARCHIVE', what: 'What did it look like before?', steps: ['Check web archives for deleted pages and old versions.', 'Cached copies and mirrors outlive the original.', 'Old usernames and emails survive in archived pages.'], tools: ['Wayback Machine', 'archive.today', 'Search engine caches'] },
  history: { name: 'HISTINT', what: 'What happened, and when?', steps: ['Dates are anchors: pin every clue to a year, then a day.', 'Broadcast schedules, match reports and newspapers are timestamped.', 'Biographies disagree: confirm a date in two primary sources.'], tools: ['Newspaper archives', 'Broadcaster histories', 'Library catalogues'] },
};

const FIELDGUIDE = [
  '<span class="acc">fieldguide</span> <span class="dim">notes from the bench. read them twice.</span>',
  '&nbsp;',
  '<span class="acc">look before you search</span>',
  '&nbsp;&nbsp;if a text looks like a drawing, ask whether it is a writing system: fingerspelling charts (ASL, LIS) are one search away.',
  '&nbsp;&nbsp;charts and plots can hide a grid. count rows and columns, and check which axis is which.',
  '<span class="acc">places</span>',
  '&nbsp;&nbsp;coordinates come in many shapes: decimal, DMS, geohash, what3words. convert before you compare.',
  '&nbsp;&nbsp;GeoHints-style meta (bollards, road lines, plates, signs) tells you the country before Street View tells you the street.',
  '&nbsp;&nbsp;a coastline can have a familiar shape. maps are images too.',
  '&nbsp;&nbsp;every venue has an address, and every street is named after something. follow the name.',
  '<span class="acc">images</span>',
  '&nbsp;&nbsp;a distorted photo is a perspective problem: straighten it (GIMP, Photopea) before reverse searching it.',
  '&nbsp;&nbsp;reverse image search on more than one engine. crop to the detail that matters.',
  '<span class="acc">time</span>',
  '&nbsp;&nbsp;broadcasters, programmes and stations have founding dates. archives (Wayback Machine, newspapers) keep them.',
  '&nbsp;&nbsp;a story told in a brief is a timeline. pin each sentence to a year.',
  '<span class="acc">people</span>',
  '&nbsp;&nbsp;reverse email lookup (Epieos, OSINT Industries) and username reuse checks: only on what you are allowed to investigate.',
  '&nbsp;&nbsp;cemetery registries and memorial sites are public records with addresses, sides and inscriptions.',
  '<span class="acc">this site</span>',
  '&nbsp;&nbsp;hints are not handed out. things that look alive can be touched, files remember, maps answer when you point at them.',
  '&nbsp;&nbsp;flags love leetspeak. the checker does not: plain words work too.',
];

const CMDS = {
  help: { d: 'list commands', run: () => lines([
    '<span class="acc">investigation</span>',
    ...[['ls', 'list cases'], ['ls 1', 'list evidence of case 001'], ['cat 1', 'read the brief'], ['open 1', 'open the case file'], ['hint 1', 'hints you have found for case 001'], ['submit 1 npw{...}', 'submit a flag'], ['status', 'your progress']].map(([a, b]) => `&nbsp;&nbsp;${pad(a, 20)}<span class="dim">${b}</span>`),
    '<span class="acc">toolkit</span>',
    ...[['osint [field]', 'methods and tools: geoint imint socmint meta archive history'], ['score', 'Tu vs ErContent'], ['geolocate lat,lon', 'map, DMS and geohash for a point'], ['trace lat,lon', 'lock the globe on a target'], ['exif &lt;file&gt;', 'metadata of a case file'], ['dork &lt;target&gt;', 'search operators to start from']].map(([a, b]) => `&nbsp;&nbsp;${pad(a, 20)}<span class="dim">${b}</span>`),
    '<span class="acc">other</span>',
    `&nbsp;&nbsp;${pad('whoami neofetch', 20)}<span class="dim">about the subject</span>`,
    `&nbsp;&nbsp;${pad('clear history exit', 20)}<span class="dim">terminal</span>`,
    '<span class="dim">tab completes, ↑ ↓ browse history. some commands are not listed.</span>',
  ]) },

  ls: { d: 'list cases or evidence', run: async (a) => {
    if (a[0]) {
      const r = await needCase(a[0], 'ls'); if (!r) return;
      line(`<span class="dim">total ${r.b.files.length}</span>`);
      return lines(r.b.files.map((f) => `-r--r--r--  ${pad(f.size, 8)} ${esc(f.name)}`));
    }
    const rows = [];
    for (const c of api.cases()) {
      const b = await api.contentOf(c);
      const st = api.isSolved(c.id) ? '<span class="ok">[CLOSED]</span>' : b ? '<span class="acc">[OPEN]&nbsp;&nbsp;</span>' : '<span class="err">[LOCKED]</span>';
      rows.push(`${st} ${nnn(c.n)}&nbsp;&nbsp;${b ? `${esc(b.title)} <span class="dim">${(b.tags || []).join(' / ')}</span>` : '<span class="dim">█████████████ encrypted</span>'}`);
    }
    return lines(rows);
  } },

  cat: { d: 'read a brief', run: async (a) => {
    const r = await needCase(a[0], 'cat'); if (!r) return;
    line(`<span class="acc">// case ${nnn(r.c.n)}: ${esc(r.b.title)}</span>`);
    return lines(r.b.brief.split('\n').map((l) => esc(l) || '&nbsp;'), 30);
  } },

  open: { d: 'open a case', run: async (a) => {
    const r = await needCase(a[0], 'open'); if (!r) return;
    line(`opening case_${nnn(r.c.n)}.enc …`, 'ok');
    setTimeout(() => { location.hash = r.c.id; minimize(); }, 300);
  } },

  hint: { d: 'hints found so far', run: async (a) => {
    const r = await needCase(a[0] ?? 1, 'hint'); if (!r) return;
    const hs = r.b.hints || [];
    if (!hs.length) return line('no hints for this case. trust the evidence.', 'dim');
    const found = hs.filter(isFound);
    hs.forEach((h, i) => line(isFound(h) ? `<span class="acc">hint #${i + 1}</span> ${esc(h.text)}` : `<span class="dim">hint #${i + 1} not found yet</span>`));
    if (found.length < hs.length) line('hints are not handed out: they are hidden around the site. investigate.', 'dim');
  } },

  submit: { d: 'submit a flag', run: async (a) => {
    const r = await needCase(a[0], 'submit'); if (!r) return;
    const flag = a.slice(1).join(' ');
    if (!flag) return line('usage: submit 1 npw{...}', 'err');
    if (api.isSolved(r.c.id)) return line(`case ${nnn(r.c.n)} is already closed.`, 'dim');
    line('deriving key (PBKDF2, 600k rounds) …', 'dim');
    const ok = await api.submit(r.c, r.b, flag);
    if (ok === null) return line('that does not look like an answer for this case.', 'err');
    if (!ok) { shake(); line(WRONG, 'err it'); return line(`wrong answers on this case: ${api.fails(r.c.id)}`, 'dim'); }
    line(`case ${nnn(r.c.n)} closed.`, 'ok');
    const next = api.cases().find((x) => x.n === r.c.n + 1);
    line(next ? `case ${nnn(next.n)} decrypted. type <span class="acc">cat ${next.n}</span>` : 'that was the last file. new ones are on the way.', 'ok');
    confetti();
  } },

  status: { d: 'progress', run: async () => {
    const cs = api.cases(), done = cs.filter((c) => api.isSolved(c.id)).length;
    const bar = '█'.repeat(Math.round((done / cs.length) * 24)).padEnd(24, '░');
    return lines([`cases closed&nbsp;&nbsp;${bar} ${done}/${cs.length}`, ...cs.map((c) => `&nbsp;&nbsp;${nnn(c.n)}&nbsp;&nbsp;${api.isSolved(c.id) ? `<span class="ok">closed ${new Date(api.solvedAt(c.id)).toLocaleDateString('en-GB')}</span>` : `<span class="dim">${api.fails(c.id)} wrong answers</span>`}`)]);
  } },

  osint: { d: 'methods and tools', run: (a) => {
    const k = (a[0] || '').toLowerCase();
    if (!OSINT[k]) {
      return lines(['choose a field: <span class="dim">osint &lt;field&gt;</span>', ...Object.entries(OSINT).map(([key, o]) => `&nbsp;&nbsp;${pad(key, 10)}<span class="dim">${o.what}</span>`)]);
    }
    const o = OSINT[k];
    const tagged = api.cases().filter((c) => c.open && (c.content.tags || []).some((t) => [k, o.name.toLowerCase()].includes(t.toLowerCase())));
    return lines([`<span class="acc">${o.name}</span> <span class="dim">${o.what}</span>`, ...o.steps.map((s, i) => `&nbsp;&nbsp;${i + 1}. ${s}`), `<span class="dim">tools:</span> ${o.tools.join(', ')}`, tagged.length ? `<span class="dim">practice:</span> ${tagged.map((c) => `case ${nnn(c.n)}`).join(', ')}` : ''].filter(Boolean), 40);
  } },

  geolocate: { d: 'map a point', run: async (a) => {
    const p = parseLatLon(a);
    if (!p) return line('usage: geolocate 40.8518, 14.2681', 'err');
    const [lat, lon] = p;
    await lines([`lat/lon&nbsp;&nbsp;${coordButton(lat, lon, '', 6)}`, `dms&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${dms(lat, 'N', 'S')} ${dms(lon, 'E', 'W')}`, `geohash&nbsp;&nbsp;${geohash(lat, lon, 9)}`]);
    const box = line('', 't-map');
    try {
      const L = await loadLeaflet();
      const m = L.map(box, { zoomControl: false, attributionControl: true }).setView([lat, lon], 16);
      m.attributionControl.setPrefix('');
      osmLayer(L).addTo(m);
      L.circle([lat, lon], { radius: 75, color: '#E5383B', weight: 1.5, fillOpacity: 0.15 }).addTo(m);
      L.circleMarker([lat, lon], { radius: 5, color: '#fff', weight: 2, fillColor: '#E5383B', fillOpacity: 1 }).addTo(m);
      out.scrollTop = out.scrollHeight;
    } catch { box.textContent = 'map unavailable offline.'; }
  } },

  trace: { d: 'lock the globe', run: async (a) => {
    const p = parseLatLon(a.length ? a : ['napoli']);
    if (!p) return line('usage: trace 40.8518, 14.2681', 'err');
    await lines(['resolving target …', `hops: ${3 + ((Math.random() * 9) | 0)}&nbsp;&nbsp;rtt ${(8 + Math.random() * 40).toFixed(1)} ms`, `<span class="ok">target locked</span> ${coordButton(p[0], p[1])}`], 120);
    window.dispatchEvent(new CustomEvent('globe:focus', { detail: { lat: p[0], lon: p[1] } }));
    if (!$('#room').hidden) return;
    minimize();
    $('#top').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  } },

  exif: { d: 'file metadata', run: async (a) => {
    const name = a[0];
    if (!name) return line('usage: exif silence.pdf', 'err');
    fire(`exif:${name}`);
    for (const c of api.cases()) {
      const b = await api.contentOf(c);
      const f = b?.files?.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (f) {
        const ext = f.name.split('.').pop().toUpperCase();
        return lines([`File Name&nbsp;&nbsp;&nbsp;&nbsp;: ${esc(f.name)}`, `File Size&nbsp;&nbsp;&nbsp;&nbsp;: ${f.size} bytes`, `File Type&nbsp;&nbsp;&nbsp;&nbsp;: ${ext}`, `Case&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${nnn(c.n)}`, `Author&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <span class="err">[stripped]</span>`, '<span class="dim">metadata scrubbed. the subject learned. look inside the file instead.</span>'], 40);
      }
    }
    line(`exif: ${esc(name)}: no such file in any decrypted case`, 'err');
  } },

  dork: { d: 'search operators', run: (a) => {
    const t = a.join(' ').trim() || 'example.org';
    const q = /\s/.test(t) ? `"${t}"` : t;
    const site = /\./.test(t) && !/\s/.test(t);
    return lines(['<span class="dim">starting points, refine from here:</span>', ...(site
      ? [`site:${t} filetype:pdf`, `site:${t} intitle:"index of"`, `site:${t} inurl:login`, `site:${t} -www`, `"@${t}" -site:${t}`]
      : [`${q} filetype:pdf`, `${q} site:linkedin.com`, `${q} "curriculum" OR "cv"`, `${q} before:2015`, `intext:${q} -site:twitter.com`]).map((x) => `&nbsp;&nbsp;<span class="acc">${esc(x)}</span>`), '<span class="dim">only investigate what you are allowed to.</span>']);
  } },

  score: { d: 'night match score', run: () => {
    let st = {};
    try { st = JSON.parse(localStorage.getItem('stadium.v1') || '{}'); } catch { /* storage unavailable */ }
    return lines([`Tu <span class="acc">${st.tu || 0}</span> : <span class="err">${st.er || 0}</span> ErContent`, `<span class="dim">points ${st.pts || 0}, evidence ${(st.clues || []).length}/5</span>`, '<span class="dim">play it in the Night match section.</span>']);
  } },

  whoami: { d: 'about', run: () => lines([document.querySelector('.fields dd')?.textContent || 'subject', '<span class="dim">cyber security engineer. osint, geoint, digital forensics. napwnli #77.</span>']) },

  neofetch: { d: 'system info', run: () => {
    const art = ['    ▄▄▄▄▄▄', '  ▄█▀    ▀█▄', ' █▀  ▄▄▄▄  ▀█', ' █  █    █  █', ' █▄  ▀▀▀▀  ▄█', '  ▀█▄    ▄██▄', '    ▀▀▀▀▀▀  ▀██▄', '              ▀▀'];
    const info = ['<span class="acc">ercontent77@osint</span>', '─────────────────', 'OS: 40.85°N 14.27°E', 'Host: Clanto Services', 'Kernel: MSc Computer Eng. 110L', 'Team: napwnli #77', 'Shell: you’re using it', 'Packages: 2 Q1 journals, 1 book', 'Theme: azzurro on black', 'Uptime: since CyberChallenge.IT'];
    return lines(info.map((l, i) => `<span class="nf-art acc">${art[i] || ''}</span>${l}`), 25);
  } },

  clear: { d: 'clear', run: () => { out.innerHTML = ''; } },
  history: { d: 'history', run: () => lines(hist.map((h, i) => `&nbsp;${String(i + 1).padStart(3, ' ')}&nbsp;&nbsp;${esc(h)}`)) },
  exit: { d: 'close', run: () => close() },

  // unlisted
  fieldguide: { hidden: true, run: async () => {
    let st = {};
    try { st = JSON.parse(localStorage.getItem('stadium.v1') || '{}'); } catch { /* storage unavailable */ }
    if ((st.clues || []).length < 5) return line('fieldguide: permission denied. the pitch is still hiding something.', 'err');
    return lines(FIELDGUIDE, 30);
  } },
  dogma: { hidden: true, run: () => { dogma(); line('verbum meum unicum verbum est.', 'dim'); } },
  rip: { hidden: true, run: () => line('rip: there are more graves than names.', 'dim') },
  77: { hidden: true, run: () => { window.dispatchEvent(new Event('kvara')); line('77 on the pitch. watch the matchday.', 'acc'); minimize(); } },
  kvara: { hidden: true, run: () => CMDS[77].run() },
  sudo: { hidden: true, run: () => { line(WRONG, 'err it'); } },
  rm: { hidden: true, run: (a) => { if (a.join(' ').includes('-rf')) { shake(); line('rm: permission denied. nice try.', 'err'); } else line('rm: evidence cannot be deleted.', 'err'); } },
  ping: { hidden: true, run: async (a) => { const h = a[0] || 'napwnli'; for (let i = 0; i < 4; i++) { line(`64 bytes from ${esc(h)}: icmp_seq=${i} ttl=81 time=${(0.8 + Math.random() * 3).toFixed(2)} ms`); await new Promise((r) => setTimeout(r, 260)); } } },
  forza: { hidden: true, run: (a) => { if ((a[0] || '').toLowerCase() === 'napoli') { confetti(); line('FORZA NAPOLI SEMPRE 💙', 'acc big'); } else line('forza chi?', 'dim'); } },
  cd: { hidden: true, run: () => line('cd: you are exactly where the evidence is.', 'dim') },
  pwd: { hidden: true, run: () => line('/home/ercontent77/cases') },
  date: { hidden: true, run: () => line(new Date().toString()) },
  echo: { hidden: true, run: (a) => line(esc(a.join(' '))) },
  uname: { hidden: true, run: () => line('ErContent77 9.0-azzurro #81 SMP x86_64 GNU/Linux') },
  vim: { hidden: true, run: () => line('you are now trapped. just kidding: :q!', 'dim') },
};
CMDS.cases = CMDS.ls;
CMDS.forzanapoli = { hidden: true, run: () => CMDS.forza.run(['napoli']) };

async function exec(raw) {
  const cmdline = raw.trim();
  line(`<span class="acc">${PROMPT}</span> ${esc(cmdline)}`, 'echo');
  if (!cmdline) return;
  hist.push(cmdline); hIdx = hist.length;
  fire(`cmd:${cmdline}`);
  const [cmd, ...args] = cmdline.split(/\s+/);
  const c = CMDS[cmd.toLowerCase()];
  if (!c) return line(`${esc(cmd)}: command not found. type <span class="acc">help</span>`, 'err');
  busy = true;
  try { await c.run(args); } catch (e) { line(`${esc(cmd)}: ${esc(e.message)}`, 'err'); }
  busy = false;
}

function complete() {
  const v = input.value, parts = v.split(/\s+/);
  if (parts.length === 1) {
    const opts = Object.keys(CMDS).filter((k) => !CMDS[k].hidden && k.startsWith(parts[0]));
    if (opts.length === 1) input.value = `${opts[0]} `;
    else if (opts.length > 1) line(opts.join('&nbsp;&nbsp;'), 'dim');
  } else if (['osint'].includes(parts[0])) {
    const opts = Object.keys(OSINT).filter((k) => k.startsWith(parts[1] || ''));
    if (opts.length === 1) input.value = `osint ${opts[0]}`; else line(opts.join('&nbsp;&nbsp;'), 'dim');
  }
}

/* ---------- Window ---------- */
function open() {
  root.hidden = false;
  root.classList.remove('is-min');
  requestAnimationFrame(() => root.classList.add('is-open'));
  $('#term-launch').setAttribute('aria-expanded', 'true');
  input.focus();
}
function close() {
  root.classList.remove('is-open');
  $('#term-launch').setAttribute('aria-expanded', 'false');
  setTimeout(() => { root.hidden = true; }, REDUCED ? 0 : 250);
  $('#term-launch').focus();
}
function minimize() { root.classList.add('is-min'); }

export function initTerminal() {
  document.body.insertAdjacentHTML('beforeend', `
    <button class="term-launch" id="term-launch" type="button" aria-controls="term" aria-expanded="false"><span class="tl-dot"></span>›_ terminal <kbd>\\</kbd></button>
    <section class="term" id="term" role="dialog" aria-label="Terminal" hidden>
      <header class="term-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="term-title">ercontent77@osint: ~</span>
        <button type="button" class="term-btn" data-act="min" aria-label="Minimize terminal">_</button><button type="button" class="term-btn" data-act="close" aria-label="Close terminal">×</button></header>
      <div class="term-out" id="term-out" role="log" aria-live="polite"></div>
      <form class="term-in" autocomplete="off"><label for="term-input" class="acc">${PROMPT}</label><input id="term-input" spellcheck="false" autocapitalize="off" aria-label="Command"></form>
    </section>`);
  root = $('#term'); out = $('#term-out'); input = $('#term-input');

  $('#term-launch').addEventListener('click', () => (root.hidden || root.classList.contains('is-min') ? open() : close()));
  root.querySelector('[data-act="close"]').addEventListener('click', close);
  root.querySelector('[data-act="min"]').addEventListener('click', minimize);
  root.querySelector('.term-bar').addEventListener('dblclick', () => root.classList.toggle('is-min'));
  out.addEventListener('click', () => input.focus());
  root.querySelector('form').addEventListener('submit', async (e) => { e.preventDefault(); if (busy) return; const v = input.value; input.value = ''; await exec(v); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); complete(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (hIdx > 0) input.value = hist[--hIdx]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hIdx = Math.min(hist.length, hIdx + 1); input.value = hist[hIdx] || ''; }
    else if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
  });
  document.addEventListener('keydown', (e) => {
    if (!['`', '\\'].includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('input, textarea, [contenteditable]') && e.target !== input) return;
    e.preventDefault();
    root.hidden || root.classList.contains('is-min') ? open() : close();
  });
  document.querySelectorAll('[data-open-terminal]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); open(); if (b.dataset.openTerminal) exec(b.dataset.openTerminal); }));

  lines([
    '<span class="acc">ErContent77 shell</span> <span class="dim">v1.0, encrypted case archive mounted</span>',
    'type <span class="acc">help</span> to start, or <span class="acc">ls</span> to see the cases.',
  ], 0);
}
