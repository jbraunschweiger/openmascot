#!/usr/bin/env node
// Screenshot a page with the preinstalled Chromium (playwright-core).
// usage: node scripts/screenshot.mjs <url> <out.png> [--width 1280] [--height 800] [--wait 1500] [--full] [--frames 1 --interval 250] [--click selector]
import { chromium } from 'playwright-core';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [url, out, ...rest] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: screenshot.mjs <url> <out.png> [--width W] [--height H] [--wait ms] [--full] [--frames N --interval ms] [--click sel]');
  process.exit(1);
}
const opt = (k, d) => {
  const i = rest.indexOf(`--${k}`);
  return i >= 0 ? rest[i + 1] : d;
};
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;
  for (const d of readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
    for (const p of ['chrome-linux/chrome', 'chrome-linux64/chrome']) if (existsSync(join(base, d, p))) return join(base, d, p);
  }
  return undefined;
}
const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: +opt('width', 1280), height: +opt('height', 800) }, deviceScaleFactor: +opt('scale', 1) });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url, { waitUntil: 'networkidle' });
const click = opt('click');
if (click) await page.click(click);
await page.waitForTimeout(+opt('wait', 1500));
mkdirSync(dirname(out), { recursive: true });
const frames = +opt('frames', 1);
for (let i = 0; i < frames; i++) {
  const file = frames === 1 ? out : out.replace(/\.png$/, `-${i}.png`);
  await page.screenshot({ path: file, fullPage: rest.includes('--full') });
  console.log(`wrote ${file}`);
  if (i < frames - 1) await page.waitForTimeout(+opt('interval', 250));
}
if (errors.length) console.error('page errors:\n' + errors.join('\n'));
await browser.close();
