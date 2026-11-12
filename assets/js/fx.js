// Text effects: "declassify" scramble and typewriter.
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$/<>*+=';
const running = new Map();
const typing = new WeakMap();
const unlocks = new Map();

// Same-case glyph pools keep the scrambled text about as wide as the real one.
const POOLS = { upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ', lower: 'abcdefghjkmnpqrstuvwxyz', digit: '0123456789' };
const poolFor = (ch) => (/[A-Z]/.test(ch) ? POOLS.upper : /[a-z]/.test(ch) ? POOLS.lower : /\d/.test(ch) ? POOLS.digit : null);

/**
 * Scrambles the element's text and resolves it left to right.
 * lock: freeze the element's width while scrambling, so hover targets don't move under the pointer.
 * restart: false = ignore calls while an animation is already running on this element.
 */
export function scramble(el, { duration = 800, chars = null, lock = false, restart = true } = {}) {
  if (!el) return Promise.resolve();
  const final = (el.dataset.orig ??= el.textContent);
  if (REDUCED) { el.textContent = final; return Promise.resolve(); }
  if (running.has(el)) {
    if (!restart) return Promise.resolve();
    cancelAnimationFrame(running.get(el));
    unlocks.get(el)?.();
  }
  if (!el.hasAttribute('aria-label') && /^H\d$/.test(el.tagName)) el.setAttribute('aria-label', final);
  let unlock = () => {};
  if (lock) {
    const w = el.getBoundingClientRect().width;
    const prev = { width: el.style.width, display: el.style.display, whiteSpace: el.style.whiteSpace };
    if (getComputedStyle(el).display === 'inline') el.style.display = 'inline-block';
    el.style.width = `${w}px`; el.style.whiteSpace = 'nowrap';
    unlock = () => { Object.assign(el.style, prev); unlocks.delete(el); };
    unlocks.set(el, unlock);
  }
  const t0 = performance.now();
  return new Promise((res) => {
    const f = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const fixed = Math.floor(p * final.length);
      let out = final.slice(0, fixed);
      for (let i = fixed; i < final.length; i++) {
        const pool = chars || poolFor(final[i]);
        out += pool ? pool[(Math.random() * pool.length) | 0] : final[i];
      }
      el.textContent = out;
      if (p < 1) running.set(el, requestAnimationFrame(f));
      else { el.textContent = final; running.delete(el); unlock(); res(); }
    };
    running.set(el, requestAnimationFrame(f));
  });
}

/** Types text into the element one character at a time. */
export function typeText(el, text, { speed = 30, caret = true } = {}) {
  if (!el) return Promise.resolve();
  if (REDUCED) { el.textContent = text; return Promise.resolve(); }
  clearTimeout(typing.get(el));
  el.textContent = '';
  if (caret) el.classList.add('typing');
  let i = 0;
  return new Promise((res) => {
    const step = () => {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) typing.set(el, setTimeout(step, speed + Math.random() * speed * 0.6));
      else { if (caret) setTimeout(() => el.classList.remove('typing'), 1600); res(); }
    };
    typing.set(el, setTimeout(step, speed));
  });
}
