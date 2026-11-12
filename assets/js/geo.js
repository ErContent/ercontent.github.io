// Maps: Leaflet loader, dark OpenStreetMap tiles, clickable coordinates that open a map dialog.
const VENDOR = new URL('../vendor/leaflet/', import.meta.url);
let leafletReady = null;

export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  leafletReady ||= new Promise((res, rej) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = new URL('leaflet.css', VENDOR).href;
    document.head.append(css);
    const s = document.createElement('script');
    s.src = new URL('leaflet.js', VENDOR).href;
    s.onload = () => res(window.L);
    s.onerror = () => rej(new Error('leaflet'));
    document.head.append(s);
  });
  return leafletReady;
}

/** OpenStreetMap standard tiles, darkened with a CSS filter (no API key needed). */
export function osmLayer(L) {
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'tiles-dark', attribution: '&copy; OpenStreetMap contributors' });
}

export const pinIcon = (L) => L.divIcon({ className: '', html: '<div class="pin-icon"></div>', iconSize: [24, 24], iconAnchor: [3, 24] });

const dms = (v, pos, neg) => {
  const a = Math.abs(v), d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf), s = ((mf - m) * 60).toFixed(1);
  return `${d}°${String(m).padStart(2, '0')}′${s.padStart(4, '0')}″${v >= 0 ? pos : neg}`;
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** HTML for a clickable coordinate pair. */
export function coordButton(lat, lon, label = '', digits = 4) {
  return `<button type="button" class="coord" data-lat="${lat}" data-lon="${lon}" data-label="${esc(label)}" aria-label="Open ${lat.toFixed(digits)}, ${lon.toFixed(digits)} on the map">${lat.toFixed(digits)}, ${lon.toFixed(digits)}<span aria-hidden="true">↗</span></button>`;
}

/** Turns "40.85 N 14.27 E" or "40.8518, 14.2681" text inside `root` into map buttons. */
export function linkify(root) {
  const RE = /(-?\d{1,2}\.\d{2,})\s*°?\s*([NS])?\s*[,\s]\s*(-?\d{1,3}\.\d{2,})\s*°?\s*([EW])?/g;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  // global regex: reset lastIndex, or a match in one node makes the next test start mid-string
  while (walker.nextNode()) { RE.lastIndex = 0; if (RE.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode); }
  for (const n of nodes) {
    if (n.parentElement.closest('button, a, input, textarea, script, style')) continue;
    const span = document.createElement('span');
    span.innerHTML = esc(n.nodeValue).replace(RE, (_, a, ns, b, ew) => {
      const lat = parseFloat(a) * (ns === 'S' ? -1 : 1), lon = parseFloat(b) * (ew === 'W' ? -1 : 1);
      return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? coordButton(lat, lon, '', (a.split('.')[1] || '').length > 4 ? 4 : (a.split('.')[1] || '').length) : _;
    });
    n.replaceWith(...span.childNodes);
  }
}

/* ---------- Map dialog ---------- */
let dlg = null, map = null, marker = null, lastFocus = null;
function ensureDialog() {
  if (dlg) return dlg;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="mapdlg" id="mapdlg" role="dialog" aria-modal="true" aria-labelledby="mapdlg-title" hidden>
      <div class="mapdlg-box">
        <header class="mapdlg-bar">
          <p id="mapdlg-title" class="mapdlg-title"></p>
          <p class="mapdlg-dms" id="mapdlg-dms"></p>
          <button type="button" class="term-btn" id="mapdlg-close" aria-label="Close map">×</button>
        </header>
        <div class="mapdlg-map" id="mapdlg-map"></div>
      </div>
    </div>`);
  dlg = document.getElementById('mapdlg');
  const close = () => { dlg.hidden = true; lastFocus?.focus?.(); };
  document.getElementById('mapdlg-close').addEventListener('click', close);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  return dlg;
}

export async function openMap(lat, lon, label = '') {
  ensureDialog();
  lastFocus = document.activeElement;
  document.getElementById('mapdlg-title').textContent = label || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  document.getElementById('mapdlg-dms').textContent = `${dms(lat, 'N', 'S')}  ${dms(lon, 'E', 'W')}`;
  dlg.hidden = false;
  document.getElementById('mapdlg-close').focus();
  try {
    const L = await loadLeaflet();
    if (!map) {
      map = L.map('mapdlg-map', { worldCopyJump: true });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" rel="noopener">Leaflet</a>');
      osmLayer(L).addTo(map);
      marker = L.marker([lat, lon], { icon: pinIcon(L), keyboard: false }).addTo(map);
    }
    marker.setLatLng([lat, lon]);
    map.invalidateSize();
    map.setView([lat, lon], 16);
  } catch {
    document.getElementById('mapdlg-map').innerHTML = '<p style="padding:16px">The map could not load.</p>';
  }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('.coord');
  if (!b) return;
  e.preventDefault();
  openMap(parseFloat(b.dataset.lat), parseFloat(b.dataset.lon), b.dataset.label);
});
