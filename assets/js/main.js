// Content is visible without JS; animations are enabled only once this module runs.
document.documentElement.classList.add('js');
import { initCases } from './cases.js';
import { scramble, typeText, REDUCED } from './fx.js';
import { initTerminal } from './terminal.js';
import { initStadium } from './stadium.js';
import { fire } from './hints.js';
import { linkify } from './geo.js';
import { encode as geohash } from './geohash.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}, parent) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent?.append(el);
  return el;
};
const onView = (el, cb, opts = { threshold: 0.25 }) => {
  if (!el) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { cb(e.target); io.unobserve(e.target); } }), opts);
  io.observe(el);
};

/* ---------- Basics ---------- */
$('#dossier-date').textContent = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
$('#year').textContent = new Date().getFullYear();
{
  const clock = $('#clock');
  const tick = () => { clock.textContent = new Date().toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour12: false }); };
  tick(); setInterval(tick, 1000);
}

/* ---------- Scroll progress + current nav item ---------- */
{
  const bar = $('#progress');
  const links = $$('.top nav a');
  const sections = links.map((a) => $(a.getAttribute('href')));
  let raf = 0;
  const update = () => {
    raf = 0;
    const h = document.documentElement;
    bar.style.transform = `scaleX(${h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)})`;
    let cur = -1;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.35) cur = i; });
    links.forEach((a, i) => a.classList.toggle('is-current', i === cur));
  };
  // section backgrounds drift at their own depth
  const depthEls = REDUCED ? [] : $$('.sec-bg [data-depth], .sec-bg[data-depth]').map((el) => ({ el, d: +el.dataset.depth, sec: el.closest('section') }));
  const prevUpdate = update;
  const update2 = () => {
    prevUpdate();
    for (const { el, d, sec } of depthEls) {
      const r = sec.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      el.style.transform = `translate3d(0, ${(r.top + r.height / 2 - innerHeight / 2) * d}px, 0)`;
    }
  };
  addEventListener('scroll', () => { raf ||= requestAnimationFrame(() => { raf = 0; update2(); }); }, { passive: true });
  update2();
  update();
}

/* ---------- Reveal + headings + typed commands ---------- */
$$('.reveal').forEach((el, i) => {
  el.style.transitionDelay = el.closest('.exhibits, .timeline') ? `${(i % 8) * 60}ms` : '';
  onView(el, (t) => t.classList.add('in'), { threshold: 0.12 });
});
$$('h1.scramble, h2.scramble').forEach((h) => onView(h, () => scramble(h, { duration: 900 })));
$$('.cmd [data-type]').forEach((s) => {
  const text = s.dataset.type;
  s.textContent = '';
  onView(s, () => typeText(s, text, { speed: 38 }), { threshold: 0.6 });
});

/* ---------- Hero: globe ---------- */
function globe() {
  const cv = $('#globe');
  const ctx = cv.getContext('2d');
  const NAPLES = [40.8518, 14.2681];
  // SSC Napoli trophies, national and international (it.wikipedia palmarès), pinned where they were won.
  const TROPHIES = [
    { name: 'Stadio Diego Armando Maradona', city: 'Naples', lat: 40.828, lon: 14.1931, home: true, wins: [
      ['1987', 'Scudetto', 'clinched 10 May, Napoli 1–1 Fiorentina'],
      ['1990', 'Scudetto', 'clinched 29 April, Napoli 1–0 Lazio'],
      ['2025', 'Scudetto', 'clinched 23 May, Napoli 2–0 Cagliari'],
      ['1990', 'Supercoppa italiana', 'Napoli 5–1 Juventus'],
      ['1976', 'Coppa di Lega Italo-Inglese', 'second leg, Napoli 4–0 Southampton'],
      ['2006', 'Serie C1, group B', 'won with the home crowd at the San Paolo'],
      ['1950', 'Serie B', 'won while playing at the Stadio Arturo Collana, Vomero'],
    ] },
    { name: 'Stadio Friuli', city: 'Udine', lat: 46.0817, lon: 13.2002, wins: [['2023', 'Scudetto', 'clinched 4 May, Udinese 1–1 Napoli, five rounds early']] },
    { name: 'Stadio Olimpico', city: 'Rome', lat: 41.9341, lon: 12.4547, wins: [
      ['1962', 'Coppa Italia', 'final, Napoli 2–1 SPAL, won as a Serie B side'],
      ['1976', 'Coppa Italia', 'final, Napoli 4–0 Verona'],
      ['2012', 'Coppa Italia', 'final, Napoli 2–0 Juventus'],
      ['2014', 'Coppa Italia', 'final, Napoli 3–1 Fiorentina'],
      ['2020', 'Coppa Italia', 'final, Napoli beat Juventus on penalties'],
    ] },
    { name: 'Stadio Atleti Azzurri d’Italia', city: 'Bergamo', lat: 45.7089, lon: 9.6806, wins: [['1987', 'Coppa Italia', 'final second leg, Atalanta 0–1 Napoli']] },
    { name: 'Neckarstadion', city: 'Stuttgart', lat: 48.7924, lon: 9.232, wins: [['1989', 'Coppa UEFA', 'final second leg, Stuttgart 3–3 Napoli']] },
    { name: 'St. Jakob', city: 'Basel', lat: 47.5415, lon: 7.6202, wins: [['1966', 'Coppa delle Alpi', 'group tournament in Switzerland and Italy, Basel 2–4 Napoli on the way']] },
    { name: 'Jassim bin Hamad Stadium', city: 'Doha', lat: 25.2675, lon: 51.4842, wins: [['2014', 'Supercoppa italiana', 'Juventus 2–2 Napoli, 6–5 on penalties']] },
    { name: 'King Saud University Stadium', city: 'Riyadh', lat: 24.7225, lon: 46.6264, wins: [['2025', 'Supercoppa italiana', 'final, Napoli 2–0 Bologna']] },
  ];
  const AWAY = TROPHIES.filter((t) => !t.home);
  const tip = $('#globe-tip'), hero = $('.hero'), wide = matchMedia('(min-width: 961px)');
  let hover = null, hoverByTap = false, tour = 0, tourAt = 0, lastHover = 0, inside = false;
  const showTip = (t, p) => {
    const cr = cv.getBoundingClientRect(), hr = hero.getBoundingClientRect();
    tip.innerHTML = `<p class="gt-place">${t.name}<span>${t.city}</span></p><ul>${t.wins.map(([y, c, d]) => `<li><b>${y}</b> ${c}<span>${d}</span></li>`).join('')}</ul>`;
    tip.hidden = false;
    tip.dataset.site = t.city;
    const x = cr.left - hr.left + p.x, y = cr.top - hr.top + p.y;
    const left = Math.min(hr.width - tip.offsetWidth - 12, Math.max(12, x - tip.offsetWidth - 26));
    tip.style.transform = `translate(${left}px, ${Math.max(70, Math.min(hr.height - tip.offsetHeight - 12, y - 20))}px)`;
  };

  const CITIES = [
    [51.5072, -0.1276], [48.8566, 2.3522], [52.52, 13.405], [40.4168, -3.7038], [41.9028, 12.4964], [45.4642, 9.19],
    [40.7128, -74.006], [37.7749, -122.4194], [55.7558, 37.6173], [35.6762, 139.6503], [1.3521, 103.8198],
    [-33.8688, 151.2093], [25.2048, 55.2708], [-23.5505, -46.6333], [19.4326, -99.1332], [30.0444, 31.2357],
    [59.3293, 18.0686], [50.4501, 30.5234], [28.6139, 77.209], [-1.2921, 36.8219], [64.1466, -21.9426], [43.6532, -79.3832],
    [37.5665, 126.978], [-34.6037, -58.3816], [38.7223, -9.1393], [47.4979, 19.0402], [60.1699, 24.9384],
  ];
  const rad = Math.PI / 180;
  // Fibonacci sphere: the dotted surface
  const DOTS = [];
  for (let i = 0, n = 1400; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    DOTS.push([Math.asin(y) / rad, Math.atan2(Math.sin(th) * r, Math.cos(th) * r) / rad]);
  }
  let target = null, amp = 38;
  let drift = 0, base = -NAPLES[1] - 8, lon0 = base, lat0 = 26, W = 0, R = 0, dpr = 1, running = true, drag = null, last = performance.now(), loopId = 0;
  const arcs = [];
  let sites = [];
  // coastlines (Natural Earth 50m via world-atlas, simplified): [cosφ, sinφ, λ] per point
  let land = null;
  fetch('assets/data/land.json').then((r) => r.json()).then((rings) => {
    land = rings.map((r) => {
      const n = r.length / 2, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const lo = r[2 * i] * rad, la = r[2 * i + 1] * rad; a[3 * i] = Math.cos(la); a[3 * i + 1] = Math.sin(la); a[3 * i + 2] = lo; }
      return a;
    });
    if (REDUCED) draw(performance.now());
  }).catch(() => { /* globe still works without coastlines */ });

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const b = cv.getBoundingClientRect();
    W = b.width; cv.width = W * dpr; cv.height = W * dpr; R = W * 0.44;
    // resizing clears the canvas; without the animation loop it must be redrawn here
    if (REDUCED) draw(performance.now());
  };
  const proj = (lat, lon, lift = 1) => {
    const p = lat * rad, l = (lon + lon0) * rad, p0 = lat0 * rad;
    const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
    return { x: W / 2 + R * lift * Math.cos(p) * Math.sin(l), y: W / 2 - R * lift * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)), v: cosc };
  };
  // screen point -> [lat, lon] on the visible hemisphere
  const unproject = (x, y) => {
    const px = (x - W / 2) / R, py = (W / 2 - y) / R, rho = Math.hypot(px, py);
    if (rho > 1) return null;
    const c = Math.asin(rho), p0 = lat0 * rad, sc = Math.sin(c), cc = Math.cos(c);
    const lat = rho ? Math.asin(cc * Math.sin(p0) + (py * sc * Math.cos(p0)) / rho) : p0;
    const lon = -lon0 * rad + Math.atan2(px * sc, rho * cc * Math.cos(p0) - py * sc * Math.sin(p0));
    return [lat / rad, ((lon / rad + 540) % 360) - 180];
  };
  const toVec = ([la, lo]) => [Math.cos(la * rad) * Math.cos(lo * rad), Math.cos(la * rad) * Math.sin(lo * rad), Math.sin(la * rad)];
  const slerp = (a, b, t) => {
    const A = toVec(a), B = toVec(b), d = Math.acos(Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
    const s = Math.sin(d) || 1, k1 = Math.sin((1 - t) * d) / s, k2 = Math.sin(t * d) / s;
    const v = A.map((x, i) => k1 * x + k2 * B[i]);
    return [Math.asin(v[2]) / rad, Math.atan2(v[1], v[0]) / rad];
  };
  const spawn = () => { const t = AWAY[(Math.random() * AWAY.length) | 0]; arcs.push({ from: [t.lat, t.lon], t: 0, speed: 0.004 + Math.random() * 0.004 }); };

  const draw = (now) => {
    loopId = 0;
    const dt = Math.min(50, now - last); last = now;
    if (hover && hoverByTap && now - lastHover > 2500) { hover = null; hoverByTap = false; }
    if (!drag && !target && !hover && !inside) {
      const site = TROPHIES[tour];
      const wantLon = -site.lon - 7, wantLat = Math.max(-40, Math.min(55, site.lat - 6));
      const k = REDUCED ? 1 : Math.min(1, dt * 0.0022);
      lon0 += (wantLon - lon0) * k; lat0 += (wantLat - lat0) * k;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, W);
    // atmosphere
    const g = ctx.createRadialGradient(W / 2, W / 2, R * 0.85, W / 2, W / 2, R * 1.18);
    g.addColorStop(0, 'rgba(28,154,214,0.10)'); g.addColorStop(1, 'rgba(28,154,214,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, W / 2, R * 1.18, 0, 7); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(W / 2, W / 2, R, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(27,76,126,0.9)'; ctx.lineWidth = 1; ctx.stroke();
    // graticule
    ctx.strokeStyle = 'rgba(14,42,71,0.9)'; ctx.lineWidth = 0.8;
    for (let la = -75; la <= 75; la += 15) { ctx.beginPath(); let pen = false; for (let lo = -180; lo <= 180; lo += 4) { const p = proj(la, lo); if (p.v > 0) { pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); pen = true; } else pen = false; } ctx.stroke(); }
    for (let lo = -180; lo < 180; lo += 15) { ctx.beginPath(); let pen = false; for (let la = -88; la <= 88; la += 4) { const p = proj(la, lo); if (p.v > 0) { pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); pen = true; } else pen = false; } ctx.stroke(); }
    // coastlines
    if (land) {
      const sp0 = Math.sin(lat0 * rad), cp0 = Math.cos(lat0 * rad), L0 = lon0 * rad, cx = W / 2, cy = W / 2;
      ctx.strokeStyle = 'rgba(98,196,240,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const a of land) {
        let pen = false;
        for (let i = 0; i < a.length; i += 3) {
          const cp = a[i], sp = a[i + 1], l = a[i + 2] + L0, cl = Math.cos(l);
          const v = sp0 * sp + cp0 * cp * cl;
          if (v <= 0) { pen = false; continue; }
          const x = cx + R * cp * Math.sin(l), y = cy - R * (cp0 * sp - sp0 * cp * cl);
          pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true;
        }
      }
      ctx.stroke();
    }
    // dots
    for (const [la, lo] of DOTS) { const p = proj(la, lo); if (p.v > 0) { ctx.fillStyle = `rgba(98,196,240,${0.04 + p.v * 0.16})`; ctx.fillRect(p.x, p.y, 1.4, 1.4); } }
    // cities
    for (const c of CITIES) { const p = proj(c[0], c[1]); if (p.v > 0.05) { ctx.fillStyle = `rgba(231,238,245,${0.25 + p.v * 0.5})`; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 7); ctx.fill(); } }
    // arcs converging on Naples
    if (arcs.length < 6 && Math.random() < 0.03) spawn();
    for (let i = arcs.length - 1; i >= 0; i--) {
      const a = arcs[i]; a.t += a.speed * dt / 16;
      const head = Math.min(1, a.t), tail = Math.max(0, a.t - 0.45);
      ctx.beginPath(); let pen = false;
      for (let s = tail; s <= head; s += 0.02) {
        const [la, lo] = slerp(a.from, NAPLES, s); const p = proj(la, lo, 1 + 0.18 * Math.sin(Math.PI * s));
        if (p.v > -0.15) { pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); pen = true; } else pen = false;
      }
      ctx.strokeStyle = 'rgba(229,56,59,0.75)'; ctx.lineWidth = 1.3; ctx.stroke();
      if (a.t < 1) { const [la, lo] = slerp(a.from, NAPLES, head); const p = proj(la, lo, 1 + 0.18 * Math.sin(Math.PI * head)); if (p.v > -0.15) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 7); ctx.fill(); } }
      if (a.t > 1.45) arcs.splice(i, 1);
    }
    // Naples target
    const n = proj(NAPLES[0], NAPLES[1]);
    if (n.v > 0) {
      const pulse = (now / 1400) % 1;
      ctx.strokeStyle = `rgba(28,154,214,${1 - pulse})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(n.x, n.y, 6 + pulse * 26, 0, 7); ctx.stroke();
      ctx.fillStyle = '#1C9AD6'; ctx.beginPath(); ctx.arc(n.x, n.y, 4.5, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(98,196,240,.9)'; ctx.lineWidth = 1;
      const s = 14; ctx.beginPath(); ctx.moveTo(n.x - s - 8, n.y); ctx.lineTo(n.x - s, n.y); ctx.moveTo(n.x + s, n.y); ctx.lineTo(n.x + s + 8, n.y); ctx.moveTo(n.x, n.y - s - 8); ctx.lineTo(n.x, n.y - s); ctx.moveTo(n.x, n.y + s); ctx.lineTo(n.x, n.y + s + 8); ctx.stroke();
    }
    // trophy sites
    const visible = [];
    for (const t of TROPHIES) {
      const p = proj(t.lat, t.lon);
      if (p.v <= 0.05) continue;
      visible.push({ t, p });
      if (t.home) continue;
      const on = hover === t || (!hover && TROPHIES[tour] === t);
      const s = on ? 7 : 4.5;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = on ? '#E7EEF5' : '#1C9AD6'; ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      if (on) { ctx.strokeStyle = 'rgba(98,196,240,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, 12 + ((now / 90) % 8), 0, 7); ctx.stroke(); }
    }
    sites = visible;
    // guided tour of the palmarès when nobody is hovering
    if (!hover && !inside && now - lastHover > 3500 && !REDUCED) {
      if (now - tourAt > 4800) { tour = (tour + 1) % TROPHIES.length; tourAt = now; }
      const cur = visible.find((x) => x.t === TROPHIES[tour]);
      // on narrow screens the globe sits behind the headline: no automatic tooltip, tap a marker instead
      if (cur && wide.matches) showTip(cur.t, cur.p); else if (!hoverByTap) tip.hidden = true;
    }
    if (target) {
      const t = proj(target.lat, target.lon);
      if (t.v > 0) {
        const k = Math.min(1, (now - target.t0) / 900), r = 60 - 46 * k;
        ctx.strokeStyle = '#E5383B'; ctx.lineWidth = 1.5;
        ctx.strokeRect(t.x - r, t.y - r, r * 2, r * 2);
        ctx.beginPath(); ctx.moveTo(t.x - r - 10, t.y); ctx.lineTo(t.x + r + 10, t.y); ctx.moveTo(t.x, t.y - r - 10); ctx.lineTo(t.x, t.y + r + 10); ctx.stroke();
        ctx.font = '700 12px "JetBrains Mono", monospace'; ctx.fillStyle = '#E5383B';
        ctx.fillText(`TARGET ${target.lat.toFixed(4)}, ${target.lon.toFixed(4)}`, t.x + r + 8, t.y + r + 14);
      }
    }
    if (running && !REDUCED && !loopId) loopId = requestAnimationFrame(draw);
  };
  resize();
  addEventListener('resize', resize);
  // loopId guards against a second loop when the globe leaves and re-enters view between two frames
  new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running && !REDUCED && !loopId) { last = performance.now(); loopId = requestAnimationFrame(draw); } }).observe(cv);
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, lon0, lat0 }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    if (drag) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 18;
    for (const s of sites) { const d = Math.hypot(s.p.x - x, s.p.y - y); if (d < bd) { bd = d; best = s; } }
    hover = best ? best.t : null;
    cv.style.cursor = best ? 'pointer' : '';
    if (best) { lastHover = performance.now(); if (tip.dataset.site !== best.t.city || tip.hidden) showTip(best.t, best.p); }
    else if (!tip.hidden && !hoverByTap) tip.hidden = true;
  });
  cv.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { inside = true; if (!hover) tip.hidden = true; } });
  // touch fires pointerleave right after every tap: only a mouse leaving the globe closes the card
  cv.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'mouse') return; inside = false; hover = null; lastHover = performance.now(); tip.hidden = true; });
  cv.addEventListener('pointermove', (e) => { if (!drag || drag.lock) return; lon0 = drag.lon0 + (e.clientX - drag.x) * 0.3; lat0 = Math.max(-60, Math.min(70, drag.lat0 + (e.clientY - drag.y) * 0.3)); if (REDUCED) draw(performance.now()); });
  const end = (e) => {
    if (drag && !drag.lock) {
      base = lon0 - Math.sin(drift) * amp;
      // a tap (no real drag) selects the nearest trophy site
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) {
        const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        let best = null, bd = 26;
        for (const s of sites) { const d = Math.hypot(s.p.x - x, s.p.y - y); if (d < bd) { bd = d; best = s; } }
        if (best) { hover = best.t; hoverByTap = true; lastHover = performance.now() + 4000; showTip(best.t, best.p); fire(`globe:site:${best.t.city.toLowerCase()}`); }
        const ll = unproject(x, y);
        if (ll) fire(`globe:${geohash(ll[0], ll[1], 3)}`);
      }
    }
    if (!drag?.lock) drag = null;
  };
  addEventListener('globe:focus', (e) => {
    const { lat, lon } = e.detail;
    target = { lat, lon, t0: performance.now() };
    const from = { lon: lon0, lat: lat0 }, to = { lon: -lon, lat: Math.max(-60, Math.min(70, lat)) }, t0 = performance.now();
    drag = { lock: true };
    const tw = (now) => { const p = Math.min(1, (now - t0) / 1600), k = 1 - (1 - p) ** 3; lon0 = from.lon + (to.lon - from.lon) * k; lat0 = from.lat + (to.lat - from.lat) * k; if (REDUCED) draw(now); p < 1 ? requestAnimationFrame(tw) : (drag = null, setTimeout(() => { target = null; }, 8000)); };
    requestAnimationFrame(tw);
  });
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  if (!REDUCED) { for (let i = 0; i < 4; i++) { spawn(); arcs[i].t = Math.random() * 0.8; } }
  loopId = requestAnimationFrame(draw);
}

/* ---------- Hero: reticle that reads coordinates ---------- */
function reticle() {
  const hero = $('.hero'), ret = $('#reticle'), lbl = $('#r-lbl');
  if (!matchMedia('(pointer: fine)').matches) return;
  const BOX = { n: 41.0, s: 40.65, w: 13.95, e: 14.55 };
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const over = e.target.closest('a, button, .feed, canvas');
    ret.classList.toggle('on', !over);
    ret.style.transform = `translate(${x}px, ${y}px)`;
    const lat = BOX.n - (y / r.height) * (BOX.n - BOX.s), lon = BOX.w + (x / r.width) * (BOX.e - BOX.w);
    lbl.textContent = `${lat.toFixed(4)} N\n${lon.toFixed(4)} E`;
  });
  hero.addEventListener('pointerleave', () => ret.classList.remove('on'));
  ret.style.left = '0'; ret.style.top = '0';
}

/* ---------- Hero: live intel feed ---------- */
function feed() {
  const ol = $('#feed');
  const LINES = [
    ['EXIF', 'GPSLatitude 40°49\'15"N recovered from IMG_0412.jpg', 'ok'],
    ['GEOINT', 'shadow azimuth 214° → window 15:10–15:40 local'],
    ['SOCMINT', 'username reuse on 4 platforms, avatar hash match', 'ok'],
    ['WHOIS', 'registrant redacted, created 2019-03-11'],
    ['IMINT', 'skyline match: Vesuvius ridge, confidence 0.91', 'ok'],
    ['DNS', '12 subdomains enumerated, 3 resolve to staging', 'warn'],
    ['ARCHIVE', 'snapshot 2016-07-02 recovered, page since removed'],
    ['HASH', 'pHash distance 4 → same source image', 'ok'],
    ['PHISH', 'pretext built from public org chart, 31 targets'],
    ['META', 'PDF author field stripped, XMP still present', 'warn'],
    ['CTF', 'napwnli: flag accepted', 'ok'],
    ['GEOINT', 'road markings → right-hand traffic, EU signage'],
    ['OSINT', 'timeline rebuilt: 7 events, 2 contradictions', 'warn'],
  ];
  let i = 0;
  const push = async () => {
    const [tag, msg, cls] = LINES[i++ % LINES.length];
    const li = document.createElement('li');
    const ts = new Date().toLocaleTimeString('it-IT', { hour12: false });
    li.innerHTML = `<span class="ts">${ts}</span><span class="tag">[${tag}]</span> <span class="msg ${cls || ''}"></span>`;
    ol.append(li);
    while (ol.children.length > 7) ol.firstElementChild.remove();
    await typeText(li.querySelector('.msg'), msg, { speed: 14, caret: false });
  };
  let paused = false;
  const live = $('.feed .live');
  // registered before the reduced-motion exit: the case-001 hint must stay reachable
  live.addEventListener('click', () => {
    paused = !paused;
    live.classList.toggle('off', paused);
    live.textContent = paused ? 'silence' : 'live';
    live.setAttribute('aria-pressed', String(paused));
    if (paused) fire('feed:live');
  });
  if (REDUCED) { for (let k = 0; k < 6; k++) { const [t, m, c] = LINES[k]; ol.insertAdjacentHTML('beforeend', `<li><span class="tag">[${t}]</span> <span class="${c || ''}">${m}</span></li>`); } return; }
  const loop = async () => { if (!paused) await push(); setTimeout(loop, 900 + Math.random() * 900); };
  loop();
}

/* ---------- Subject profile ---------- */
function profile() {
  const prof = $('.profile');
  onView(prof, () => {
    prof.classList.add('in');
    const fields = $('#fields');
    $$('div', fields).forEach((d, i) => (d.style.transitionDelay = `${i * 90}ms`));
    fields.classList.add('in');
    const m = $('#match'); const t0 = performance.now();
    const step = (now) => { const p = Math.min(1, (now - t0) / 2200); m.textContent = `${(p * 98.7).toFixed(1)}%`; if (p < 1) requestAnimationFrame(step); };
    REDUCED ? (m.textContent = '98.7%') : requestAnimationFrame(step);
  });
  $$('.redact').forEach((r) => {
    const label = r.closest('div').querySelector('dt').textContent.toLowerCase();
    const reveal = () => fire(`redact:${label}`);
    r.addEventListener('click', () => { r.classList.toggle('is-open'); reveal(); });
    r.addEventListener('mouseenter', () => setTimeout(() => { if (r.matches(':hover')) reveal(); }, 700));
    r.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.classList.toggle('is-open'); reveal(); } });
  });
  linkify($('#fields'));
}

/* ---------- Board: investigation wall ---------- */
// Each sheet is pinned by a magnet at (x, y), in % of the wall; the sheet hangs from it. `wide` and `narrow` are the two default layouts.
const ICONS = {
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  pin: '<path d="M12 22s7-7.2 7-12a7 7 0 0 0-14 0c0 4.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  print: '<path d="M6 10a6 6 0 0 1 12 0v3"/><path d="M9 21c.8-2 1-4 1-6v-5a2 2 0 0 1 4 0v4"/><path d="M14 18c-.3 1.2-.7 2.3-1.2 3.2"/><path d="M6 14c0 2-.4 3.6-1 5"/><path d="M18 16c0 1.6-.2 3-.6 4.3"/>',
  team: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M15 14.5c3 0 6 1.8 6 5"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-4a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h5z"/>',
  net: '<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 7l3.5 3.5M7 17l3.5-3.5M13.5 10.5 17 7M13.5 13.5 17 17"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0"/>',
  bug: '<rect x="8" y="7" width="8" height="12" rx="4"/><path d="M12 7V4M9 4l1.5 2M15 4l-1.5 2M8 11H4M8 15H4M16 11h4M16 15h4M9 19l-2 2M15 19l2 2"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>',
  layers: '<path d="M12 3 2 8l10 5 10-5z"/><path d="M2 13l10 5 10-5"/>',
  code: '<path d="M8 6 2 12l6 6M16 6l6 6-6 6M14 4l-4 16"/>',
};
const NODES = [
  { id: 'osint', label: 'OSINT', hub: true, sheet: 'hub', icon: 'eye', kind: 'Where it starts', wide: [40, 33], narrow: [50, 1.5], tags: [], text: 'Open-source intelligence: names, accounts, photos and places, cross-checked until the story holds. It’s also the first phase of every red team engagement I run.', link: ['#cases', 'Try the open cases'] },
  { id: 'geoint', label: 'GEOINT', sheet: 'photo', icon: 'pin', kind: 'Geolocation', wide: [33, 5], narrow: [27, 16], tags: [], text: 'Geolocation from what a picture gives away: skylines, shadows, signs, road markings. The cases on this site lean on it.', link: ['#cases', 'Find Marek'] },
  { id: 'forensics', label: 'Forensics', sheet: 'card', icon: 'print', kind: 'Artifacts', wide: [14, 40], narrow: [73, 16.5], tags: [], text: 'Files remember more than their owners think: metadata, timestamps, artifacts. My other half in CTFs.' },
  { id: 'napwnli', label: 'napwnli', sheet: 'photo', icon: 'team', kind: 'CTF team', wide: [12, 72], narrow: [27, 30], tags: [], text: 'The CTF team of the University of Naples Federico II. I play OSINT and forensics.', link: ['#matchday', 'See the formation'] },
  { id: 'teach', label: 'Teaching', sheet: 'sticky', icon: 'book', kind: 'Tutor · author', wide: [11, 9], narrow: [73, 30.5], tags: ['teach'], text: 'CyberChallenge.IT tutor for the Naples team, co-supervisor of 20 theses and author of a book for public competitions.' },
  { id: 'ml', label: 'ML robustness', sheet: 'clip', icon: 'net', kind: 'Research', wide: [58, 8], narrow: [50, 86], tags: ['ml'], text: 'How anomaly detection models hold up when an attacker poisons the training data.' },
  { id: 'redteam', label: 'Red teaming', sheet: 'folder', icon: 'target', kind: 'Operations', wide: [84, 5], narrow: [27, 44], tags: [], text: 'End-to-end red team operations and targeted phishing campaigns, where OSINT decides who gets the email.' },
  { id: 'pentest', label: 'Pentest', sheet: 'card', icon: 'lock', kind: 'Assessments', wide: [88, 38], narrow: [73, 44.5], tags: [], text: 'Internal, external and web application testing against the OWASP Top 10. Vulnerability assessment with Nessus and OpenVAS, reported by priority.' },
  { id: 'apt', label: 'APT emulation', sheet: 'clip', icon: 'bug', kind: 'Research fellowship', wide: [64, 41], narrow: [27, 58], tags: [], text: 'Generative models and LLMs that produce synthetic attack data for adversary emulation, from my research fellowship at Federico II.' },
  { id: 'hardening', label: 'Hardening', sheet: 'card', icon: 'shield', kind: 'Defence', wide: [87, 73], narrow: [73, 58.5], tags: [], text: 'Windows, Linux and Docker hardening, endpoint protection policies and data loss prevention tuning.' },
  { id: 'sbd', label: 'Security by design', sheet: 'folder', icon: 'layers', kind: 'GENIO project', wide: [62, 72], narrow: [27, 72], tags: ['sbd'], text: 'Security-by-design for GENIO, an edge cloud platform on GPON telco networks.' },
  { id: 'aicode', label: 'AI-generated code', sheet: 'sticky', icon: 'code', kind: 'Thesis · Q1 paper', wide: [36, 75], narrow: [73, 72.5], tags: ['aicode'], text: 'Can we trust code written by AI in security contexts? My master’s thesis and a Q1 journal paper on how to test it.' },
];
const EDGES = [
  ['osint', 'geoint'], ['osint', 'forensics'], ['osint', 'redteam'], ['osint', 'napwnli'], ['osint', 'apt'],
  ['geoint', 'forensics'], ['forensics', 'napwnli'], ['teach', 'napwnli'], ['teach', 'osint'],
  ['redteam', 'pentest'], ['redteam', 'apt'], ['pentest', 'hardening'], ['hardening', 'sbd'],
  ['sbd', 'aicode'], ['aicode', 'ml'], ['ml', 'apt'], ['aicode', 'teach'],
];
const BOARD_STORE = 'board.v1';

function board() {
  const wall = $('#wall'), svg = $('#wall-strings'), mags = $('#wall-magnets'), note = $('#board-note'), exhibits = $('.exhibits');
  if (!wall) return;
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const coarse = matchMedia('(pointer: coarse)').matches;
  $('#board-help').textContent = coarse
    ? 'Tap a sheet to open its file. Hold it, then drag: a magnet pins it wherever you let go.'
    : 'Click a sheet to open its file. Drag it anywhere: a magnet pins it wherever you let go. Arrow keys move the focused sheet.';

  // stable small tilt per sheet, so the default wall looks hand-pinned but never changes between visits
  const tiltOf = (id) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0; return ((Math.abs(h) % 70) / 10) - 3.5; };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(BOARD_STORE) || '{}') || {}; } catch { saved = {}; }
  const persist = () => { try { localStorage.setItem(BOARD_STORE, JSON.stringify(saved)); } catch { /* private mode */ } };

  /* ---------- build ---------- */
  const sheets = {}, magnets = {}, pos = {};
  NODES.forEach((n, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `sheet sh-${n.sheet}`;
    b.dataset.id = n.id;
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-describedby', 'board-help');
    b.innerHTML = `<span class="sh-no">No. ${String(i + 1).padStart(2, '0')}</span>`
      + `<span class="sh-ico" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[n.icon]}</svg></span>`
      + `<span class="sh-title">${n.label}</span><span class="sh-kind">${n.kind}</span>`
      + (n.hub ? '<span class="sh-stamp" aria-hidden="true">Primary</span>' : '');
    b.style.setProperty('--d', `${i * 60}ms`);
    wall.append(b); sheets[n.id] = b;
    const m = document.createElement('span');
    m.className = `magnet${n.hub ? ' hub' : ''}`;
    m.style.setProperty('--d', `${i * 60 + 260}ms`);
    mags.append(m); magnets[n.id] = m;
  });
  const strings = EDGES.map(([a, b]) => {
    const p = svgEl('path', { class: 'string' }, svg);
    p.dataset.a = a; p.dataset.b = b;
    return p;
  });

  /* ---------- layout ---------- */
  let layout = '';
  let order = [...NODES.filter((n) => !n.hub), ...NODES.filter((n) => n.hub)].map((n) => n.id); // stacking order, last on top
  const restack = () => order.forEach((id, i) => { sheets[id].style.zIndex = i + 1; });
  restack();

  const place = (id) => {
    const p = pos[id], s = sheets[id].style, m = magnets[id].style;
    s.setProperty('--x', `${p.x}%`); s.setProperty('--y', `${p.y}%`); s.setProperty('--r', `${p.r}deg`);
    m.setProperty('--x', `${p.x}%`); m.setProperty('--y', `${p.y}%`);
  };
  // keep each sheet fully on the wall: the magnet is 14px below the sheet's top edge
  const clamp = (id, x, y) => {
    const W = wall.clientWidth, H = wall.clientHeight, el = sheets[id];
    const hw = el.offsetWidth / 2 + 8, top = 22, bottom = el.offsetHeight - 14 + 10;
    return {
      x: Math.min(Math.max(x, (hw / W) * 100), 100 - (hw / W) * 100),
      y: Math.min(Math.max(y, (top / H) * 100), 100 - (bottom / H) * 100),
    };
  };
  const draw = () => {
    const W = wall.clientWidth, H = wall.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    for (const p of strings) {
      const A = pos[p.dataset.a], B = pos[p.dataset.b];
      const ax = (A.x / 100) * W, ay = (A.y / 100) * H, bx = (B.x / 100) * W, by = (B.y / 100) * H;
      const sag = 10 + Math.hypot(bx - ax, by - ay) * 0.07;
      p.setAttribute('d', `M${ax.toFixed(1)},${ay.toFixed(1)} Q${((ax + bx) / 2).toFixed(1)},${((ay + by) / 2 + sag).toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`);
    }
  };
  const applyLayout = () => {
    const next = wall.clientWidth < 640 ? 'narrow' : 'wide';
    wall.classList.toggle('is-narrow', next === 'narrow');
    if (next !== layout) {
      layout = next;
      const mine = saved[layout] || {};
      for (const n of NODES) {
        const [x, y, r] = mine[n.id] || [...n[layout], tiltOf(n.id)];
        pos[n.id] = { x, y, r };
      }
    }
    for (const n of NODES) { Object.assign(pos[n.id], clamp(n.id, pos[n.id].x, pos[n.id].y)); place(n.id); }
    draw();
  };
  applyLayout();
  new ResizeObserver(() => applyLayout()).observe(wall);

  const store = (id) => {
    const p = pos[id];
    (saved[layout] ||= {})[id] = [+p.x.toFixed(2), +p.y.toFixed(2), +p.r.toFixed(1)];
    persist();
  };
  // the magnet snaps down: bounce, then a ring spreads over the wall
  const clack = (id) => {
    const m = magnets[id];
    m.classList.remove('lifted', 'clack'); void m.offsetWidth; m.classList.add('clack');
    if (REDUCED) return;
    const ring = document.createElement('span');
    ring.className = 'mag-ring';
    ring.style.setProperty('--x', `${pos[id].x}%`); ring.style.setProperty('--y', `${pos[id].y}%`);
    mags.append(ring);
    ring.addEventListener('animationend', () => ring.remove());
  };

  /* ---------- intro: sheets drop on the wall, magnets clack, strings unroll ---------- */
  if (!REDUCED) {
    wall.classList.add('pre');
    onView(wall, () => {
      wall.classList.remove('pre'); wall.classList.add('in');
      strings.forEach((p, i) => {
        const L = p.getTotalLength();
        p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
        p.getBoundingClientRect();
        p.style.transition = `stroke-dashoffset 1s var(--ease) ${900 + i * 55}ms`;
        p.style.strokeDashoffset = 0;
        setTimeout(() => { p.style.transition = ''; p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }, 2100 + i * 55);
      });
      setTimeout(() => wall.classList.remove('in'), 2400);
    }, { threshold: 0.2 });
  }

  /* ---------- selection ---------- */
  const DEFAULT = note.innerHTML;
  let active = null;
  const select = (id) => {
    active = active === id ? null : id;
    wall.classList.toggle('has-active', !!active);
    const linked = new Set(active ? [active] : []);
    strings.forEach((e) => {
      const on = active && (e.dataset.a === active || e.dataset.b === active);
      e.classList.toggle('is-linked', !!on);
      if (on) { linked.add(e.dataset.a); linked.add(e.dataset.b); }
    });
    for (const n of NODES) {
      const on = n.id === active;
      sheets[n.id].classList.toggle('is-linked', linked.has(n.id));
      sheets[n.id].classList.toggle('is-active', on);
      sheets[n.id].setAttribute('aria-pressed', String(on));
      magnets[n.id].classList.toggle('is-linked', linked.has(n.id));
    }
    if (active) { order = [...order.filter((x) => x !== active), active]; restack(); }
    const tags = active ? byId[active].tags : [];
    exhibits.classList.toggle('is-filtered', tags.length > 0);
    $$('li', exhibits).forEach((li) => li.classList.toggle('is-hit', tags.includes(li.dataset.tags)));
    note.classList.remove('flash'); void note.offsetWidth; note.classList.add('flash');
    if (!active) { note.innerHTML = DEFAULT; return; }
    const n = byId[active];
    const exIds = $$('li.is-hit .ex-id', exhibits).map((e) => e.textContent);
    note.innerHTML = `<p class="note-no">File No. ${String(NODES.indexOf(n) + 1).padStart(2, '0')} · ${n.kind}</p><h3>${n.label}</h3><p>${n.text}</p>
      ${exIds.length ? `<p><strong>evidence →</strong> exhibit${exIds.length > 1 ? 's' : ''} ${exIds.join(', ')}</p>` : ''}
      ${n.link ? `<p><a href="${n.link[0]}">${n.link[1]}</a></p>` : ''}`;
    scramble(note.querySelector('h3'), { duration: 450 });
  };

  /* ---------- drag: mouse at once, touch after a short hold so the page still scrolls ---------- */
  let drag = null, justDragged = 0;
  const lift = (d) => {
    d.on = true;
    order = [...order.filter((x) => x !== d.id), d.id]; restack();
    sheets[d.id].classList.add('lifted'); magnets[d.id].classList.add('lifted'); wall.classList.add('dragging');
    if (d.touch) navigator.vibrate?.(8);
  };
  const drop = (d) => {
    const el = sheets[d.id];
    el.classList.remove('lifted'); el.style.setProperty('--sw', '0deg'); wall.classList.remove('dragging');
    // magnetic snap to a 1% grid, and a fresh small tilt as it settles
    const p = pos[d.id];
    Object.assign(p, clamp(d.id, Math.round(p.x), Math.round(p.y)), { r: Math.round((Math.random() * 6 - 3) * 10) / 10 });
    place(d.id); draw(); store(d.id); clack(d.id);
    justDragged = performance.now();
  };
  const end = () => {
    if (!drag) return;
    clearTimeout(drag.timer);
    const d = drag; drag = null;
    if (d.on) drop(d);
  };
  wall.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.sheet');
    if (!el || e.button > 0 || drag) return;
    const id = el.dataset.id, r = wall.getBoundingClientRect();
    drag = { id, el, touch: e.pointerType !== 'mouse', sx: e.clientX, sy: e.clientY, lx: e.clientX, on: false,
      ox: e.clientX - r.left - (pos[id].x / 100) * r.width, oy: e.clientY - r.top - (pos[id].y / 100) * r.height };
    el.setPointerCapture?.(e.pointerId);
    if (drag.touch) drag.timer = setTimeout(() => { if (drag && !drag.on) lift(drag); }, 280);
  });
  wall.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
    if (!drag.on) {
      if (drag.touch) { if (moved > 10) { clearTimeout(drag.timer); drag = null; } return; } // a scroll, not a drag
      if (moved < 5) return;
      lift(drag);
    }
    const r = wall.getBoundingClientRect(), p = pos[drag.id];
    Object.assign(p, clamp(drag.id, ((e.clientX - r.left - drag.ox) / r.width) * 100, ((e.clientY - r.top - drag.oy) / r.height) * 100));
    // the sheet swings from its magnet against the direction of travel
    const vx = e.clientX - drag.lx; drag.lx = e.clientX;
    drag.el.style.setProperty('--sw', `${Math.max(-16, Math.min(16, -vx * 1.4))}deg`);
    place(drag.id); draw();
  });
  wall.addEventListener('pointerup', end);
  wall.addEventListener('pointercancel', end);
  wall.addEventListener('lostpointercapture', end);
  // while a sheet is held, the finger moves the sheet, not the page
  wall.addEventListener('touchmove', (e) => { if (drag?.on) e.preventDefault(); }, { passive: false });
  wall.addEventListener('contextmenu', (e) => { if (e.target.closest('.sheet')) e.preventDefault(); });

  wall.addEventListener('click', (e) => {
    const el = e.target.closest('.sheet');
    if (performance.now() - justDragged < 400) return; // the click that ends a drag
    if (el) select(el.dataset.id);
    else if (active) select(active);
  });
  wall.addEventListener('keydown', (e) => {
    const el = e.target.closest('.sheet');
    if (!el) return;
    if (e.key === 'Escape' && active) { e.preventDefault(); select(active); return; }
    const step = e.shiftKey ? 5 : 1, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    const id = el.dataset.id, p = pos[id];
    Object.assign(p, clamp(id, p.x + d[0], p.y + d[1]));
    place(id); draw(); store(id); clack(id);
  });

  $('#wall-reset').addEventListener('click', () => {
    delete saved[layout]; persist();
    // glide every sheet home; strings follow frame by frame
    const from = Object.fromEntries(NODES.map((n) => [n.id, { ...pos[n.id] }]));
    const to = Object.fromEntries(NODES.map((n) => [n.id, { ...clamp(n.id, n[layout][0], n[layout][1]), r: tiltOf(n.id) }]));
    const t0 = performance.now(), dur = REDUCED ? 0 : 700;
    const step = (now) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - (1 - k) ** 3;
      for (const n of NODES) {
        const a = from[n.id], b = to[n.id];
        pos[n.id] = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, r: a.r + (b.r - a.r) * e };
        place(n.id);
      }
      draw();
      if (k < 1) requestAnimationFrame(step); else NODES.forEach((n) => clack(n.id));
    };
    requestAnimationFrame(step);
  });
}

/* ---------- Matchday ---------- */
const PLAYERS = [
  { n: 1, x: 70, y: 220, role: 'A/D defense', text: 'In Attack/Defense, keeps the goal clean: patches the services and keeps them up while the other teams shoot.' },
  { n: 2, x: 190, y: 115, role: 'Crypto', text: 'Breaks the maths everyone else trusts.' },
  { n: 3, x: 190, y: 325, role: 'Reversing', text: 'Takes binaries apart to see how they think.' },
  { n: 6, x: 320, y: 220, role: 'Misc', text: 'Covers every gap on the pitch: stego, programming, the weird ones.' },
  { n: 8, x: 440, y: 105, role: 'Web', text: 'Finds the door the developers forgot to lock.' },
  { n: 10, x: 440, y: 335, role: 'Pwn', text: 'Turns a crash into a shell.' },
  { n: 77, x: 570, y: 130, role: 'OSINT & forensics', me: true, text: 'That’s me. Number 77, left wing, like Kvara: cut inside and finish what the others started. The person, the place, the proof.' },
];

function pitch() {
  const svg = $('#pitch'), cap = $('#pitch-cap');
  const defs = svgEl('defs', {}, svg);
  const pat = svgEl('pattern', { id: 'stripes', width: 80, height: 440, patternUnits: 'userSpaceOnUse' }, defs);
  svgEl('rect', { width: 40, height: 440, fill: '#02060B' }, pat);
  svgEl('rect', { x: 40, width: 40, height: 440, fill: '#040B14' }, pat);
  svgEl('rect', { width: 680, height: 440, fill: 'url(#stripes)' }, svg);
  const L = svgEl('g', {}, svg);
  [['rect', { x: 20, y: 20, width: 640, height: 400 }], ['line', { x1: 340, y1: 20, x2: 340, y2: 420 }],
    ['circle', { cx: 340, cy: 220, r: 56 }], ['rect', { x: 20, y: 120, width: 100, height: 200 }],
    ['rect', { x: 560, y: 120, width: 100, height: 200 }], ['rect', { x: 20, y: 175, width: 36, height: 90 }],
    ['rect', { x: 624, y: 175, width: 36, height: 90 }], ['path', { d: 'M120,180 A56,56 0 0 1 120,260' }],
    ['path', { d: 'M560,180 A56,56 0 0 0 560,260' }], ['rect', { x: 660, y: 195, width: 12, height: 50 }]].forEach(([t, a]) => svgEl(t, { ...a, class: 'ln' }, L));
  const goalTxt = svgEl('text', { class: 'goal-txt', x: 340, y: 220 }, svg); goalTxt.textContent = 'GOL!';
  const trail = svgEl('path', { class: 'trail', d: '' }, svg);

  const DEFAULT = cap.textContent;
  let active = null;
  const els = PLAYERS.map((p) => {
    const g = svgEl('g', { class: `player${p.me ? ' me' : ''}`, tabindex: 0, role: 'button', 'aria-pressed': 'false', 'aria-label': `Number ${p.n}, ${p.role}` }, svg);
    svgEl('circle', { class: 'ring', cx: p.x, cy: p.y, r: p.me ? 28 : 24 }, g);
    svgEl('circle', { class: 'body', cx: p.x, cy: p.y, r: p.me ? 28 : 24 }, g);
    svgEl('text', { class: 'num', x: p.x, y: p.y + 1 }, g).textContent = p.n;
    svgEl('text', { class: 'role', x: p.x, y: p.y + (p.me ? 50 : 44) }, g).textContent = p.role;
    const pick = () => {
      active = active === p ? null : p;
      $$('.player', svg).forEach((x) => { x.classList.remove('is-active'); x.setAttribute('aria-pressed', 'false'); });
      if (active) { g.classList.add('is-active'); g.setAttribute('aria-pressed', 'true'); typeText(cap, `#${p.n} ${p.role}. ${p.text}`, { speed: 10, caret: false }); }
      else cap.textContent = DEFAULT;
    };
    g.addEventListener('click', pick);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    if (!REDUCED) { g.style.transform = `translate(${340 - p.x}px, ${220 - p.y}px) scale(.2)`; g.style.opacity = 0; }
    return g;
  });
  const ball = svgEl('circle', { class: 'ball', r: 7, cx: 70, cy: 220 }, svg);
  if (REDUCED) return;

  // the play: 1 → 3 → 6 → 10 → 8 → 77 → goal
  const SEQ = [1, 3, 6, 10, 8, 77].map((n) => PLAYERS.find((p) => p.n === n));
  const GOAL = { x: 668, y: 226 };
  let playing = false, visible = false;
  const move = (from, to, ms) => new Promise((res) => {
    const t0 = performance.now();
    const c = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 40 };
    const f = (now) => {
      const t = Math.min(1, (now - t0) / ms), e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const x = (1 - e) ** 2 * from.x + 2 * (1 - e) * e * c.x + e * e * to.x, y = (1 - e) ** 2 * from.y + 2 * (1 - e) * e * c.y + e * e * to.y;
      ball.setAttribute('cx', x); ball.setAttribute('cy', y);
      t < 1 ? requestAnimationFrame(f) : res();
    };
    requestAnimationFrame(f);
  });
  const play = async () => {
    if (playing || !visible) return;
    playing = true;
    let d = `M${SEQ[0].x},${SEQ[0].y}`;
    trail.setAttribute('d', d);
    for (let i = 1; i < SEQ.length; i++) {
      await move(SEQ[i - 1], SEQ[i], 650);
      const c = { x: (SEQ[i - 1].x + SEQ[i].x) / 2, y: (SEQ[i - 1].y + SEQ[i].y) / 2 - 40 };
      d += ` Q${c.x},${c.y} ${SEQ[i].x},${SEQ[i].y}`; trail.setAttribute('d', d);
      await new Promise((r) => setTimeout(r, 160));
    }
    await move(SEQ.at(-1), GOAL, 380);
    goalTxt.classList.remove('on'); void goalTxt.getBBox(); goalTxt.classList.add('on');
    await new Promise((r) => setTimeout(r, 1800));
    trail.setAttribute('d', ''); ball.setAttribute('cx', SEQ[0].x); ball.setAttribute('cy', SEQ[0].y);
    playing = false;
    setTimeout(play, 2500);
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) play(); }, { threshold: 0.4 }).observe(svg);

  // Kvara mode: the 77 dribbles in from the left wing and puts it in the top corner
  const kvara = async () => {
    $('#matchday').scrollIntoView({ behavior: 'smooth', block: 'center' });
    while (playing) await new Promise((r) => setTimeout(r, 120));
    playing = true;
    const me = PLAYERS.find((p) => p.n === 77);
    const path = [me, { x: 610, y: 165 }, { x: 588, y: 205 }, { x: 628, y: 238 }, { x: 606, y: 262 }];
    trail.setAttribute('d', ''); ball.setAttribute('cx', me.x); ball.setAttribute('cy', me.y);
    let d = `M${me.x},${me.y}`;
    for (let i = 1; i < path.length; i++) { await move(path[i - 1], path[i], 230); d += ` L${path[i].x},${path[i].y}`; trail.setAttribute('d', d); }
    await move(path.at(-1), { x: 668, y: 198 }, 300);
    goalTxt.textContent = '77'; goalTxt.classList.remove('on'); void goalTxt.getBBox(); goalTxt.classList.add('on');
    await new Promise((r) => setTimeout(r, 1500));
    goalTxt.textContent = 'GOL!'; trail.setAttribute('d', '');
    ball.setAttribute('cx', SEQ[0].x); ball.setAttribute('cy', SEQ[0].y);
    playing = false;
    // the regular play's timer fired while Kvara was running and gave up: restart the loop
    setTimeout(play, 2500);
  };
  addEventListener('kvara', kvara);
  onView(svg, () => {
    els.forEach((g, i) => { g.style.transition = `transform .8s cubic-bezier(.2,1.2,.4,1) ${i * 90}ms, opacity .4s ${i * 90}ms`; g.style.transform = ''; g.style.opacity = ''; });
  });
}

function scoreboard() {
  $$('.sb-num').forEach((el, i) => onView(el, () => setTimeout(() => scramble(el, { duration: 1100, chars: '0123456789#' }), i * 200)));
}

/* ---------- Horizontal timeline ---------- */
function timeline() {
  const root = $('#htl');
  if (!root) return;
  const tabs = $$('[role="tab"]', root), arts = $$('#htl-data article'), body = $('#htl-body'), fill = $('#htl-fill'), count = $('#htl-count');
  let cur = -1;
  const select = (i, focus) => {
    i = Math.max(0, Math.min(tabs.length - 1, i));
    if (i === cur) return;
    const dir = i > cur ? 1 : -1;
    cur = i;
    tabs.forEach((t, k) => {
      t.setAttribute('aria-selected', String(k === i));
      t.tabIndex = k === i ? 0 : -1;
      t.classList.toggle('past', k < i);
    });
    $('#htl-panel').setAttribute('aria-labelledby', tabs[i].id);
    // rail fills up to the selected node
    const first = tabs[0].querySelector('.htl-dot').getBoundingClientRect(), dot = tabs[i].querySelector('.htl-dot').getBoundingClientRect();
    fill.style.width = `${dot.left - first.left}px`;
    body.innerHTML = arts[i].innerHTML;
    body.style.setProperty('--dir', dir);
    body.classList.remove('swap'); void body.offsetWidth; body.classList.add('swap');
    scramble(body.querySelector('h3'), { duration: 500 });
    count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(tabs.length).padStart(2, '0')}`;
    $('#htl-prev').disabled = i === 0; $('#htl-next').disabled = i === tabs.length - 1;
    const sc = root.querySelector('.htl-scroll');
    sc.scrollTo({ left: tabs[i].parentElement.offsetLeft - sc.clientWidth / 2 + tabs[i].parentElement.offsetWidth / 2, behavior: REDUCED ? 'auto' : 'smooth' });
    if (focus) tabs[i].focus({ preventScroll: true });
  };
  tabs.forEach((t, k) => {
    t.addEventListener('click', () => select(k));
    t.addEventListener('keydown', (e) => {
      const m = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (m) { e.preventDefault(); select(cur + m, true); }
      else if (e.key === 'Home') { e.preventDefault(); select(0, true); }
      else if (e.key === 'End') { e.preventDefault(); select(tabs.length - 1, true); }
    });
  });
  $('#htl-prev').addEventListener('click', () => select(cur - 1));
  $('#htl-next').addEventListener('click', () => select(cur + 1));
  addEventListener('resize', () => { const c = cur; cur = -1; select(c); });
  // open on the most recent entry; the rail draws itself when the section comes into view
  select(tabs.length - 1);
  root.classList.add('ready');
  onView(root, () => root.classList.add('in'), { threshold: 0.3 });
}

/* ---------- Cases background: dotted world outline ---------- */
function bgMap() {
  const cv = $('#bg-map');
  if (!cv) return;
  onView(cv.closest('section'), async () => {
    let rings;
    try { rings = await (await fetch('assets/data/land.json')).json(); } catch { return; }
    const draw = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      const ctx = cv.getContext('2d');
      ctx.scale(dpr, dpr);
      // equirectangular, cropped to the inhabited latitudes and stretched to the section
      const W = r.width, H = r.height, x = (lo) => ((lo + 180) / 360) * W, y = (la) => ((72 - la) / 130) * H;
      ctx.fillStyle = 'rgba(28,154,214,.6)';
      for (const ring of rings) for (let i = 0; i < ring.length; i += 2) ctx.fillRect(x(ring[i]), y(ring[i + 1]), 1.6, 1.6);
    };
    draw();
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 200); });
  }, { rootMargin: '300px' });
}

/* ---------- napwnli dialog ---------- */
function teamDialog() {
  const dlg = $('#teamdlg');
  if (!dlg) return;
  let last = null;
  const close = () => { dlg.classList.remove('open'); setTimeout(() => { dlg.hidden = true; }, REDUCED ? 0 : 300); last?.focus(); };
  const open = (from) => {
    last = from;
    dlg.hidden = false;
    requestAnimationFrame(() => dlg.classList.add('open'));
    $('#teamdlg-close').focus();
    setTimeout(() => scramble($('#teamdlg-motto'), { duration: 1200, chars: 'NAPWL0123456789#' }), REDUCED ? 0 : 450);
  };
  $$('[data-team]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); open(a); }));
  $('#teamdlg-close').addEventListener('click', close);
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) close(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') {
      // keep focus inside the dialog
      const f = $$('button, a[href]', dlg), first = f[0], lastEl = f.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }
  });
}

/* ---------- Contact + footer ---------- */
function contact() {
  $$('[data-scramble]').forEach((a) => {
    const run = () => scramble(a, { duration: 380, lock: true, restart: false });
    a.addEventListener('pointerenter', run);
    a.addEventListener('focus', run);
  });
  const so = $('#signoff');
  const text = so.dataset.text;
  if (!REDUCED) { so.textContent = ''; onView(so, () => typeText(so, text, { speed: 45, caret: false }), { threshold: 1 }); }
}

/* ---------- 77 ---------- */
async function intro77() {
  if (REDUCED || sessionStorage.getItem('intro77')) return;
  try { sessionStorage.setItem('intro77', '1'); } catch { /* ignore */ }
  const box = document.createElement('div');
  box.className = 'intro77';
  box.innerHTML = '<canvas aria-hidden="true"></canvas><p class="intro-name">ErContent77</p><button type="button" class="intro-skip">Skip</button>';
  document.body.append(box);
  document.body.classList.add('intro-on');
  const cv = box.querySelector('canvas'), ctx = cv.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
  let done = false;
  const finish = () => { if (done) return; done = true; box.classList.add('out'); document.body.classList.remove('intro-on'); setTimeout(() => box.remove(), 700); };
  box.querySelector('.intro-skip').addEventListener('click', finish);
  addEventListener('keydown', finish, { once: true });
  await document.fonts.load('900 100px "Big Shoulders Display"').catch(() => {});
  // sample the shape of "77"
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const o = off.getContext('2d'), size = Math.min(W * 0.62, H * 0.78);
  o.font = `900 ${size}px "Big Shoulders Display", Impact, sans-serif`; o.textAlign = 'center'; o.textBaseline = 'middle';
  o.fillText('77', W / 2, H / 2 - H * 0.03);
  const img = o.getImageData(0, 0, W, H).data, step = Math.max(6, Math.round(size / 55)), pts = [];
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (img[(y * W + x) * 4 + 3] > 128) pts.push({ tx: x, ty: y, x: Math.random() * W, y: Math.random() * H, c: (Math.random() * 10) | 0, out: Math.random() * Math.PI * 2 });
  const t0 = performance.now(), A = 1100, HOLD = 650, OUT = 650;
  ctx.font = `700 ${step + 2}px "JetBrains Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const frame = (now) => {
    if (done && !box.isConnected) return;
    const t = now - t0;
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      let x, y, a = 1;
      if (t < A) { const k = 1 - (1 - t / A) ** 3; x = p.x + (p.tx - p.x) * k; y = p.y + (p.ty - p.y) * k; if (Math.random() < 0.3) p.c = (Math.random() * 10) | 0; }
      else if (t < A + HOLD) { x = p.tx; y = p.ty; p.c = 7; }
      else { const k = (t - A - HOLD) / OUT; x = p.tx + Math.cos(p.out) * k * W * 0.6; y = p.ty + Math.sin(p.out) * k * H * 0.6; a = 1 - k; }
      ctx.fillStyle = t > A ? `rgba(98,196,240,${a})` : `rgba(28,154,214,${0.4 + 0.6 * Math.min(1, t / A)})`;
      ctx.fillText(p.c, x, y);
    }
    if (t > A + HOLD * 0.5) box.classList.add('fade');
    if (t < A + HOLD + OUT) requestAnimationFrame(frame); else finish();
  };
  requestAnimationFrame(frame);
}

function brand77() {
  const n = $('.brand .b77');
  if (!n || REDUCED) return;
  setInterval(() => scramble(n, { duration: 650, chars: '0123456789' }), 9000);
  // two quick presses of 7 anywhere (outside inputs) start Kvara mode
  let last = 0;
  addEventListener('keydown', (e) => {
    if (e.key !== '7' || e.target.closest('input, textarea, [contenteditable]')) return;
    const now = performance.now();
    if (now - last < 600) { dispatchEvent(new Event('kvara')); last = 0; } else last = now;
  });
}

intro77();
brand77();
globe();
reticle();
feed();
profile();
document.fonts.ready.then(board);
pitch();
scoreboard();
timeline();
teamDialog();
bgMap();
contact();
initCases().then(initTerminal);
initStadium();

console.log('%cEverything leaves a trace.', 'font:900 22px "Big Shoulders Display",sans-serif;color:#1C9AD6');
console.log('You’re looking in the right place. Now try /robots.txt');
