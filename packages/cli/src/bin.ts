#!/usr/bin/env -S npx tsx
/**
 * openmascot CLI
 *
 *   openmascot validate <character|file.svg>
 *   openmascot list [character]
 *   openmascot framesheet <character> <clip> [--frames 12] [--cols 6] [--from idle] [--bpm 120]
 *        [--start s] [--duration s] [--per-beat 4] [--padding 70] [--out out/x.png]
 *   openmascot framesheet <character> --expressions
 *   openmascot framesheet <character> --sweep root.yaw [--range 0,360] | --param lookX --range -1,1
 *   openmascot render <character> [--clip idle] [--time 0.5] [--expression happy] [--out out/x.svg|png]
 *   openmascot lint [character]           # lint every clip against the rig
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { characters } from '@openmascot/characters';
import { compileRig, describeRig, lintClip, Mascot, renderSvg, type CharacterDef, type RigWarning } from '@openmascot/core';
import { clipSheet, expressionSheet, sweepSheet } from './sheet';

// Kept in sync with the header comment. (The published CLI is a bundle, so it
// can't print its own source the way the tsx entry could.)
const USAGE = `usage:
  openmascot validate <character|file.svg>
  openmascot list [character]
  openmascot framesheet <character> <clip> [--frames 12] [--cols 6] [--from idle] [--bpm 120]
       [--start s] [--duration s] [--per-beat 4] [--padding 70] [--out out/x.png]
  openmascot framesheet <character> --expressions
  openmascot framesheet <character> --sweep root.yaw [--range 0,360] | --param lookX --range -1,1
  openmascot render <character> [--clip idle] [--time 0.5] [--expression happy] [--out out/x.svg|png]
  openmascot lint [character]           # lint every clip against the rig`;

const argv = process.argv.slice(2);
const flags: Record<string, string | true> = {};
const pos: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[k] = next;
      i++;
    } else flags[k] = true;
  } else pos.push(a);
}
const flag = (k: string) => (typeof flags[k] === 'string' ? (flags[k] as string) : undefined);
const num = (k: string, d: number) => (flag(k) !== undefined ? Number(flag(k)) : d);

function loadCharacter(id: string | undefined): CharacterDef {
  if (!id) return characters.echo;
  if (characters[id]) return characters[id];
  if (id.endsWith('.svg')) {
    return { id: 'custom', name: id, svg: readFileSync(resolve(id), 'utf8'), expressions: { neutral: {} } };
  }
  console.error(`Unknown character "${id}". Known: ${Object.keys(characters).join(', ')}`);
  process.exit(1);
}

async function write(svg: string, out: string, width?: number) {
  mkdirSync(dirname(resolve(out)), { recursive: true });
  if (out.endsWith('.svg')) {
    writeFileSync(out, svg);
  } else {
    const { Resvg } = await import('@resvg/resvg-js');
    const r = new Resvg(svg, {
      fitTo: width ? { mode: 'width', value: width } : { mode: 'original' },
      font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' },
    });
    writeFileSync(out, r.render().asPng());
  }
  console.log(`wrote ${out}`);
}

async function main() {
  const [cmd, ...rest] = pos;
  switch (cmd) {
    case 'validate': {
      const c = loadCharacter(rest[0]);
      const warnings: RigWarning[] = [];
      const rig = compileRig(c.svg, { warnings });
      console.log(describeRig(rig));
      console.log(`\n${rig.bones.length} bone instances, ${rig.slots.length} slots`);
      for (const [name, map] of Object.entries(c.expressions)) {
        for (const [slot, variant] of Object.entries(map)) {
          const s = rig.slotsByName[slot];
          if (!s) warnings.push({ message: `expression "${name}": unknown slot "${slot}"` });
          else if (!s.variants.some((v) => v.name === variant)) warnings.push({ message: `expression "${name}": slot "${slot}" has no variant "${variant}"` });
        }
      }
      for (const [p, def] of Object.entries(c.params ?? {})) {
        for (const d of def.drives) if (!rig.bonesByName[d.bone]) warnings.push({ message: `param "${p}" drives unknown bone "${d.bone}"` });
      }
      for (const w of warnings) console.warn(`warning: ${w.message}`);
      if (!warnings.length) console.log('✓ no warnings');
      break;
    }
    case 'list': {
      const c = loadCharacter(rest[0]);
      const m = new Mascot(c, { alive: false });
      const byCat: Record<string, string[]> = {};
      for (const [n, clip] of Object.entries(m.clips)) (byCat[clip.category ?? 'other'] ??= []).push(n);
      for (const [cat, names] of Object.entries(byCat)) console.log(`${cat}: ${names.join(', ')}`);
      console.log(`expressions: ${Object.keys(c.expressions).join(', ')}`);
      console.log(`effects: ${Object.keys(m.effects).join(', ')}`);
      break;
    }
    case 'lint': {
      const c = loadCharacter(rest[0]);
      const m = new Mascot(c, { alive: false });
      const bones = new Set(Object.keys(m.rig.bonesByName));
      const params = new Set(Object.keys(c.params ?? {}));
      let bad = 0;
      for (const [n, clip] of Object.entries(m.clips)) {
        const probs = lintClip(clip, bones, params);
        for (const e of clip.events ?? []) if (!m.effects[e.effect]) probs.push(`unknown effect "${e.effect}"`);
        for (const [, e] of clip.expression ?? []) if (!c.expressions[e]) probs.push(`unknown expression "${e}"`);
        if (probs.length) {
          bad++;
          console.log(`✗ ${n}\n  - ${probs.join('\n  - ')}`);
        }
      }
      console.log(bad ? `${bad} clip(s) with problems` : `✓ ${Object.keys(m.clips).length} clips OK`);
      process.exitCode = bad ? 1 : 0;
      break;
    }
    case 'framesheet': {
      const c = loadCharacter(rest[0]);
      const clip = rest[1];
      let svg: string;
      let name: string;
      if (flags.expressions) {
        svg = expressionSheet(c, { tile: num('tile', 220) });
        name = 'expressions';
      } else if (flag('sweep') || flag('param')) {
        const [from, to] = (flag('range') ?? (flag('param') ? '-1,1' : '0,360')).split(',').map(Number);
        const [bone, channel] = (flag('sweep') ?? 'root.yaw').split('.');
        svg = sweepSheet(c, { bone, channel, from, to, param: flag('param'), frames: num('frames', 12), cols: num('cols', 6), tile: num('tile', 220) });
        name = `sweep-${flag('param') ?? flag('sweep')}`;
      } else {
        if (!clip) throw new Error('usage: framesheet <character> <clip>');
        svg = clipSheet(c, clip, {
          frames: num('frames', 12),
          cols: num('cols', 6),
          tile: num('tile', 220),
          duration: flag('duration') ? Number(flag('duration')) : undefined,
          start: num('start', 0),
          perBeat: flag('per-beat') ? Number(flag('per-beat')) : undefined,
          padding: flag('padding') ? Number(flag('padding')) : undefined,
          warmup: num('warmup', 0),
          bpm: flag('bpm') ? Number(flag('bpm')) : undefined,
          from: flag('from'),
          fromHold: num('hold', 0.6),
          alive: !!flags.alive,
        });
        name = clip + (flag('from') ? `-from-${flag('from')}` : '');
      }
      await write(svg, flag('out') ?? `out/sheets/${c.id}-${name}.png`);
      break;
    }
    case 'render': {
      const c = loadCharacter(rest[0]);
      const m = new Mascot(c, { alive: false, initial: flag('clip') ?? undefined });
      if (flag('expression')) m.setExpression(flag('expression')!);
      const t = num('time', 0);
      for (let i = 0; i < Math.max(20, Math.round(t * 60)); i++) m.update(1 / 60);
      const svg = renderSvg(m.rig, m.current.frame, { padding: num('padding', 30), particles: m.current.particles });
      await write(svg, flag('out') ?? `out/${c.id}.png`, num('width', 600));
      break;
    }
    default:
      console.log(USAGE);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
