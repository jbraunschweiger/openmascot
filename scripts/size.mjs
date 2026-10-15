#!/usr/bin/env node
/**
 * Report the size of every published entry point (run `pnpm build` first).
 *
 *   pnpm size            # table
 *   pnpm size --json     # machine-readable
 *   pnpm size --markdown # for the README / CI job summary
 *
 * For each `exports` entry of each package (the ESM build):
 *   own    — that entry and its chunks, minified + gzipped, with other
 *            @openmascot/* packages and react left external;
 *   total  — what it costs an app that imports it: the same plus its
 *            @openmascot/* dependencies (react still external).
 * Both bundle *every* export of the entry, so they are upper bounds; a
 * bundler tree-shakes whatever an app doesn't use.
 */
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgs = readdirSync(join(root, 'packages'))
  .map((d) => ({ dir: join(root, 'packages', d), pkg: JSON.parse(readFileSync(join(root, 'packages', d, 'package.json'), 'utf8')) }))
  .filter(({ pkg }) => !pkg.private);
const byName = Object.fromEntries(pkgs.map((p) => [p.pkg.name, p]));

// The published (publishConfig) ESM file for a package subpath.
function distFile(name, sub = '.') {
  const p = byName[name];
  const exp = (p.pkg.publishConfig?.exports ?? {})[sub];
  const rel = exp?.import?.default;
  return rel ? join(p.dir, rel) : undefined;
}

const toDist = {
  name: 'openmascot-dist',
  setup(b) {
    b.onResolve({ filter: /^@openmascot\// }, (a) => {
      const [, scope, pkg, ...rest] = a.path.match(/^(@openmascot)\/([^/]+)(?:\/(.+))?$/) ?? [];
      const file = distFile(`${scope}/${pkg}`, rest[0] ? `./${rest[0]}` : '.');
      if (!file) return { errors: [{ text: `no published entry for ${a.path}` }] };
      return { path: file };
    });
  },
};

async function measure(entry, { withDeps }) {
  const r = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'esm',
    minify: true,
    platform: 'neutral',
    logLevel: 'silent',
    external: withDeps ? ['react', 'react/*', 'react-dom', 'react-dom/*'] : ['@openmascot/*', 'react', 'react/*'],
    plugins: withDeps ? [toDist] : [],
  });
  const code = r.outputFiles[0].contents;
  return { min: code.length, gzip: gzipSync(code, { level: 9 }).length };
}

const rows = [];
for (const { pkg, dir } of pkgs) {
  if (pkg.bin) {
    for (const file of Object.values(pkg.publishConfig?.bin ?? pkg.bin)) {
      const p = join(dir, file);
      if (!existsSync(p)) continue;
      const code = readFileSync(p);
      rows.push({ entry: `${pkg.name} (bin)`, raw: code.length, own: { min: code.length, gzip: gzipSync(code, { level: 9 }).length }, total: null });
    }
    continue;
  }
  for (const sub of Object.keys(pkg.publishConfig?.exports ?? {})) {
    if (sub === './package.json') continue;
    const file = distFile(pkg.name, sub);
    const label = sub === '.' ? pkg.name : `${pkg.name}/${sub.slice(2)}`;
    if (!file || !existsSync(file)) {
      rows.push({ entry: label, missing: true });
      continue;
    }
    rows.push({ entry: label, raw: readFileSync(file).length, own: await measure(file, { withDeps: false }), total: await measure(file, { withDeps: true }) });
  }
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else if (process.argv.includes('--markdown')) {
  console.log('| entry | own (min / gzip) | total (min / gzip) |\n|---|---:|---:|');
  for (const r of rows) {
    if (r.missing) console.log(`| \`${r.entry}\` | not built | |`);
    else console.log(`| \`${r.entry}\` | ${kb(r.own.min)} / ${kb(r.own.gzip)} | ${r.total ? `${kb(r.total.min)} / ${kb(r.total.gzip)}` : '—'} |`);
  }
  console.log('\n_own_: the entry alone; _total_: with its @openmascot/* dependencies (react excluded). Minified, gzip -9, all exports kept.');
} else {
  const table = [['entry', 'own min', 'own gzip', 'total min', 'total gzip']];
  for (const r of rows) {
    if (r.missing) table.push([r.entry, 'not built', '', '', '']);
    else table.push([r.entry, kb(r.own.min), kb(r.own.gzip), r.total ? kb(r.total.min) : '—', r.total ? kb(r.total.gzip) : '—']);
  }
  const w = table[0].map((_, i) => Math.max(...table.map((row) => row[i].length)));
  for (const [i, row] of table.entries()) {
    console.log(row.map((c, j) => (j ? c.padStart(w[j]) : c.padEnd(w[j]))).join('  '));
    if (i === 0) console.log(w.map((n) => '-'.repeat(n)).join('  '));
  }
  console.log('\nown = the entry alone; total = with its @openmascot/* dependencies (react excluded). Minified, gzip -9, all exports kept.');
}
