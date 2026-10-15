#!/usr/bin/env node
// Embeds every `src/<character>/<character>.svg` as a TS string module
// (`art.generated.ts`) so the art works in every bundler and in Node without
// loaders. Run `pnpm embed` after editing an SVG; `--check` fails if stale.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const check = process.argv.includes('--check');
let stale = 0;
for (const dir of readdirSync(root, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const svgPath = join(root, dir.name, `${dir.name}.svg`);
  if (!existsSync(svgPath)) continue;
  const svg = readFileSync(svgPath, 'utf8').trim();
  const out = `// AUTO-GENERATED from ${dir.name}.svg by scripts/embed-svg.mjs — do not edit.\n` +
    `export default ${JSON.stringify(svg)};\n`;
  const target = join(root, dir.name, 'art.generated.ts');
  const prev = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (prev === out) continue;
  if (check) {
    console.error(`stale: ${target} (run pnpm embed)`);
    stale++;
  } else {
    writeFileSync(target, out);
    console.log(`embedded ${dir.name}.svg → ${target}`);
  }
}
process.exit(stale ? 1 : 0);
