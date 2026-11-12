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

/* ---------- Board: link analysis graph ---------- */
const NODES = [
  { id: 'osint', label: 'OSINT', x: 470, y: 300, hub: true, tags: [], text: 'Open-source intelligence: names, accounts, photos and places, cross-checked until the story holds. It’s also the first phase of every red team engagement I run.', link: ['#cases', 'Try the open cases'] },
  { id: 'geoint', label: 'GEOINT', x: 230, y: 140, tags: [], text: 'Geolocation from what a picture gives away: skylines, shadows, signs, road markings. The cases on this site lean on it.', link: ['#cases', 'Find Marek'] },
  { id: 'forensics', label: 'Forensics', x: 190, y: 410, tags: [], text: 'Files remember more than their owners think: metadata, timestamps, artifacts. My other half in CTFs.' },
  { id: 'napwnli', label: 'napwnli', x: 360, y: 545, tags: [], text: 'The CTF team of the University of Naples Federico II. I play OSINT and forensics.', link: ['#matchday', 'See the formation'] },
  { id: 'teach', label: 'Teaching', x: 100, y: 270, tags: ['teach'], text: 'CyberChallenge.IT tutor for the Naples team, co-supervisor of 20 theses and author of a book for public competitions.' },
  { id: 'ml', label: 'ML robustness', x: 480, y: 80, tags: ['ml'], text: 'How anomaly detection models hold up when an attacker poisons the training data.' },
  { id: 'redteam', label: 'Red teaming', x: 700, y: 150, tags: [], text: 'End-to-end red team operations and targeted phishing campaigns, where OSINT decides who gets the email.' },
  { id: 'pentest', label: 'Pentest', x: 885, y: 270, tags: [], text: 'Internal, external and web application testing against the OWASP Top 10. Vulnerability assessment with Nessus and OpenVAS, reported by priority.' },
  { id: 'apt', label: 'APT emulation', x: 700, y: 370, tags: [], text: 'Generative models and LLMs that produce synthetic attack data for adversary emulation, from my research fellowship at Federico II.' },
  { id: 'hardening', label: 'Hardening', x: 875, y: 490, tags: [], text: 'Windows, Linux and Docker hardening, endpoint protection policies and data loss prevention tuning.' },
  { id: 'sbd', label: 'Security by design', x: 650, y: 555, tags: ['sbd'], text: 'Security-by-design for GENIO, an edge cloud platform on GPON telco networks.' },
  { id: 'aicode', label: 'AI-generated code', x: 455, y: 445, tags: ['aicode'], text: 'Can we trust code written by AI in security contexts? My master’s thesis and a Q1 journal paper on how to test it.' },
];
const EDGES = [
  ['osint', 'geoint'], ['osint', 'forensics'], ['osint', 'redteam'], ['osint', 'napwnli'], ['osint', 'apt'],
  ['geoint', 'forensics'], ['forensics', 'napwnli'], ['teach', 'napwnli'], ['teach', 'osint'],
  ['redteam', 'pentest'], ['redteam', 'apt'], ['pentest', 'hardening'], ['hardening', 'sbd'],
  ['sbd', 'aicode'], ['aicode', 'ml'], ['ml', 'apt'], ['aicode', 'teach'],
];

function board() {
  const svg = $('#board-svg'), note = $('#board-note'), exhibits = $('.exhibits');
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const gStr = svgEl('g', {}, svg), gPk = svgEl('g', {}, svg), gNodes = svgEl('g', {}, svg);
  const edgeEls = EDGES.map(([a, b]) => {
    const A = byId[a], B = byId[b];
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 + 18 + Math.hypot(B.x - A.x, B.y - A.y) * 0.05;
    const p = svgEl('path', { class: 'string', d: `M${A.x},${A.y} Q${mx},${my} ${B.x},${B.y}` }, gStr);
    p.dataset.a = a; p.dataset.b = b;
    return p;
  });
  NODES.forEach((n) => {
    const g = svgEl('g', { class: `node${n.hub ? ' hub' : ''}`, tabindex: 0, role: 'button', 'aria-pressed': 'false', 'aria-label': n.label }, gNodes);
    g.dataset.id = n.id;
    const rect = svgEl('rect', { y: n.y - (n.hub ? 30 : 24), height: n.hub ? 60 : 48, rx: 2 }, g);
    const t = svgEl('text', { x: n.x, y: n.y + (n.hub ? 9 : 7), 'text-anchor': 'middle' }, g);
    t.textContent = n.label;
    if (n.hub) t.style.fontSize = '28px';
    const w = t.getComputedTextLength() + 40;
    rect.setAttribute('x', n.x - w / 2); rect.setAttribute('width', w);
    const halo = svgEl('rect', { class: 'halo', x: n.x - w / 2, y: n.y - (n.hub ? 30 : 24), width: w, height: n.hub ? 60 : 48 }, g);
    g.insertBefore(halo, rect);
    svgEl('circle', { class: 'pin', cx: n.x - w / 2, cy: n.y - (n.hub ? 30 : 24), r: 5 }, g);
  });

  // draw-in: strings unroll, nodes appear in sequence
  edgeEls.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = REDUCED ? 0 : L; p.dataset.len = L; });
  const nodesEls = $$('.node', gNodes);
  if (!REDUCED) nodesEls.forEach((g) => { g.style.opacity = 0; });
  onView(svg, () => {
    nodesEls.forEach((g, i) => { g.style.transition = `opacity .5s ${i * 70}ms`; g.style.opacity = ''; });
    edgeEls.forEach((p, i) => { p.style.transition = `stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1) ${300 + i * 70}ms`; p.style.strokeDashoffset = 0; });
    if (!REDUCED) setTimeout(packets, 1500);
  });

  // data packets running on the strings
  function packets() {
    const pk = edgeEls.map((p) => ({ p, t: Math.random(), v: 0.0025 + Math.random() * 0.003, c: svgEl('circle', { class: 'packet', r: 2.6 }, gPk) }));
    let vis = true, id = 0;
    // id guards against a second loop when the board leaves and re-enters view between two frames
    new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis && !id) id = requestAnimationFrame(run); }).observe(svg);
    function run() {
      id = 0;
      for (const k of pk) {
        k.t = (k.t + k.v) % 1;
        const pt = k.p.getPointAtLength(k.t * +k.p.dataset.len);
        k.c.setAttribute('cx', pt.x); k.c.setAttribute('cy', pt.y);
        k.c.style.opacity = svg.classList.contains('has-active') && !k.p.classList.contains('is-linked') ? 0 : 1;
      }
      if (vis) id = requestAnimationFrame(run);
    }
  }

  const DEFAULT = note.innerHTML;
  let active = null;
  const select = (id) => {
    active = active === id ? null : id;
    svg.classList.toggle('has-active', !!active);
    const linked = new Set(active ? [active] : []);
    edgeEls.forEach((e) => {
      const on = active && (e.dataset.a === active || e.dataset.b === active);
      e.classList.toggle('is-linked', !!on);
      if (on) { linked.add(e.dataset.a); linked.add(e.dataset.b); }
    });
    nodesEls.forEach((g) => {
      g.classList.toggle('is-linked', linked.has(g.dataset.id));
      g.classList.toggle('is-active', g.dataset.id === active);
      g.setAttribute('aria-pressed', String(g.dataset.id === active));
    });
    const tags = active ? byId[active].tags : [];
    exhibits.classList.toggle('is-filtered', tags.length > 0);
    $$('li', exhibits).forEach((li) => li.classList.toggle('is-hit', tags.includes(li.dataset.tags)));
    note.classList.remove('flash'); void note.offsetWidth; note.classList.add('flash');
    if (!active) { note.innerHTML = DEFAULT; return; }
    const n = byId[active];
    const exIds = $$('li.is-hit .ex-id', exhibits).map((e) => e.textContent);
    note.innerHTML = `<h3>${n.label}</h3><p>${n.text}</p>
      ${exIds.length ? `<p><strong>evidence →</strong> exhibit${exIds.length > 1 ? 's' : ''} ${exIds.join(', ')}</p>` : ''}
      ${n.link ? `<p><a href="${n.link[0]}">${n.link[1]}</a></p>` : ''}`;
    scramble(note.querySelector('h3'), { duration: 450 });
  };
  gNodes.addEventListener('click', (e) => { const g = e.target.closest('.node'); if (g) select(g.dataset.id); });
  gNodes.addEventListener('keydown', (e) => { const g = e.target.closest('.node'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(g.dataset.id); } });
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
