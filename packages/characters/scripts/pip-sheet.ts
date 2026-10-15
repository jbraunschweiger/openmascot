#!/usr/bin/env -S npx tsx
/**
 * Review sheets for Pip before it is registered in src/index.ts (the CLI only
 * knows registered characters). Mirrors the `openmascot` CLI commands.
 *
 *   npx tsx packages/characters/scripts/pip-sheet.ts validate
 *   npx tsx packages/characters/scripts/pip-sheet.ts lint
 *   npx tsx packages/characters/scripts/pip-sheet.ts expressions
 *   npx tsx packages/characters/scripts/pip-sheet.ts sweep root.yaw 0 345 [frames]
 *   npx tsx packages/characters/scripts/pip-sheet.ts param lookX -1 1 [frames]
 *   npx tsx packages/characters/scripts/pip-sheet.ts clip <name> [--frames 12] [--from idle] [--per-beat 2] [--bpm 120]
 *   npx tsx packages/characters/scripts/pip-sheet.ts compare      # rest pose next to the reference crop
 *
 * Output: out/pip/*.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { compileRig, describeRig, lintClip, Mascot, renderSvg, type RigWarning } from '@openmascot/core';
import { clipSheet, composeSheet, expressionSheet, sweepSheet } from '../../cli/src/sheet';
import { library } from '../src/library';
import { pip } from '../src/pip';

const OUT = 'out/pip';
const argv = process.argv.slice(2);
const flags: Record<string, string> = {};
const pos: string[] = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[++i];
  else pos.push(argv[i]);
}

function png(svg: string, name: string) {
  mkdirSync(OUT, { recursive: true });
  const r = new Resvg(svg, { fitTo: { mode: 'original' }, font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' } });
  const file = `${OUT}/${name}.png`;
  writeFileSync(file, r.render().asPng());
  console.log(`wrote ${file}`);
}

const [cmd, ...rest] = pos;
switch (cmd) {
  case 'validate': {
    const warnings: RigWarning[] = [];
    const rig = compileRig(pip.svg, { warnings });
    console.log(describeRig(rig));
    for (const [name, map] of Object.entries(pip.expressions)) {
      for (const [slot, variant] of Object.entries(map)) {
        const s = rig.slotsByName[slot];
        if (!s) warnings.push({ message: `expression "${name}": unknown slot "${slot}"` });
        else if (!s.variants.some((v) => v.name === variant)) warnings.push({ message: `expression "${name}": slot "${slot}" has no variant "${variant}"` });
      }
    }
    for (const [p, def] of Object.entries(pip.params ?? {})) {
      for (const d of def.drives) if (!rig.bonesByName[d.bone]) warnings.push({ message: `param "${p}" drives unknown bone "${d.bone}"` });
    }
    for (const w of warnings) console.warn(`warning: ${w.message}`);
    if (!warnings.length) console.log('✓ no warnings');
    break;
  }
  case 'lint': {
    const m = new Mascot(pip, { alive: false });
    const bones = new Set(Object.keys(m.rig.bonesByName));
    const params = new Set(Object.keys(pip.params ?? {}));
    let bad = 0;
    for (const [n, clip] of Object.entries(m.clips)) {
      const probs = lintClip(clip, bones, params);
      for (const e of clip.events ?? []) if (!m.effects[e.effect]) probs.push(`unknown effect "${e.effect}"`);
      for (const [, e] of clip.expression ?? []) if (!pip.expressions[e]) probs.push(`unknown expression "${e}"`);
      const own = library[n] !== m.clips[n];
      if (probs.length) {
        bad++;
        console.log(`${own ? '✗' : '·'} ${n}${own ? '' : ' (library)'}\n  - ${probs.join('\n  - ')}`);
      }
    }
    console.log(`${Object.keys(m.clips).length} clips, ${bad} with notes`);
    break;
  }
  case 'expressions':
    png(expressionSheet(pip, { tile: 220 }), 'expressions');
    break;
  case 'sweep': {
    const [bc, from, to, frames] = rest;
    const [bone, channel] = bc.split('.');
    png(sweepSheet(pip, { bone, channel, from: +from, to: +to, frames: +(frames ?? 12), cols: +(flags.cols ?? 6), tile: 200 }), `sweep-${bc}`);
    break;
  }
  case 'param': {
    const [p, from, to, frames] = rest;
    png(sweepSheet(pip, { param: p, from: +from, to: +to, frames: +(frames ?? 7), cols: +(flags.cols ?? 7), tile: 200 }), `param-${p}`);
    break;
  }
  case 'clip': {
    const name = rest[0];
    png(
      clipSheet(pip, name, {
        frames: +(flags.frames ?? 12),
        cols: +(flags.cols ?? 6),
        tile: +(flags.tile ?? 200),
        from: flags.from,
        perBeat: flags['per-beat'] ? +flags['per-beat'] : undefined,
        bpm: flags.bpm ? +flags.bpm : undefined,
        start: flags.start ? +flags.start : 0,
        duration: flags.duration ? +flags.duration : undefined,
      }),
      `clip-${name}${flags.from ? `-from-${flags.from}` : ''}`,
    );
    break;
  }
  case 'compare': {
    // Rest pose at the same scale as the reference crop (0.85 units per px).
    const m = new Mascot(pip, { alive: false, initial: '__none__' });
    m.update(0);
    const svg = renderSvg(m.rig, m.current.frame, { padding: 0 });
    png(composeSheet([{ label: 'pip (engine rest pose)', svg }], { tile: 360, title: 'Pip rest pose' }), 'rest');
    break;
  }
  default:
    console.log('commands: validate lint expressions sweep param clip compare');
}
