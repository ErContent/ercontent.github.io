import { keyMaterial, geoMaterial } from './normalize.js';
import { encode as geohash } from './geohash.js';
import { deriveRaw, unseal, toB64, fromB64 } from './vault.js';
import { scramble, REDUCED } from './fx.js';
import { fire, onFire, isFound, matches, resetHints } from './hints.js';
import { loadLeaflet, osmLayer, pinIcon, coordButton } from './geo.js';

const STORE = 'dossier.v1';
const WRONG = 'Io la ringrazio e le auguro il meglio.';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nnn = (n) => String(n).padStart(3, '0');
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtSize = (b) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`);

let index = null;
const bodies = new Map(); // id -> decrypted or public content
let state = load();
let lastFocus = null;
let hiddenCase = null;

function load() {
  const empty = { solved: {}, geo: {}, seen: {}, opened: {}, fails: {}, hints: {} };
  try { return { ...empty, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; }
  catch { return empty; }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode: progress lasts for this visit */ }
}

/* ---------- Toast ---------- */
let toastTimer;
export function toast(main, sub = '') {
  const t = $('#toast');
  t.innerHTML = `<p class="t-main" lang="${main === WRONG ? 'it' : 'en'}">${esc(main)}</p>${sub ? `<p class="t-sub">${esc(sub)}</p>` : ''}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 6000);
}

/* ---------- Content access ---------- */
async function contentOf(c) {
  if (bodies.has(c.id)) return bodies.get(c.id);
  if (c.open) { bodies.set(c.id, c.content); return c.content; }
  const prev = state.solved[c.lockedBy];
  if (!prev) return null;
  const body = await unseal(fromB64(prev.k), c.locked);
  if (body) bodies.set(c.id, body);
  return body;
}

/* ---------- List ---------- */
async function renderList() {
  const list = $('#case-list');
  const rows = [];
  for (const c of index.cases) {
    const body = await contentOf(c);
    if (!body) {
      rows.push(`<li class="case-row"><div class="case-locked">
        <span class="case-n" aria-hidden="true">${nnn(c.n)}</span>
        <span><span class="case-title"><span class="glitch" aria-hidden="true">${'#'.repeat(22)}</span><span class="sr">Case ${nnn(c.n)}, classified</span></span>
        <span class="case-tags"><span>AES-256-GCM</span><span>close case ${nnn(c.n - 1)} to decrypt</span></span></span>
        <span class="case-status st-locked">Locked</span></div></li>`);
      continue;
    }
    const closed = !!state.solved[c.id];
    rows.push(`<li class="case-row"><a class="case-link" href="#${c.id}" aria-label="Case ${nnn(c.n)}: ${esc(body.title)}, ${closed ? 'closed' : 'open'}">
      <span class="case-n" aria-hidden="true">${nnn(c.n)}</span>
      <span><span class="case-title">${esc(body.title)}</span>
      <span class="case-tags">${(body.tags || []).map((t) => `<span>${esc(t)}</span>`).join('')}${body.difficulty ? `<span>${esc(body.difficulty)}</span>` : ''}</span></span>
      <span class="case-status ${closed ? 'st-closed' : 'st-open'}">${closed ? 'Closed' : 'Open'}</span></a></li>`);
  }
  if (index.cases.every((c) => state.solved[c.id])) {
    rows.push('<li class="all-closed"><strong>Every case is closed.</strong>New files are on the way. Check back soon.</li>');
  }
  list.innerHTML = rows.join('');
}

// Locked titles keep churning like ciphertext
setInterval(() => {
  if (REDUCED) return;
  document.querySelectorAll('.glitch').forEach((g) => {
    g.textContent = Array.from({ length: 22 }, () => '0123456789abcdef'[(Math.random() * 16) | 0]).join('').replace(/(.{4})/g, '$1 ').trim();
  });
}, 120);

/** Short "decrypting" sequence the first time a locked case is opened. */
function decryptFx(label) {
  if (REDUCED) return Promise.resolve();
  const box = $('#decrypt'), rain = $('#decrypt-rain'), msg = $('#decrypt-msg');
  box.hidden = false;
  msg.textContent = label;
  const cols = Math.ceil(innerWidth / 9), rows = Math.ceil(innerHeight / 17);
  const t0 = performance.now();
  return new Promise((res) => {
    const f = (now) => {
      let out = '';
      for (let r = 0; r < rows; r++) { for (let c = 0; c < cols; c++) out += Math.random() < 0.5 ? '0123456789abcdef'[(Math.random() * 16) | 0] : ' '; out += '\n'; }
      rain.textContent = out;
      if (now - t0 < 1300) requestAnimationFrame(f); else { box.hidden = true; res(); }
    };
    requestAnimationFrame(f);
    scramble(msg, { duration: 1100 });
  });
}

/* ---------- Files ---------- */
const MIME = { pdf: 'application/pdf', txt: 'text/plain;charset=utf-8', md: 'text/plain;charset=utf-8', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
function fileUrl(f) {
  if (f.path) return f.path;
  const ext = f.name.split('.').pop().toLowerCase();
  return URL.createObjectURL(new Blob([fromB64(f.data)], { type: MIME[ext] || 'application/octet-stream' }));
}
async function fileText(f) {
  if (f.data) return new TextDecoder().decode(fromB64(f.data));
  const r = await fetch(f.path);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

/* ---------- Room ---------- */
async function openRoom(id) {
  const c = index.cases.find((x) => x.id === id);
  const body = c && (await contentOf(c));
  if (!body) {
    history.replaceState(null, '', '#cases');
    closeRoom();
    toast('That file is still locked.', c ? `Close case ${nnn(c.n - 1)} first.` : 'There is no case with that number.');
    return;
  }
  const room = $('#room');
  room.dispatchEvent(new Event('room-close'));
  lastFocus = lastFocus || document.activeElement;
  if (!c.open && !state.seen[c.id]) {
    state.seen[c.id] = true; save();
    await decryptFx(`Decrypting case ${nnn(c.n)}`);
  }
  state.opened[c.id] ||= Date.now(); save();
  $('#room-id').textContent = `case_${nnn(c.n)}.enc  /  ${nnn(c.n)} of ${nnn(index.cases.length)}`;
  $('#room-body').innerHTML = roomHTML(c, body);
  room.hidden = false;
  document.body.classList.add('room-open');
  room.scrollTop = 0;
  $('#room-title').focus({ preventScroll: true });
  scramble($('#room-title'), { duration: 700 });
  wireRoom(c, body);
}

function closeRoom() {
  const room = $('#room');
  if (room.hidden) return;
  room.hidden = true;
  document.body.classList.remove('room-open');
  $('#room-body').innerHTML = '';
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  lastFocus = null;
}

function roomHTML(c, b) {
  const solved = state.solved[c.id];
  const next = index.cases.find((x) => x.n === c.n + 1);
  const files = (b.files || []).map((f, i) => `<li>
      <span class="fname">${esc(f.name)}</span><span class="fsize">${fmtSize(f.size)}</span>
      ${f.preview ? `<button type="button" data-preview="${i}" aria-expanded="false">${f.preview === 'image' ? 'View' : 'Preview'}</button>` : ''}
      <a href="#" data-dl="${i}" download="${esc(f.name)}">Download</a></li>`).join('');

  const casefile = `<article class="casefile${solved ? ' is-closed' : ''}">
    ${solved ? '<div class="closed-stamp" aria-hidden="true">Case closed</div>' : ''}
    <p class="kicker">Case ${nnn(c.n)}${b.difficulty ? `, difficulty ${esc(b.difficulty.toLowerCase())}` : ''}</p>
    <h2 id="room-title" tabindex="-1">${esc(b.title)}</h2>
    <p class="case-tags">${(b.tags || []).map((t) => `<span>${esc(t)}</span>`).join('')}</p>
    <p class="brief">${esc(b.brief)}</p>
    <section class="evidence" aria-labelledby="ev-title"><h3 id="ev-title">Evidence</h3>
      ${files ? `<ul>${files}</ul>` : '<p>No attachments: everything you need is in the brief.</p>'}
      <pre class="preview" id="preview" hidden tabindex="0"></pre>
      <figure class="img-preview" id="img-preview" hidden><img alt=""><figcaption></figcaption></figure>
    </section></article>`;

  let tools;
  if (solved) {
    tools = `<section class="panel solved-box" aria-labelledby="solved-title"><h3 id="solved-title">Case closed</h3>
      <p>You closed this case on ${fmtDate(solved.at)}.</p>
      ${c.after ? '<p class="after" id="after-box">Decrypting the location…</p>' : ''}
      ${next ? `<a class="next-link" href="#${next.id}">Open case ${nnn(next.n)}</a>` : '<p>That was the last file. New ones are on the way.</p>'}</section>`;
  } else {
    const geo = b.geo;
    const geoOk = !geo || !geo.gate || state.geo[c.id];
    const geoDone = geo && state.geo[c.id];
    const geoPanel = geo ? `<section class="panel" aria-labelledby="geo-title"><h3 id="geo-title">Locate</h3>
      <p>${esc(geo.prompt)} Click the map or type the coordinates, then check the pin.${geo.gate ? '' : ' Optional: it only confirms you are in the right place.'}</p>
      <div class="map" id="map" role="application" aria-label="Map. Click to drop a pin."></div>
      <div class="map-row">
        <div class="field"><label for="coords">Coordinates (lat, lon)</label><input class="input" id="coords" inputmode="decimal" autocomplete="off" placeholder="40.0000, 14.0000"></div>
        <button class="btn-ghost" type="button" id="drop-pin">Drop pin</button>
        <button class="btn-act" type="button" id="check-geo" disabled>Check location</button>
      </div>
      <p class="status ${geoDone ? 'ok' : ''}" id="geo-status" role="status">${geoDone ? 'Location confirmed. Now finish the case.' : ''}</p></section>` : '';

    let fields = '';
    if (b.kind === 'phrase+phone') {
      fields = `<div class="field"><label for="f-phrase">${esc(b.fields?.phrase || 'Phrase')}</label><input class="input" id="f-phrase" autocomplete="off" spellcheck="false"></div>
        <div class="field"><label for="f-phone">${esc(b.fields?.phone || 'Phone number')}</label>
        <input class="input" id="f-phone" type="tel" autocomplete="off" ${geoOk ? '' : 'disabled aria-describedby="phone-hint"'}>
        ${geoOk ? '' : '<span class="hint" id="phone-hint">Locate the place on the map first.</span>'}</div>`;
    } else if (b.kind === 'date') {
      fields = `<div class="field"><label for="f-date">${esc(b.fields?.date || 'Date')}</label><input class="input" id="f-date" type="date" min="1000-01-01" max="2100-12-31"></div>`;
    } else {
      fields = `<div class="field"><label for="f-text">${esc(b.fields?.text || 'Answer')}</label><input class="input" id="f-text" autocomplete="off" spellcheck="false"></div>`;
    }
    tools = `${geoPanel}<section class="panel" aria-labelledby="ans-title"><h3 id="ans-title">Close the case</h3>
      <p>Spelling, spaces, accents and leetspeak don’t matter.</p>
      <form id="answer-form" novalidate>${fields}
        <p class="or">or</p>
        <div class="field"><label for="f-flag">Paste the full flag</label><input class="input" id="f-flag" autocomplete="off" spellcheck="false" placeholder="npw{...}"></div>
        <button class="btn-act" type="submit" id="check-answer">Check answer</button>
        <p class="status" id="ans-status" role="status"></p>
      </form></section>`;
  }
  return `${casefile}<div class="tools">${tools}${hintsPanel(b)}</div>`;
}

function wireRoom(c, b) {
  const root = $('#room-body');
  const urls = [];

  root.querySelectorAll('[data-dl]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const f = b.files[+a.dataset.dl];
      if (!a.dataset.ready) {
        e.preventDefault();
        const u = fileUrl(f);
        if (!f.path) urls.push(u);
        a.href = u; a.dataset.ready = '1'; a.click();
      }
    });
  });

  root.querySelectorAll('[data-preview]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pre = $('#preview'), fig = $('#img-preview');
      const open = btn.getAttribute('aria-expanded') === 'true';
      root.querySelectorAll('[data-preview]').forEach((x) => x.setAttribute('aria-expanded', 'false'));
      pre.hidden = true; fig.hidden = true;
      if (open) return;
      const f = b.files[+btn.dataset.preview];
      if (f.preview === 'image') {
        const u = fileUrl(f);
        if (!f.path) urls.push(u);
        fig.querySelector('img').src = u;
        fig.querySelector('img').alt = `Evidence: ${f.name}`;
        fig.querySelector('figcaption').textContent = `${f.name}. Open it in a new tab to zoom, or download it for reverse search.`;
        fig.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        return;
      }
      try {
        const txt = await fileText(b.files[+btn.dataset.preview]);
        const wide = txt.split('\n').some((l) => l.length > 90);
        pre.className = `preview${wide ? '' : ' is-prose'}`;
        pre.textContent = txt;
        pre.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
      } catch {
        toast('The preview could not be loaded.', 'Download the file instead.');
      }
    });
  });

  renderHints(b);
  roomCtx = { c, b };
  $('#room').addEventListener('room-close', () => { roomCtx = null; }, { once: true });
  if (state.solved[c.id] && c.after) showAfter(c);
  if (!state.solved[c.id]) {
    if (b.geo) wireGeo(c, b);
    $('#answer-form').addEventListener('submit', (e) => { e.preventDefault(); checkAnswer(c, b); });
  }

  $('#room').addEventListener('room-close', () => urls.forEach(URL.revokeObjectURL), { once: true });
}

/* ---------- Hints: found by doing things around the site ---------- */
let roomCtx = null;
export function hintsPanel(b) {
  if (!(b.hints || []).length) return '';
  return `<section class="panel hints" aria-labelledby="hints-title"><h3 id="hints-title">Hints <span class="h-count" id="h-count"></span></h3>
    <p>Nobody hands them out. They are hidden around this site: investigate, and some of the things you do will leave one behind.</p>
    <ol class="hint-list" id="hint-list"></ol></section>`;
}
export function renderHints(b, fresh) {
  const ol = $('#hint-list');
  if (!ol) return;
  const hs = b.hints || [];
  ol.innerHTML = hs.map((h, i) => isFound(h)
    ? `<li class="hint-item is-open${fresh && matches(h, fresh) ? ' is-new' : ''}"><span class="h-n">#${i + 1}</span><p>${esc(h.text)}</p></li>`
    : `<li class="hint-item is-locked"><span class="h-n">#${i + 1}</span><span class="h-lock">Not found yet</span></li>`).join('');
  $('#h-count').textContent = `${hs.filter(isFound).length}/${hs.length}`;
  const p = ol.querySelector('.is-new p');
  if (p) scramble(p, { duration: 700 });
}

/** When an action fires, tell the visitor if it belongs to a file they can read. */
async function announce(h) {
  for (const c of index?.cases || []) {
    const b = await contentOf(c);
    const i = (b?.hints || []).findIndex((x) => matches(x, h));
    if (i >= 0) { toast(`You found a hint for case ${nnn(c.n)}.`, `Hint #${i + 1} is now in the case file.`); break; }
  }
  if (hiddenCase && (hiddenCase.content.hints || []).some((x) => matches(x, h))) toast('Something surfaced.', 'It belongs to a file that is not in the archive.');
  if (roomCtx) renderHints(roomCtx.b, h);
}

async function showAfter(c) {
  const box = $('#after-box');
  const where = await unseal(fromB64(state.solved[c.id].k), c.after);
  if (box && where) box.innerHTML = `Where it was: ${coordButton(where.lat, where.lon, 'Case ' + nnn(c.n), 5)}`;
  else if (box) box.remove();
}

/* ---------- Public API for the terminal ---------- */
export const api = {
  cases: () => index?.cases || [],
  contentOf,
  isSolved: (id) => !!state.solved[id],
  solvedAt: (id) => state.solved[id]?.at,
  fails: (id) => state.fails[id] || 0,
  /** Checks a flag from the terminal. Returns true, false or null (unparseable). */
  async submit(c, b, flag) {
    const material = keyMaterial(c.id, b.kind, { flag });
    if (!material) return null;
    const ck = await openSeals(c, material);
    if (!ck) { state.fails[c.id] = (state.fails[c.id] || 0) + 1; save(); return false; }
    state.solved[c.id] = { k: ck, at: new Date().toISOString() }; save();
    await renderList();
    return true;
  },
  toast,
};

/* ---------- Map ---------- */
export { loadLeaflet };

/** Derives the answer key once and tries every accepted-answer seal. Returns the case key (base64) or null. */
export async function openSeals(c, material) {
  const raw = await deriveRaw(material, c.salt, c.iterations);
  for (const box of c.seals) { const v = await unseal(raw, box); if (v?.ck) return v.ck; }
  return null;
}

async function wireGeo(c, b) {
  const coords = $('#coords'), checkBtn = $('#check-geo'), status = $('#geo-status');
  let pin = null, marker = null, map = null;

  const setPin = (lat, lon, fly) => {
    pin = { lat, lon };
    coords.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    checkBtn.disabled = false;
    if (map) {
      marker ? marker.setLatLng([lat, lon]) : (marker = window.L.marker([lat, lon], { icon: pinIcon(window.L), keyboard: false }).addTo(map));
      if (fly) map.setView([lat, lon], Math.max(map.getZoom(), 17));
    }
  };

  try {
    const L = await loadLeaflet();
    if (!document.contains($('#map'))) return;
    map = L.map('map', { worldCopyJump: true, zoomControl: true }).setView([30, 5], 2);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" rel="noopener">Leaflet</a>');
    osmLayer(L).addTo(map);
    map.on('click', (e) => setPin(e.latlng.lat, L.Util.wrapNum(e.latlng.lng, [-180, 180], true), false));
  } catch {
    $('#map').innerHTML = '<p style="padding:16px">The map could not load. You can still type the coordinates below.</p>';
  }

  $('#drop-pin').addEventListener('click', () => {
    const m = coords.value.replace(/[°NnEe]/g, ' ').match(/(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)/);
    const lat = m && parseFloat(m[1].replace(',', '.')), lon = m && parseFloat(m[2].replace(',', '.'));
    if (!m || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      status.className = 'status err';
      status.textContent = 'Use the format latitude, longitude: for example 40.8518, 14.2681.';
      return;
    }
    status.textContent = '';
    setPin(lat, lon, true);
  });
  coords.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#drop-pin').click(); } });

  checkBtn.addEventListener('click', async () => {
    if (!pin) return;
    checkBtn.disabled = true; checkBtn.textContent = 'Checking…';
    const g = b.geo;
    const raw = await deriveRaw(geoMaterial(c.id, geohash(pin.lat, pin.lon, g.precision)), g.salt, g.iterations);
    let ok = false;
    for (const box of g.boxes) if (await unseal(raw, box)) { ok = true; break; }
    checkBtn.textContent = 'Check location';
    if (ok) {
      state.geo[c.id] = true; save();
      status.className = 'status ok';
      status.innerHTML = `Location confirmed at ${coordButton(pin.lat, pin.lon, 'Your pin', 5)} Now finish the case.`;
      fire(`geo:${c.id}`);
      const phone = $('#f-phone');
      if (phone) { phone.disabled = false; phone.removeAttribute('aria-describedby'); $('#phone-hint')?.remove(); phone.focus(); }
    } else {
      checkBtn.disabled = false;
      status.className = 'status err';
      status.textContent = 'Not there. Move the pin and check again.';
      toast(WRONG, 'The pin is not where the case points.');
    }
  });
}

/* ---------- Answer ---------- */
async function checkAnswer(c, b) {
  const btn = $('#check-answer'), status = $('#ans-status');
  const answer = {
    flag: $('#f-flag').value.trim(),
    phrase: $('#f-phrase')?.value, phone: $('#f-phone')?.value,
    date: $('#f-date')?.value, text: $('#f-text')?.value,
  };
  // fields and flag are tried separately: a stale wrong flag must not hide right fields
  const materials = [...new Set([
    keyMaterial(c.id, b.kind, { ...answer, flag: '' }),
    answer.flag ? keyMaterial(c.id, b.kind, { flag: answer.flag }) : null,
  ].filter(Boolean))];
  if (!materials.length) {
    status.className = 'status err';
    status.textContent = 'Fill in every field, or paste the full flag.';
    return;
  }
  btn.disabled = true; btn.textContent = 'Checking…'; status.textContent = '';
  let ck = null;
  for (const m of materials) if ((ck = await openSeals(c, m))) break;
  btn.disabled = false; btn.textContent = 'Check answer';
  if (!ck) {
    status.className = 'status err';
    status.textContent = 'That answer doesn’t close the case.';
    state.fails[c.id] = (state.fails[c.id] || 0) + 1; save();
    document.querySelectorAll('#answer-form .input:not(:disabled)').forEach((i) => { i.classList.remove('shake'); void i.offsetWidth; i.classList.add('shake'); });
    toast(WRONG, 'That answer doesn’t close the case. Check it and try again.');
    return;
  }
  state.solved[c.id] = { k: ck, at: new Date().toISOString() };
  save();
  await renderList();
  await openRoom(c.id);
  $('.closed-stamp')?.classList.add('is-new');
  $('#solved-title')?.focus();
}

/* ---------- Router ---------- */
async function route() {
  const m = location.hash.match(/^#(case-\d{3})$/);
  if (m) await openRoom(m[1]);
  else { $('#room').dispatchEvent(new Event('room-close')); closeRoom(); }
}

export async function initCases() {
  try {
    const r = await fetch('cases/index.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    index = await r.json();
  } catch {
    $('#case-list').innerHTML = '<li class="all-closed"><strong>The archive did not load.</strong>Reload the page to try again.</li>';
    return;
  }
  await renderList();
  fetch('cases/hidden.json').then((r) => (r.ok ? r.json() : null)).then((h) => { hiddenCase = h; }).catch(() => {});
  onFire(announce);
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#room').hidden) location.hash = 'cases';
  });
  $('#room').addEventListener('click', (e) => {
    if (e.target.closest('.room-back')) lastFocus = document.querySelector(`a[href="${location.hash}"]`) || lastFocus;
  });
  $('#reset-progress').addEventListener('click', async () => {
    if (!confirm('Reset your progress? Closed cases lock again and found hints are forgotten.')) return;
    try { localStorage.removeItem(STORE); localStorage.removeItem('hidden.v1'); } catch { /* storage unavailable */ }
    if (!$('#room').hidden) location.hash = 'cases';
    state = load();
    resetHints();
    bodies.clear();
    save();
    await renderList();
    toast('Progress reset.', 'Case 001 is waiting.');
  });
  route();
}
