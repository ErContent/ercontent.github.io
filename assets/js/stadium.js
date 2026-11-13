// 3D night pitch: a magnifying lens reveals hidden clues, the goal takes penalties against ErContent.
import { REDUCED, typeText } from './fx.js';
import { fire } from './hints.js';

const $ = (s, r = document) => r.querySelector(s);
const STORE = 'stadium.v1';
const GOAL_X = 52.5, GW = 7.32, GH = 2.44, SPOT_X = 41.5;

// Clues live on render layer 1: only the lens camera sees them until they are found.
const CLUES = [
  { id: 'c1', x: 43.5, z: -5.2, kind: 'Scouting report', text: 'ErContent never guards the top-left corner.',
    note: 'A tip for the penalties. In Shoot mode aim high and to the left: the keeper never dives there, and the top corner pays 3.' },
  { id: 'c2', x: -1, z: 4.5, kind: 'Fragment 1 of 3', frag: 0, text: '/evi',
    note: 'One piece of a path on this site. Two more are hidden on the grass: put the three together, in order.' },
  { id: 'c3', x: -46, z: 29, kind: 'Fragment 2 of 3', frag: 1, text: 'den',
    note: 'The middle piece of the path. Its neighbours are hidden somewhere else on the pitch.' },
  { id: 'c4', x: -24, z: -28, kind: 'Scouting report', text: 'Under the crossbar pays 5.',
    note: 'The richest shot on the pitch: right under the middle of the bar. Hard to place, worth the risk.' },
  { id: 'c5', x: 24, z: 27, kind: 'Fragment 3 of 3', frag: 2, text: 'ce/',
    note: 'The last piece of the path. Read the fragments in order and you have an address on this site.' },
];
const FRAGS = CLUES.filter((c) => c.frag != null).sort((a, b) => a.frag - b.frag);
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

function load() {
  try { return { tu: 0, er: 0, pts: 0, clues: [], ...JSON.parse(localStorage.getItem(STORE) || '{}') }; }
  catch { return { tu: 0, er: 0, pts: 0, clues: [] }; }
}

/** Evidence bag: stays empty until the five clues are logged, then shows the whole file. Rendered even without WebGL. */
function paintEvidence(box, state) {
  const done = CLUES.every((c) => state.clues.includes(c.id));
  box.hidden = !done;
  if (!done) { box.innerHTML = ''; return; }
  const frags = FRAGS.map((c) => `<code>${esc(c.text)}</code>`).join('<i aria-hidden="true">+</i>');
  const tips = CLUES.filter((c) => c.frag == null).map((c) => `<li><span>${c.id.toUpperCase()}</span>${esc(c.text)}</li>`).join('');
  box.innerHTML = `<div class="ev-all">
    <p class="ev-all-h"><b>${CLUES.length}/${CLUES.length}</b> All evidence collected.</p>
    <p>Put the fragments together and follow the path: <a href="evidence/">open it</a>. The terminal now answers to a new word: <code>fieldguide</code>.</p>
    <div class="ev-all-grid"><p class="ev-frags" aria-label="Fragments, in order">${frags}</p><ul class="ev-tips" aria-label="Scouting reports">${tips}</ul></div>
  </div>`;
}

/** Evidence tag that pops up when the lens logs a clue. */
function evidencePopup() {
  const dlg = document.createElement('div');
  dlg.className = 'evpop'; dlg.hidden = true;
  dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-labelledby', 'evpop-text');
  document.body.append(dlg);
  let back = null, timer = 0;
  const close = () => {
    if (dlg.hidden || !dlg.classList.contains('open')) return;
    dlg.classList.remove('open'); clearTimeout(timer);
    timer = setTimeout(() => { dlg.hidden = true; }, REDUCED ? 0 : 260);
    back?.focus({ preventScroll: true });
  };
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) close(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') {
      const f = [...dlg.querySelectorAll('button, a[href]')];
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  });
  return (c, state, from, fresh = true) => {
    const n = state.clues.length, all = fresh && n === CLUES.length;
    const path = c.frag == null ? '' : `<p class="evpop-path" aria-label="Path so far">${FRAGS.map((f) =>
      state.clues.includes(f.id) ? `<code class="${f === c ? 'is-new' : ''}">${esc(f.text)}</code>` : '<code class="miss">···</code>').join('')}</p>`;
    const time = new Date().toTimeString().slice(0, 8);
    dlg.innerHTML = `<div class="evpop-tag${all ? ' is-all' : ''}">
      <span class="evpop-hole" aria-hidden="true"></span>
      <p class="evpop-head"><span>Evidence</span><b>${c.id.toUpperCase()}</b></p>
      <p class="evpop-kind">${esc(c.kind)}</p>
      <p class="evpop-text" id="evpop-text">${esc(c.text)}</p>
      ${path}
      <p class="evpop-note">${esc(c.note)}</p>
      <dl class="evpop-meta"><div><dt>found</dt><dd>pitch ${c.x >= 0 ? '+' : ''}${c.x} / ${c.z >= 0 ? '+' : ''}${c.z}</dd></div><div><dt>${fresh ? 'logged' : 'checked'}</dt><dd>${time}</dd></div><div><dt>bag</dt><dd>${n}/${CLUES.length}</dd></div></dl>
      ${all ? '<p class="evpop-all">All evidence collected. <a href="#st-ev-list" data-close>See the file</a></p>' : ''}
      <button type="button" class="btn evpop-ok" data-close>Back to the pitch</button>
      <span class="evpop-stamp" aria-hidden="true">${fresh ? 'Logged' : 'In the bag'}</span>
    </div>`;
    back = from; clearTimeout(timer);
    dlg.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add('open')));
    dlg.querySelector('.evpop-ok').focus({ preventScroll: true });
  };
}

/** WebGL is off or blocked: keep the box visible and explain how to turn it back on. */
function fallback(host) {
  host.classList.add('no-webgl');
  $('#st-call').textContent = 'The 3D pitch needs WebGL, which is off in this browser. Turn on hardware acceleration (Chrome: Settings › System) and restart the browser.';
}

export function initStadium() {
  const host = $('#stadium');
  if (!host) return;
  paintEvidence($('#st-ev-list'), load());
  // start well before the section is on screen, so its heading animation doesn't overlap the setup
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); boot(host); } }, { rootMargin: '900px' });
  io.observe(host);
}

async function boot(host) {
  let THREE, renderer;
  const cv = $('#stadium-cv'), lensBox = $('#lens'), call = $('#st-call');
  try { THREE = await import('../vendor/three/three.module.min.js'); } catch { fallback(host); return; }
  // full quality first, then a lighter context that weak or blocklisted GPUs still grant
  for (const opts of [{ antialias: true }, { antialias: false, powerPreference: 'low-power' }]) {
    try { renderer = new THREE.WebGLRenderer({ canvas: cv, ...opts }); break; } catch { /* try the next profile */ }
  }
  if (!renderer) { fallback(host); return; }

  const state = load();
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode */ } };

  /* ---------- Renderers, scene, cameras ---------- */
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 90, 190);
  const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 400);
  const lensCam = new THREE.PerspectiveCamera(3.4, 1, 0.1, 400);
  lensCam.layers.enable(1);
  // The lens view is rendered into a texture and drawn as a disc on top of the main view (single WebGL context).
  const lensRT = new THREE.WebGLRenderTarget(512, 512, { samples: 4 });
  lensRT.texture.colorSpace = THREE.SRGBColorSpace;
  const overlay = new THREE.Scene(), ocam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  ocam.position.z = 5;
  const lensDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ map: lensRT.texture }));
  overlay.add(lensDisc);
  let lensR = 100;

  scene.add(new THREE.HemisphereLight(0x5fa8d8, 0x000000, 0.35));
  for (const [x, z] of [[-60, -44], [60, -44], [-60, 44], [60, 44]]) {
    const s = new THREE.SpotLight(0xcfeaff, 1.6, 0, 0.75, 0.9, 0);
    s.position.set(x, 38, z); s.target.position.set(x * 0.25, 0, z * 0.2);
    scene.add(s, s.target);
    // floodlight tower
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 38, 8), new THREE.MeshStandardMaterial({ color: 0x0b1726, roughness: 0.8 }));
    pole.position.set(x * 1.02, 19, z * 1.02); scene.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 0.6), new THREE.MeshBasicMaterial({ color: 0xdff3ff }));
    panel.position.set(x * 1.02, 38.5, z * 1.02); panel.lookAt(0, 0, 0); scene.add(panel);
  }

  // The setup is split into short steps with a painted frame in between:
  // one long block froze every other animation on the page (e.g. the heading scramble).
  const breathe = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  await breathe();

  /* ---------- Pitch texture ---------- */
  const PX = 20, tc = document.createElement('canvas');
  tc.width = 105 * PX; tc.height = 68 * PX;
  const g = tc.getContext('2d');
  for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#040b14' : '#06111d'; g.fillRect((i * 105 * PX) / 14, 0, (105 * PX) / 14 + 1, tc.height); }
  const X = (m) => (m + 52.5) * PX, Y = (m) => (m + 34) * PX;
  g.strokeStyle = 'rgba(98,196,240,.75)'; g.lineWidth = 3; g.shadowColor = '#1C9AD6'; g.shadowBlur = 8;
  const rect = (x1, z1, x2, z2) => g.strokeRect(X(x1), Y(z1), (x2 - x1) * PX, (z2 - z1) * PX);
  rect(-52.5, -34, 52.5, 34);
  g.beginPath(); g.moveTo(X(0), Y(-34)); g.lineTo(X(0), Y(34)); g.stroke();
  g.beginPath(); g.arc(X(0), Y(0), 9.15 * PX, 0, 7); g.stroke();
  for (const s of [-1, 1]) {
    const gx = 52.5 * s;
    rect(Math.min(gx, gx - 16.5 * s), -20.16, Math.max(gx, gx - 16.5 * s), 20.16);
    rect(Math.min(gx, gx - 5.5 * s), -9.16, Math.max(gx, gx - 5.5 * s), 9.16);
    g.beginPath(); g.arc(X(gx - 11 * s), Y(0), 9.15 * PX, s > 0 ? Math.PI - 0.93 : -0.93, s > 0 ? Math.PI + 0.93 : 0.93); g.stroke();
    g.fillStyle = 'rgba(98,196,240,.9)'; g.beginPath(); g.arc(X(gx - 11 * s), Y(0), 6, 0, 7); g.fill();
    for (const c of [-1, 1]) { g.beginPath(); g.arc(X(gx), Y(34 * c), 1 * PX, 0, 7); g.stroke(); }
  }
  g.beginPath(); g.arc(X(0), Y(0), 6, 0, 7); g.fill();
  const pitchTex = new THREE.CanvasTexture(tc);
  pitchTex.colorSpace = THREE.SRGBColorSpace; pitchTex.anisotropy = 8;
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(105, 68), new THREE.MeshStandardMaterial({ map: pitchTex, emissiveMap: pitchTex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.95 }));
  pitch.rotation.x = -Math.PI / 2; scene.add(pitch);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(150, 110), new THREE.MeshStandardMaterial({ color: 0x010306, roughness: 1 }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; scene.add(apron);

  /* ---------- Goals ---------- */
  const postMat = new THREE.MeshStandardMaterial({ color: 0xe7eef5, emissive: 0x1c9ad6, emissiveIntensity: 0.35, roughness: 0.4 });
  const netMat = new THREE.LineBasicMaterial({ color: 0x62c4f0, transparent: true, opacity: 0.22 });
  function goal(sign) {
    const grp = new THREE.Group(), x = GOAL_X * sign;
    for (const z of [-GW / 2, GW / 2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, GH, 12), postMat); p.position.set(x, GH / 2, z); grp.add(p); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, GW, 12), postMat); bar.rotation.x = Math.PI / 2; bar.position.set(x, GH, 0); grp.add(bar);
    const pts = [], d = 2 * sign, step = 0.25;
    for (let z = -GW / 2; z <= GW / 2 + 1e-6; z += step) { pts.push(x + d, 0, z, x + d, GH * 0.8, z, x, GH, z, x + d, GH * 0.8, z); }
    for (let y = 0; y <= GH * 0.8 + 1e-6; y += step) pts.push(x + d, y, -GW / 2, x + d, y, GW / 2);
    for (let t = 0; t <= 1.0001; t += step / 2) pts.push(x + d * (1 - t), GH * 0.8 + GH * 0.2 * t, -GW / 2, x + d * (1 - t), GH * 0.8 + GH * 0.2 * t, GW / 2);
    for (const z of [-GW / 2, GW / 2]) for (let y = 0; y <= GH + 1e-6; y += step) pts.push(x, Math.min(y, GH), z, x + d, Math.min(y, GH * 0.8), z);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    grp.add(new THREE.LineSegments(geo, netMat));
    scene.add(grp);
  }
  goal(1); goal(-1);

  /* ---------- Ball ---------- */
  const bc = document.createElement('canvas'); bc.width = 256; bc.height = 128;
  const bg = bc.getContext('2d'); bg.fillStyle = '#eef4f8'; bg.fillRect(0, 0, 256, 128); bg.fillStyle = '#0b1e33';
  for (let i = 0; i < 12; i++) { const x = (i % 6) * 46 + (i > 5 ? 23 : 0), y = i > 5 ? 90 : 34; bg.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; bg.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); } bg.fill(); }
  const ballTex = new THREE.CanvasTexture(bc); ballTex.colorSpace = THREE.SRGBColorSpace;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 16), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.45, emissive: 0x1c9ad6, emissiveIntensity: 0.12 }));
  const BALL0 = new THREE.Vector3(SPOT_X, 0.24, 0);
  ball.position.copy(BALL0); scene.add(ball);

  /* ---------- ErContent, the keeper ---------- */
  const kMat = new THREE.MeshStandardMaterial({ color: 0x0c1a2c, emissive: 0xe5383b, emissiveIntensity: 0.25, roughness: 0.6 });
  const keeper = new THREE.Group();
  const part = (geo, x, y, z) => { const m = new THREE.Mesh(geo, kMat); m.position.set(x, y, z); keeper.add(m); return m; };
  part(new THREE.BoxGeometry(0.34, 0.85, 0.5), 0, 0.45, 0);
  part(new THREE.BoxGeometry(0.34, 0.75, 0.6), 0, 1.25, 0);
  part(new THREE.SphereGeometry(0.17, 16, 12), 0, 1.85, 0);
  part(new THREE.BoxGeometry(0.16, 0.16, 1.7), 0, 1.5, 0);
  const lc = document.createElement('canvas'); lc.width = 512; lc.height = 128;
  const lg = lc.getContext('2d'); lg.font = '700 64px "JetBrains Mono", monospace'; lg.textAlign = 'center'; lg.fillStyle = '#E5383B'; lg.shadowColor = '#E5383B'; lg.shadowBlur = 18; lg.fillText('ErContent', 256, 84);
  const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, depthWrite: false }));
  label.scale.set(2.6, 0.65, 1); label.position.set(0, 2.55, 0); keeper.add(label);
  const nc = document.createElement('canvas'); nc.width = 256; nc.height = 256;
  const ng = nc.getContext('2d'); ng.font = '900 170px "Big Shoulders Display", Impact, sans-serif'; ng.textAlign = 'center'; ng.textBaseline = 'middle';
  ng.fillStyle = '#E7EEF5'; ng.fillText('77', 128, 138);
  const nt = new THREE.CanvasTexture(nc); nt.colorSpace = THREE.SRGBColorSpace;
  const shirt = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: nt, transparent: true }));
  shirt.position.set(-0.19, 1.27, 0); shirt.rotation.y = -Math.PI / 2; keeper.add(shirt);
  const KEEP0 = new THREE.Vector3(GOAL_X - 0.4, 0, 0);
  keeper.position.copy(KEEP0); scene.add(keeper);

  await breathe();

  /* ---------- Clues ---------- */
  const clueMeshes = CLUES.map((c) => {
    const k = document.createElement('canvas'); k.width = 1024; k.height = 384;
    const x = k.getContext('2d');
    const words = c.text.split(' '), rows = [''];
    for (const w of words) { const t = rows.at(-1) ? `${rows.at(-1)} ${w}` : w; t.length > 24 ? rows.push(w) : (rows[rows.length - 1] = t); }
    x.font = '700 66px "JetBrains Mono", monospace'; x.textAlign = 'center';
    x.shadowColor = '#1C9AD6'; x.shadowBlur = 18; x.fillStyle = '#62C4F0';
    rows.forEach((r, i) => x.fillText(r, 512, 150 + (i - (rows.length - 1) / 2) * 84));
    x.shadowBlur = 0; x.fillStyle = '#E5383B'; x.fillRect(362, 300, 300, 7);
    const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(c.x, 0.03, c.z);
    m.layers.set(1);
    if (state.clues.includes(c.id)) m.layers.enable(0);
    scene.add(m);
    return m;
  });

  await breathe();

  /* ---------- Stands: a dark bowl dotted with phone lights ---------- */
  const sc = document.createElement('canvas'); sc.width = 2048; sc.height = 256;
  const sg = sc.getContext('2d'); sg.fillStyle = '#010307'; sg.fillRect(0, 0, 2048, 256);
  for (let r = 0; r < 14; r++) { sg.fillStyle = r % 2 ? '#03080F' : '#050C16'; sg.fillRect(0, r * 18 + 4, 2048, 9); }
  for (let i = 0; i < 2600; i++) { const a = Math.random(); sg.fillStyle = a < 0.12 ? 'rgba(98,196,240,.9)' : a < 0.16 ? 'rgba(255,255,255,.85)' : 'rgba(98,196,240,.18)'; sg.fillRect(Math.random() * 2048, Math.random() * 250, a < 0.16 ? 2 : 1.5, a < 0.16 ? 2 : 1.5); }
  const standTex = new THREE.CanvasTexture(sc); standTex.colorSpace = THREE.SRGBColorSpace; standTex.wrapS = THREE.RepeatWrapping; standTex.repeat.set(3, 1);
  const stands = new THREE.Mesh(new THREE.CylinderGeometry(92, 72, 26, 64, 1, true), new THREE.MeshBasicMaterial({ map: standTex, side: THREE.BackSide, fog: false }));
  stands.scale.set(1, 1, 0.72); stands.position.y = 12; scene.add(stands);

  /* ---------- Dust in the floodlights ---------- */
  const dustGeo = new THREE.BufferGeometry(), dp = [];
  for (let i = 0; i < 500; i++) dp.push((Math.random() - 0.5) * 120, Math.random() * 30, (Math.random() - 0.5) * 80);
  dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x62c4f0, size: 0.18, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(dust);

  /* ---------- Aim target in shoot mode ---------- */
  const aim = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.24, 32), new THREE.MeshBasicMaterial({ color: 0x62c4f0, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false }));
  aim.rotation.y = -Math.PI / 2; aim.visible = false; aim.renderOrder = 10; scene.add(aim);
  const goalPlane = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ visible: false }));
  goalPlane.rotation.y = -Math.PI / 2; goalPlane.position.set(GOAL_X, 3, 0); scene.add(goalPlane);

  await breathe();

  /* ---------- Camera rigs ---------- */
  const VIEWS = {
    lens: { pos: new THREE.Vector3(-4, 56, 76), look: new THREE.Vector3(0, 0, 3) },
    shoot: { pos: new THREE.Vector3(37.2, 2.3, 0), look: new THREE.Vector3(GOAL_X, 1.3, 0) },
  };
  let mode = 'lens';
  const camPos = VIEWS.lens.pos.clone(), camLook = VIEWS.lens.look.clone();
  let tween = null;
  function setView(name) {
    const from = { p: camPos.clone(), l: camLook.clone() }, to = VIEWS[name], t0 = performance.now(), dur = REDUCED ? 1 : 1100;
    tween = (now) => {
      const p = Math.min(1, (now - t0) / dur), k = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
      camPos.lerpVectors(from.p, to.pos, k); camLook.lerpVectors(from.l, to.look, k);
      if (p >= 1) tween = null;
    };
  }

  /* ---------- Sizing ---------- */
  let W = 1, H = 1;
  const resize = () => {
    const r = host.getBoundingClientRect();
    W = r.width; H = cv.getBoundingClientRect().height;
    renderer.setSize(W, H, false);
    cam.aspect = W / H;
    const portrait = W / H < 1.2;
    cam.fov = portrait ? 50 : 38;
    cam.updateProjectionMatrix();
    // portrait screens look down the length of the pitch
    VIEWS.lens = portrait ? { pos: new THREE.Vector3(-104, 92, 0), look: new THREE.Vector3(10, 0, 0) } : { pos: new THREE.Vector3(-4, 56, 76), look: new THREE.Vector3(0, 0, 3) };
    if (mode === 'lens' && !tween) { camPos.copy(VIEWS.lens.pos); camLook.copy(VIEWS.lens.look); }
    clueMeshes.forEach((m) => { m.rotation.z = portrait ? -Math.PI / 2 : 0; });
    const ls = Math.round(Math.min(220, Math.max(140, W * 0.2)));
    lensBox.style.width = lensBox.style.height = `${ls}px`;
    lensR = ls / 2;
    ocam.left = -W / 2; ocam.right = W / 2; ocam.top = H / 2; ocam.bottom = -H / 2; ocam.updateProjectionMatrix();
    lensDisc.scale.set(lensR, lensR, 1);
  };
  resize();
  new ResizeObserver(resize).observe(host);

  /* ---------- HUD ---------- */
  const showEvidence = evidencePopup();
  const hud = { tu: $('#sc-tu'), er: $('#sc-er'), pts: $('#sc-pts'), ev: $('#sc-ev'), list: $('#st-ev-list') };
  const say = (msg) => typeText(call, msg, { speed: 12, caret: false });
  function paint() {
    hud.tu.textContent = state.tu; hud.er.textContent = state.er; hud.pts.textContent = state.pts;
    hud.ev.textContent = `${state.clues.length}/${CLUES.length}`;
    paintEvidence(hud.list, state);
  }
  paint();

  /* ---------- Input ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const lensHit = new THREE.Vector3(0, 0, 0);
  let lensOn = false, lensX = W / 2, lensY = H / 2, dwell = { id: null, t: 0 }, shown = null;
  let aimPt = { z: 0, y: 1.2 }, aimOn = false, busy = false;

  const setNdc = (cx, cy) => { const r = cv.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); return r; };
  function moveLens(cx, cy) {
    const r = setNdc(cx, cy);
    ray.setFromCamera(ndc, cam);
    if (!ray.ray.intersectPlane(ground, lensHit)) return;
    lensX = cx - r.left; lensY = cy - r.top; lensOn = true;
    lensBox.style.transform = `translate(${lensX}px, ${lensY}px)`;
    lensBox.classList.add('on');
  }
  function moveAim(cx, cy) {
    setNdc(cx, cy); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObject(goalPlane)[0];
    if (!hit) { aim.visible = false; aimOn = false; return; }
    aimPt = { z: hit.point.z, y: Math.max(0.15, hit.point.y) }; aimOn = true; aim.visible = !busy;
    aim.position.set(GOAL_X - 0.05, aimPt.y, aimPt.z);
  }
  cv.addEventListener('pointermove', (e) => { mode === 'lens' ? moveLens(e.clientX, e.clientY) : moveAim(e.clientX, e.clientY); });
  cv.addEventListener('pointerdown', (e) => {
    if (mode === 'lens') moveLens(e.clientX, e.clientY);
    else { moveAim(e.clientX, e.clientY); if (aimOn) shoot(aimPt.z, aimPt.y); }
  });
  cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { lensBox.classList.remove('on'); lensOn = false; aim.visible = false; } });
  cv.addEventListener('keydown', (e) => {
    const k = e.key;
    if (mode === 'shoot') {
      if (k === 'ArrowLeft') aimPt.z = Math.max(-4.5, aimPt.z - 0.3);
      else if (k === 'ArrowRight') aimPt.z = Math.min(4.5, aimPt.z + 0.3);
      else if (k === 'ArrowUp') aimPt.y = Math.min(3.2, aimPt.y + 0.2);
      else if (k === 'ArrowDown') aimPt.y = Math.max(0.15, aimPt.y - 0.2);
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); shoot(aimPt.z, aimPt.y); return; } else return;
      e.preventDefault(); aimOn = true; aim.visible = true; aim.position.set(GOAL_X - 0.05, aimPt.y, aimPt.z);
    } else {
      const r = cv.getBoundingClientRect(), step = 24;
      if (!lensOn) { lensX = r.width / 2; lensY = r.height / 2; }
      if (k === 'ArrowLeft') lensX -= step; else if (k === 'ArrowRight') lensX += step; else if (k === 'ArrowUp') lensY -= step; else if (k === 'ArrowDown') lensY += step; else return;
      e.preventDefault(); moveLens(r.left + lensX, r.top + lensY);
    }
  });

  host.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    host.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    host.dataset.mode = mode;
    lensBox.classList.remove('on'); lensOn = false; aim.visible = false;
    setView(mode);
    if (mode === 'shoot') fire('pitch:shoot');
    say(mode === 'lens' ? 'Sweep the pitch with the lens. Some things only show up up close.' : 'Aim inside the goal, then click or tap to shoot. ErContent is waiting.');
    cv.focus({ preventScroll: true });
  }));
  $('#st-reset').addEventListener('click', () => {
    state.tu = 0; state.er = 0; state.pts = 0; save(); paint(); say('Score reset. Clues stay found.');
  });

  /* ---------- Shooting ---------- */
  const anims = [];
  const animate = (dur, fn) => new Promise((res) => { anims.push({ t0: performance.now(), dur: REDUCED ? 1 : dur, fn, res }); });
  const ZONES = [['C', 'L', 3], ['L', 'L', 2], ['R', 'L', 2], ['C', 'H', 2], ['R', 'H', 1]]; // never L-H: see clue c1

  async function shoot(z, y) {
    if (busy) return;
    busy = true; aim.visible = false;
    const col = z < -1.22 ? 'L' : z > 1.22 ? 'R' : 'C', row = y > 1.22 ? 'H' : 'L';
    const onFrame = Math.abs(Math.abs(z) - GW / 2) < 0.14 && y < GH + 0.1 || Math.abs(y - GH) < 0.14 && Math.abs(z) < GW / 2 + 0.1;
    const out = !onFrame && (Math.abs(z) > GW / 2 || y > GH);
    let sum = ZONES.reduce((a, q) => a + q[2], 0), pick = Math.random() * sum, kz = ZONES[0];
    for (const q of ZONES) { pick -= q[2]; if (pick <= 0) { kz = q; break; } }
    const saved = !out && !onFrame && kz[0] === col && kz[1] === row;

    const from = BALL0.clone(), to = new THREE.Vector3(GOAL_X, y, z);
    const peak = 0.5 + y * 0.25;
    const kTo = { z: { L: -2.4, C: 0, R: 2.4 }[kz[0]], y: kz[1] === 'H' ? 0.55 : 0, roll: { L: -1.25, C: 0, R: 1.25 }[kz[0]] };
    const keepFrom = keeper.position.clone();
    setTimeout(() => animate(430, (p) => {
      const k = 1 - (1 - p) ** 2;
      keeper.position.set(KEEP0.x, keepFrom.y + kTo.y * Math.sin(Math.PI * Math.min(1, p * 1.2)), keepFrom.z + (kTo.z - keepFrom.z) * k);
      keeper.rotation.x = kTo.roll * k;
    }), 90);
    await animate(520, (p) => {
      ball.position.lerpVectors(from, to, p);
      ball.position.y = from.y + (to.y - from.y) * p + Math.sin(Math.PI * p) * peak * (1 - p * 0.6);
      ball.rotation.z -= 0.35; ball.rotation.y += 0.12;
    });

    let msg;
    if (onFrame) {
      msg = 'PALO! Off the woodwork. Nobody scores.';
      const back = ball.position.clone();
      await animate(500, (p) => { ball.position.set(back.x - 6 * p, Math.max(0.24, back.y * (1 - p) + Math.sin(Math.PI * p) * 0.8), back.z * (1 + p)); });
    } else if (out) {
      msg = y > GH ? 'Over the bar. ErContent laughs.' : 'Wide. ErContent didn’t even move.';
      const b = ball.position.clone();
      await animate(400, (p) => { ball.position.set(b.x + 5 * p, b.y + (y > GH ? 1.5 * p : 0), b.z + Math.sign(z) * 2 * p); });
    } else if (saved) {
      state.er += 1;
      msg = 'PARATA! ErContent reads you and saves it.';
      const b = ball.position.clone();
      await animate(520, (p) => { ball.position.set(b.x - 7 * p, Math.max(0.24, b.y * (1 - p) + Math.sin(Math.PI * p) * 1.2), b.z * (1 - p) + (z > 0 ? 3 : -3) * p); });
    } else {
      let pts = 1, why = 'Goal.';
      if (y > 2.05 && Math.abs(z) < 0.9) { pts = 5; why = 'Sotto la traversa!'; }
      else if (y > 1.7 && Math.abs(z) > 2.7) { pts = 3; why = 'Incrocio dei pali!'; }
      else if (y < 0.45 && Math.abs(z) > 2.9) { pts = 2; why = 'Rasoterra all’angolino!'; }
      state.tu += 1; state.pts += pts;
      msg = `GOL! ${why} +${pts} pts`;
      host.classList.remove('goal'); void host.offsetWidth; host.classList.add('goal');
      const b = ball.position.clone();
      await animate(380, (p) => { ball.position.set(b.x + 1.7 * p, Math.max(0.24, b.y - 0.4 * p), b.z); });
    }
    save(); paint(); say(msg);
    await new Promise((r) => setTimeout(r, REDUCED ? 300 : 1300));
    const bFrom = ball.position.clone(), kFrom = keeper.position.clone(), rFrom = keeper.rotation.x;
    await animate(500, (p) => {
      ball.position.lerpVectors(bFrom, BALL0, p);
      keeper.position.lerpVectors(kFrom, KEEP0, p); keeper.rotation.x = rFrom * (1 - p);
    });
    busy = false;
    if (aimOn) aim.visible = true;
  }

  /* ---------- Loop ---------- */
  let visible = true, last = performance.now(), raf = 0;
  // single loop guard: a quick out-and-back scroll used to start a second loop (double rendering)
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  const tmp = new THREE.Vector3();

  function loop(now) {
    raf = 0;
    const dt = Math.min(50, now - last); last = now;
    if (tween) tween(now);
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i], p = Math.min(1, (now - a.t0) / a.dur);
      a.fn(p);
      if (p >= 1) { anims.splice(i, 1); a.res(); }
    }
    const sway = mode === 'lens' && !REDUCED ? Math.sin(now / 6000) * 3 : 0;
    cam.position.set(camPos.x + sway, camPos.y, camPos.z);
    cam.lookAt(camLook);
    if (!REDUCED) { dust.rotation.y += dt * 0.00002; keeper.children[3].rotation.y = busy ? 0 : Math.sin(now / 300) * 0.15; }
    if (!busy && mode === 'shoot' && !REDUCED) keeper.position.z = KEEP0.z + Math.sin(now / 700) * 0.35;
    renderer.render(scene, cam);

    if (lensOn && mode === 'lens') {
      lensCam.position.copy(cam.position);
      lensCam.lookAt(lensHit);
      renderer.setRenderTarget(lensRT);
      renderer.render(scene, lensCam);
      renderer.setRenderTarget(null);
      lensDisc.position.set(lensX - W / 2, H / 2 - lensY, 0);
      renderer.autoClear = false;
      renderer.render(overlay, ocam);
      renderer.autoClear = true;
      // dwell on a clue: a new one is logged, one already in the bag shows its tag again
      let near = null;
      for (const [i, c] of CLUES.entries()) {
        tmp.set(c.x, 0, c.z);
        if (tmp.distanceTo(lensHit) < 3.2) { near = i; break; }
      }
      if (near !== shown) shown = null; // the lens left the last tag's clue: it may open again later
      if (near === null || near === shown) { dwell = { id: null, t: 0 }; lensBox.classList.remove('hot'); }
      else if (dwell.id !== near) { dwell = { id: near, t: now }; lensBox.classList.add('hot'); }
      else if (now - dwell.t > 650) {
        const c = CLUES[near], fresh = !state.clues.includes(c.id);
        if (fresh) {
          state.clues.push(c.id); save();
          clueMeshes[near].layers.enable(0);
          paint();
          say(state.clues.length === CLUES.length ? 'All evidence collected. The path is in the fragments.' : `Evidence logged: ${c.id.toUpperCase()}. ${CLUES.length - state.clues.length} left on the pitch.`);
        }
        lensBox.classList.remove('hot');
        dwell = { id: null, t: 0 }; shown = near;
        lensOn = false; lensBox.classList.remove('on');
        showEvidence(c, state, cv, fresh);
      }
    }
    if (visible) raf = requestAnimationFrame(loop);
  }

  // upload the big textures and compile shaders before the first frame, one step per frame
  for (const t of [pitchTex, standTex, ballTex, lt, nt, ...clueMeshes.map((m) => m.material.map)]) { renderer.initTexture(t); await breathe(); }
  for (const [s, c] of [[scene, cam], [scene, lensCam], [overlay, ocam]]) { await renderer.compileAsync(s, c).catch(() => {}); await breathe(); }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(host);
  start();
  host.classList.add('ready');
}
