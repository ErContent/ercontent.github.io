#!/usr/bin/env node
// Test runner.
// Usage: node tools/test/run.mjs <private-cases-folder> [--release]
//   --release  also fails if personal placeholders (Alessio Foggia …) are still in index.html
//   --headed   shows the browser while the e2e tests run
// Env: CHROMIUM_PATH=/path/to/chrome to use an existing Chromium instead of Playwright's.
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { report } from './lib.mjs';
import { runUnit } from './unit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const pathArg = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--only');
// WSL: accept C:\... paths
const toLocal = (p) => (process.platform === 'linux' && /^[A-Za-z]:[\\/]/.test(p) ? `/mnt/${p[0].toLowerCase()}/${p.slice(3).replace(/\\/g, '/')}` : p);
if (!pathArg) { console.error('Usage: node tools/test/run.mjs <private-cases-folder> [--release]'); process.exit(2); }
const SRC = resolve(toLocal(pathArg));

let cfg;
try { ({ default: cfg } = await import(pathToFileURL(join(SRC, 'cases.config.mjs')).href)); }
catch { console.error(`Cannot read ${join(SRC, 'cases.config.mjs')}`); process.exit(2); }

const ctx = { ROOT, SRC, cfg, release: flag('--release'), headed: flag('--headed'), chromiumPath: process.env.CHROMIUM_PATH };
console.log(`Testing ${ROOT}\nAnswers from ${SRC}`);

try {
  if (only !== 'e2e') await runUnit(ctx);
} catch (e) {
  console.error(`\n\x1b[31mTest run aborted:\x1b[0m ${e.message}`);
  process.exit(1);
}
process.exit(report() ? 0 : 1);
