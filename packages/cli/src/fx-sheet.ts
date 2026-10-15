#!/usr/bin/env -S npx tsx
/**
 * Effects review sheet: one row per built-in effect, one column per particle
 * age, with Echo drawn in every tile so sizes and placement can be judged
 * against the character.
 *
 *   npx tsx packages/cli/src/fx-sheet.ts [effect ...] [--ages 0.1,0.3,0.6,1,1.5] [--out out/sheets/effects.png]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { echo } from '@openmascot/characters';
import { builtinEffects, Mascot, renderSvg } from '@openmascot/core';
import { composeSheet, type Tile } from './sheet';

const argv = process.argv.slice(2);
const flags: Record<string, string> = {};
const names: string[] = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[++i] ?? '';
  else names.push(argv[i]);
}
const ages = (flags.ages ?? '0.1,0.3,0.6,1.0,1.5').split(',').map(Number);
const out = flags.out ?? 'out/sheets/effects.png';
const tileW = Number(flags.tile ?? 240);

/** Per-effect emit options for the sheet (anchors / params that show the effect off). */
const demo: Record<string, { at?: string | [number, number]; params?: Record<string, unknown>; clip?: string }> = {
  'speed-lines': { params: { side: -1 } },
  wind: {},
  puff: {},
};

const effects = names.length ? names : Object.keys(builtinEffects);
const tiles: Tile[] = [];
for (const name of effects) {
  for (const age of ages) {
    const m = new Mascot(echo, { alive: false, seed: 3 });
    const fps = 60;
    for (let i = 0; i < 6; i++) m.update(1 / fps);
    const d = demo[name] ?? {};
    m.emit(name, { at: d.at, params: d.params });
    let f = m.update(0);
    const n = Math.round(age * fps);
    for (let i = 0; i < n; i++) f = m.update(1 / fps);
    tiles.push({
      label: `${name} @ ${age.toFixed(1)}s`,
      svg: renderSvg(m.rig, f.frame, { padding: [140, 70, 30, 70], particles: f.particles }),
    });
  }
}

const svg = composeSheet(tiles, { cols: ages.length, tile: tileW, title: `OpenMascot effects — ${effects.length} effects × ages ${ages.join('s, ')}s` });
mkdirSync(dirname(resolve(out)), { recursive: true });
const { Resvg } = await import('@resvg/resvg-js');
const png = new Resvg(svg, { fitTo: { mode: 'original' }, font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' } }).render().asPng();
writeFileSync(out, png);
console.log(`wrote ${out} (${tiles.length} tiles)`);
