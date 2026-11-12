// Minimal geohash encoder and neighbour lookup.
const B32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encode(lat, lon, precision) {
  let latR = [-90, 90], lonR = [-180, 180], hash = '', bit = 0, ch = 0, even = true;
  while (hash.length < precision) {
    const r = even ? lonR : latR, v = even ? lon : lat, mid = (r[0] + r[1]) / 2;
    if (v >= mid) { ch = (ch << 1) | 1; r[0] = mid; } else { ch <<= 1; r[1] = mid; }
    even = !even;
    if (++bit === 5) { hash += B32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

/** Cell size in degrees for a given precision. */
export function cellSize(precision) {
  const bits = precision * 5, lonBits = Math.ceil(bits / 2), latBits = Math.floor(bits / 2);
  return { dLat: 180 / 2 ** latBits, dLon: 360 / 2 ** lonBits };
}

/** The cell containing (lat, lon) plus its 8 neighbours. */
export function withNeighbours(lat, lon, precision) {
  const { dLat, dLon } = cellSize(precision);
  // snap to cell centre so neighbours are exact
  const cLat = (Math.floor((lat + 90) / dLat) + 0.5) * dLat - 90;
  const cLon = (Math.floor((lon + 180) / dLon) + 0.5) * dLon - 180;
  const out = new Set();
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) out.add(encode(cLat + a * dLat, cLon + b * dLon, precision));
  return [...out];
}
