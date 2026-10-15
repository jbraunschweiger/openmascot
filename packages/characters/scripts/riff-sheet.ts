/**
 * Review sheets for Riff (works before Riff is registered in the character
 * index). Writes PNGs to out/riff/.
 *
 *   npx tsx packages/characters/scripts/riff-sheet.ts rest
 *   npx tsx packages/characters/scripts/riff-sheet.ts expressions
 *   npx tsx packages/characters/scripts/riff-sheet.ts sweep root.yaw 0 345 24
 *   npx tsx packages/characters/scripts/riff-sheet.ts param lookX -1 1 7
 *   npx tsx packages/characters/scripts/riff-sheet.ts clip <name> [frames] [--from idle] [--per-beat 2] [--cols 6]
 *   npx tsx packages/characters/scripts/riff-sheet.ts compare      # reference vs Riff vs Echo
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { Mascot, renderSvg } from '@openmascot/core';
import { clipFrames, clipSheet, composeSheet, expressionSheet, sweepSheet } from '../../cli/src/sheet';
import { riff } from '../src/riff';
import { echo } from '../src/echo';

const OUT = 'out/riff';
/** The reference crop (lineup px 1190..1590 × 40..380) in character units (0.82 u/px, ground at px 361). */
const VB: [number, number, number, number] = [-161.54, -263.22, 328, 278.8];
mkdirSync(OUT, { recursive: true });

function png(svg: string, file: string, width?: number) {
  const r = new Resvg(svg, {
    fitTo: width ? { mode: 'width', value: width } : { mode: 'original' },
    font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' },
  });
  writeFileSync(`${OUT}/${file}`, r.render().asPng());
  console.log(`wrote ${OUT}/${file}`);
}

const [cmd, ...args] = process.argv.slice(2);
const flag = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));

switch (cmd) {
  case 'rest': {
    const m = new Mascot(riff, { alive: false, initial: '__none__' });
    png(renderSvg(m.rig, m.current.frame, { padding: 20 }), 'rest.png', 700);
    break;
  }
  case 'compare': {
    const m = new Mascot(riff, { alive: false, initial: '__none__' });
    const e = new Mascot(echo, { alive: false, initial: '__none__' });
    const ref = readFileSync('out/riff/ref.png').toString('base64');
    const tiles = [
      { label: 'reference', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 680"><image href="data:image/png;base64,${ref}" width="800" height="680"/></svg>` },
      { label: 'riff', svg: renderSvg(m.rig, m.current.frame, { viewBox: VB }) },
      {
        label: 'overlay',
        svg: renderSvg(m.rig, m.current.frame, { viewBox: VB }).replace(
          /<\/svg>$/,
          `<image href="data:image/png;base64,${ref}" x="${VB[0]}" y="${VB[1]}" width="${VB[2]}" height="${VB[3]}" opacity=".45"/></svg>`,
        ),
      },
    ];
    png(composeSheet(tiles, { cols: 3, tile: 400, title: 'Riff vs reference' }), 'compare.png');
    const lineup = [
      { label: 'echo', svg: renderSvg(e.rig, e.current.frame, { padding: 20 }) },
      { label: 'riff', svg: renderSvg(m.rig, m.current.frame, { padding: 20 }) },
    ];
    png(composeSheet(lineup, { cols: 2, tile: 420, title: 'house style' }), 'lineup.png');
    break;
  }
  case 'expressions':
    png(expressionSheet(riff, { tile: 200 }), 'expressions.png');
    break;
  case 'sweep': {
    const [bc = 'root.yaw', from = '0', to = '345', frames = '24'] = pos;
    const [bone, channel] = bc.split('.');
    png(sweepSheet(riff, { bone, channel, from: +from, to: +to, frames: +frames, tile: 170, cols: Math.min(8, +frames) }), `sweep-${bc}.png`);
    break;
  }
  case 'param': {
    const [p = 'lookX', from = '-1', to = '1', frames = '7'] = pos;
    png(sweepSheet(riff, { param: p, from: +from, to: +to, frames: +frames, tile: 170, cols: Math.min(8, +frames) }), `param-${p}.png`);
    break;
  }
  case 'clip': {
    const [name, frames = '12'] = pos;
    const from = flag('from');
    const perBeat = flag('per-beat');
    png(
      clipSheet(riff, name, {
        frames: +frames, from, perBeat: perBeat ? +perBeat : undefined, tile: +(flag('tile') ?? 170), cols: +(flag('cols') ?? 6), padding: +(flag('pad') ?? 70),
        start: flag('start') ? +flag('start')! : undefined, duration: flag('duration') ? +flag('duration')! : undefined, bpm: flag('bpm') ? +flag('bpm')! : undefined,
      }),
      `clip-${name}${from ? `-from-${from}` : ''}.png`,
    );
    break;
  }
  case 'rows': {
    // rows <out-name> clipA clipB … [--frames 8] [--from idle]: one row per clip
    const [outName, ...names] = pos;
    const frames = +(flag('frames') ?? 8);
    const tiles: { label: string; svg: string }[] = [];
    for (const name of names) {
      const fr = clipFrames(riff, name, { frames, from: flag('from'), perBeat: flag('per-beat') ? +flag('per-beat')! : undefined });
      const m = fr[0].mascot;
      fr.slice(0, frames).forEach((f, i) =>
        tiles.push({ label: i === 0 ? `${name}` : `${f.time.toFixed(2)}s`, svg: renderSvg(m.rig, f.frame.frame, { padding: +(flag('pad') ?? 80), particles: f.frame.particles }) }),
      );
    }
    png(composeSheet(tiles, { cols: frames, tile: +(flag('tile') ?? 130), title: `Riff — ${outName}` }), `rows-${outName}.png`);
    break;
  }
  case 'poses': {
    // poses '<label>=<json bones>' … e.g. 'a={"leg-l":{"rot":-40}}'
    const m = new Mascot(riff, { alive: false, initial: '__none__' });
    const tiles = pos.map((spec) => {
      const [label, json] = spec.split('=');
      const bones = JSON.parse(json) as Record<string, Record<string, number>>;
      const clip = { name: 'p', duration: 1, bones: Object.fromEntries(Object.entries(bones).map(([b, chs]) => [b, Object.fromEntries(Object.entries(chs).map(([c, v]) => [c, [[0, v]]]))])) };
      m.play(clip as never, { fade: 0, then: null });
      m.update(0);
      return { label, svg: renderSvg(m.rig, m.current.frame, { padding: 110 }) };
    });
    png(composeSheet(tiles, { cols: Math.min(4, tiles.length), tile: 260, title: 'poses' }), 'poses.png');
    break;
  }
  default:
    console.error('usage: riff-sheet.ts rest|compare|expressions|sweep|param|clip …');
    process.exit(1);
}
