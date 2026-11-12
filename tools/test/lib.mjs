// Minimal test harness: no dependencies, readable output, non-zero exit on failure.
const results = [];
let group = '';

export function section(name) { group = name; console.log(`\n\x1b[1m${name}\x1b[0m`); }

export async function test(name, fn, { warnOnly = false } = {}) {
  const t0 = performance.now();
  try {
    await fn();
    results.push({ group, name, ok: true });
    console.log(`  \x1b[32m✔\x1b[0m ${name} \x1b[2m${Math.round(performance.now() - t0)}ms\x1b[0m`);
  } catch (e) {
    const msg = e?.message || String(e);
    results.push({ group, name, ok: warnOnly, warn: warnOnly, msg });
    console.log(`  ${warnOnly ? '\x1b[33m!' : '\x1b[31m✘'}\x1b[0m ${name}\n      ${msg.split('\n').join('\n      ')}`);
  }
}

export function assert(cond, msg) { if (!cond) throw new Error(msg); }
export function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

export function report() {
  const failed = results.filter((r) => !r.ok), warned = results.filter((r) => r.warn);
  console.log(`\n${results.length} checks, \x1b[32m${results.length - failed.length - warned.length} passed\x1b[0m, \x1b[33m${warned.length} warnings\x1b[0m, \x1b[31m${failed.length} failed\x1b[0m`);
  for (const f of failed) console.log(`  \x1b[31m✘\x1b[0m [${f.group}] ${f.name}`);
  return failed.length === 0;
}
