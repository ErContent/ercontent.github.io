// The hidden case in /evidence/: not part of the archive chain.
import { keyMaterial } from './normalize.js';
import { deriveRaw, unseal } from './vault.js';
import { isFound, onFire } from './hints.js';
import { scramble } from './fx.js';
import './geo.js';

document.documentElement.classList.add('js');
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtSize = (b) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`);
const KEY = 'hidden.v1', WRONG = 'Io la ringrazio e le auguro il meglio.';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ } };

let toastTimer;
function toast(main, sub = '') {
  const t = $('#toast');
  t.innerHTML = `<p class="t-main" lang="${main === WRONG ? 'it' : 'en'}">${esc(main)}</p>${sub ? `<p class="t-sub">${esc(sub)}</p>` : ''}`;
  t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 6000);
}

function hintsHTML(b) {
  const hs = b.hints || [];
  return `<h3>Hints <span class="h-count">${hs.filter(isFound).length}/${hs.length}</span></h3>
    <p>Nobody hands them out. They are hidden around the main site: some of the things you do there leave one behind.</p>
    <ol class="hint-list">${hs.map((h, i) => (isFound(h)
      ? `<li class="hint-item is-open"><span class="h-n">#${i + 1}</span><p>${esc(h.text)}</p></li>`
      : `<li class="hint-item is-locked"><span class="h-n">#${i + 1}</span><span class="h-lock">Not found yet</span></li>`)).join('')}</ol>`;
}

async function main() {
  const body = $('#ev-body');
  let c;
  try { const r = await fetch('../cases/hidden.json', { cache: 'no-cache' }); if (!r.ok) throw 0; c = await r.json(); }
  catch { body.innerHTML = '<p class="section-sub">This room is empty for now. A hidden case will be filed here.</p>'; return; }
  const b = c.content, st = load();
  const files = (b.files || []).map((f) => `<li><span class="fname">${esc(f.name)}</span><span class="fsize">${fmtSize(f.size)}</span><a href="../${f.path}" target="_blank" rel="noopener">View</a><a href="../${f.path}" download>Download</a></li>`).join('');
  const solved = st.solved;
  body.innerHTML = `
    <article class="casefile${solved ? ' is-closed' : ''}">
      ${solved ? '<div class="closed-stamp" aria-hidden="true">Case closed</div>' : ''}
      <p class="kicker">Hidden file</p>
      <h2 id="room-title">${esc(b.title)}</h2>
      <p class="case-tags">${(b.tags || []).map((t) => `<span>${esc(t)}</span>`).join('')}</p>
      <p class="brief">${esc(b.brief)}</p>
      <section class="evidence"><h3>Evidence</h3>${files ? `<ul>${files}</ul>` : '<p>The image for this case has not been filed yet.</p>'}</section>
    </article>
    <div class="tools">
      ${solved ? `<section class="panel solved-box"><h3>Case closed</h3><p>You closed the hidden file on ${new Date(solved).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Not many people get this far.</p></section>`
      : `<section class="panel"><h3>Close the case</h3><p>Spelling, spaces, accents and leetspeak don’t matter.</p>
        <form id="answer-form" novalidate>
          <div class="field"><label for="f-text">${esc(b.fields?.text || 'Answer')}</label><input class="input" id="f-text" autocomplete="off" spellcheck="false"></div>
          <p class="or">or</p>
          <div class="field"><label for="f-flag">Paste the full flag</label><input class="input" id="f-flag" autocomplete="off" spellcheck="false" placeholder="npw{...}"></div>
          <button class="btn-act" type="submit" id="check-answer">Check answer</button>
          <p class="status" id="ans-status" role="status"></p>
        </form></section>`}
      <section class="panel hints" id="hints">${hintsHTML(b)}</section>
    </div>`;
  scramble($('#room-title'), { duration: 800 });
  // main() re-runs after solving: register the listener only once
  if (!main.wired) { main.wired = true; onFire(() => { $('#hints').innerHTML = hintsHTML(b); }); }
  $('#answer-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#check-answer'), status = $('#ans-status');
    // text and flag are tried separately: a stale wrong flag must not hide a right answer
    const flag = $('#f-flag').value.trim();
    const materials = [...new Set([
      keyMaterial(c.id, b.kind, { text: $('#f-text').value }),
      flag ? keyMaterial(c.id, b.kind, { flag }) : null,
    ].filter(Boolean))];
    if (!materials.length) { status.className = 'status err'; status.textContent = 'Write the answer, or paste the full flag.'; return; }
    btn.disabled = true; btn.textContent = 'Checking…';
    let ok = false;
    for (const m of materials) {
      const raw = await deriveRaw(m, c.salt, c.iterations);
      for (const box of c.seals) if (await unseal(raw, box)) { ok = true; break; }
      if (ok) break;
    }
    btn.disabled = false; btn.textContent = 'Check answer';
    if (!ok) { status.className = 'status err'; status.textContent = 'That answer doesn’t close the case.'; toast(WRONG, 'That answer doesn’t close the case. Check it and try again.'); return; }
    save({ solved: new Date().toISOString() });
    await main();
    $('.closed-stamp')?.classList.add('is-new');
  });
}
main();
