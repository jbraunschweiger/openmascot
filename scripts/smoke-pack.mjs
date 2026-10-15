#!/usr/bin/env node
/**
 * Pack every published @openmascot/* package and test the tarballs the way a
 * user would get them from npm.
 *
 *   node scripts/smoke-pack.mjs [--dir <consumer dir>] [--no-pack] [--keep]
 *
 * 1. `pnpm pack` each package into out/pack/ (prepack builds dist/; pnpm
 *    applies publishConfig and rewrites workspace: ranges, exactly like
 *    `pnpm publish`).
 * 2. Static checks on every tarball: manifest fields, every exports/bin target
 *    present, no sources or tests shipped, no workspace: ranges, each
 *    characters dist entry exported; then publint and are-the-types-wrong.
 * 3. A consumer project OUTSIDE the workspace (default: a fresh temp dir, so
 *    nothing resolves from the monorepo's node_modules) installs the tarballs
 *    with npm and checks:
 *      a. Node ESM + CJS: core + characters render an SVG string;
 *      b. SSR safety: @openmascot/web and @openmascot/react import in Node
 *         without a DOM, and <Mascot> server-renders;
 *      c. Vite + React app importing @openmascot/react and
 *         @openmascot/characters/echo builds, and its bundle contains Echo but
 *         no other character;
 *      d. tsc --noEmit with moduleResolution bundler, node16 (ESM and CJS),
 *         and a DOM-free lib for core;
 *      e. the CLI: `openmascot validate|lint|render` from the installed
 *         tarball and through `npx --package <tarball>` in an empty dir;
 *      f. a real browser (Chromium, if found) loads <open-mascot> from
 *         unpkg-style URLs with an import map, like the README's CDN snippet.
 *
 * Needs network access to the npm registry (react, vite, typescript, resvg).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (k) => args.includes(`--${k}`);

const packDir = join(root, 'out/pack');
const consumer = resolve(opt('dir') ?? mkdtempSync(join(tmpdir(), 'openmascot-consumer-')));
if (consumer.startsWith(root + '/') && !consumer.startsWith(join(root, 'out') + '/')) {
  throw new Error('consumer dir must be outside the workspace (or under out/)');
}

// Versions the consumer installs next to the tarballs (match the workspace).
const CONSUMER_DEPS = {
  react: '19.2.0',
  'react-dom': '19.2.0',
  '@types/react': '19.2.2',
  '@types/react-dom': '19.2.2',
  vite: '7.1.12',
  '@vitejs/plugin-react': '5.1.0',
  typescript: '5.9.3',
};

const failures = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
};
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
const step = (title) => console.log(`\n▸ ${title}`);

function run(cmd, argv, { cwd = root, env, quiet = false } = {}) {
  try {
    const out = execFileSync(cmd, argv, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
    return { ok: true, out };
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    if (!quiet) console.log(out.split('\n').map((l) => `      ${l}`).join('\n'));
    return { ok: false, out };
  }
}
function attempt(label, fn) {
  try {
    const r = fn();
    if (r === false) fail(label);
    else ok(typeof r === 'string' ? `${label} — ${r}` : label);
  } catch (e) {
    fail(`${label}: ${e instanceof Error ? e.message : e}`);
  }
}
const write = (file, text) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

// ---------------------------------------------------------------- 1. pack
const pkgDirs = readdirSync(join(root, 'packages'))
  .map((d) => join(root, 'packages', d))
  .filter((d) => existsSync(join(d, 'package.json')) && !JSON.parse(readFileSync(join(d, 'package.json'), 'utf8')).private);

if (!has('no-pack')) {
  step('pnpm pack → out/pack');
  rmSync(packDir, { recursive: true, force: true });
  mkdirSync(packDir, { recursive: true });
  const r = run('pnpm', ['-r', '--filter', './packages/*', 'pack', '--pack-destination', packDir]);
  if (!r.ok) {
    console.error('pnpm pack failed');
    process.exit(1);
  }
}
const tarballs = {};
for (const d of pkgDirs) {
  const { name, version } = JSON.parse(readFileSync(join(d, 'package.json'), 'utf8'));
  const file = join(packDir, `${name.replace('@', '').replace('/', '-')}-${version}.tgz`);
  if (!existsSync(file)) {
    console.error(`missing tarball for ${name}: ${file}`);
    process.exit(1);
  }
  tarballs[name] = file;
}

// ------------------------------------------------------- 2. static checks
step('tarball contents and manifests');
const extractRoot = join(packDir, 'extract');
rmSync(extractRoot, { recursive: true, force: true });
const manifests = {};
for (const [name, tgz] of Object.entries(tarballs)) {
  const dir = join(extractRoot, name.split('/')[1]);
  mkdirSync(dir, { recursive: true });
  execFileSync('tar', ['xzf', tgz, '-C', dir]);
  const pkgRoot = join(dir, 'package');
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
  manifests[name] = { pkg, pkgRoot };
  const files = walk(pkgRoot).map((f) => relative(pkgRoot, f));
  const problems = [];
  for (const k of ['name', 'version', 'description', 'license', 'author', 'homepage', 'repository', 'bugs', 'keywords', 'engines', 'files']) if (!pkg[k]) problems.push(`missing "${k}"`);
  if (pkg.type !== 'module') problems.push('type is not "module"');
  if (pkg.private) problems.push('private');
  if (!files.includes('LICENSE') || !files.includes('README.md')) problems.push('LICENSE/README.md missing');
  const stray = files.filter((f) => !/^(dist\/|LICENSE$|README\.md$|package\.json$)/.test(f));
  if (stray.length) problems.push(`unexpected files: ${stray.join(', ')}`);
  for (const sec of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [dep, range] of Object.entries(pkg[sec] ?? {})) if (/^(workspace|file|link):/.test(range)) problems.push(`${sec}.${dep} = ${range}`);
  }
  if (pkg.scripts?.prepublishOnly || pkg.scripts?.prepack) problems.push('lifecycle scripts leaked into the manifest');
  // Every target in main/module/types/exports/bin must exist and be built output.
  const targets = [];
  const collect = (v) => (typeof v === 'string' ? targets.push(v) : v && typeof v === 'object' && Object.values(v).forEach(collect));
  collect([pkg.main, pkg.module, pkg.types, pkg.exports, pkg.bin, pkg.typesVersions].filter(Boolean));
  for (const t of targets) {
    if (t === './package.json') continue;
    if (!t.startsWith('./dist/')) problems.push(`target outside dist: ${t}`);
    else if (!existsSync(join(pkgRoot, t))) problems.push(`target missing: ${t}`);
  }
  if (pkg.exports) {
    for (const [sub, cond] of Object.entries(pkg.exports)) {
      if (sub === './package.json') continue;
      const first = Object.keys(cond.import ?? cond)[0];
      if (first !== 'types') problems.push(`exports["${sub}"]: "types" must be the first condition`);
    }
  }
  // Every built entry directory (dist/<id>/index.js) must be reachable.
  for (const f of files.filter((f) => /^dist\/[^/]+\/index\.js$/.test(f))) {
    const sub = `./${f.split('/')[1]}`;
    if (!pkg.exports?.[sub]) problems.push(`dist entry ${f} has no "${sub}" export`);
  }
  for (const [bin, file] of Object.entries(pkg.bin ?? {})) {
    const p = join(pkgRoot, file);
    if (existsSync(p) && !readFileSync(p, 'utf8').startsWith('#!/usr/bin/env node\n')) problems.push(`bin ${bin}: missing node shebang`);
    if (existsSync(p) && !(statSync(p).mode & 0o111)) problems.push(`bin ${bin}: not executable`);
  }
  if (problems.length) fail(`${name}: ${problems.join('; ')}`);
  else ok(`${name} (${(statSync(tgz).size / 1024).toFixed(1)} kB packed, ${files.length} files)`);
}

step('publint + are-the-types-wrong');
for (const [name, tgz] of Object.entries(tarballs)) {
  const { pkg, pkgRoot } = manifests[name];
  const pl = run('pnpm', ['exec', 'publint', 'run', pkgRoot, '--strict'], { quiet: true });
  check(pl.ok, `publint ${name}${pl.ok ? '' : `\n${pl.out}`}`);
  if (pkg.types || pkg.exports) {
    const at = run('pnpm', ['exec', 'attw', tgz, '--format', 'table-flipped'], { quiet: true });
    check(at.ok, `attw ${name}${at.ok ? '' : `\n${at.out}`}`);
  }
}

// ------------------------------------------------------------ 3. consumer
step(`consumer project: ${consumer}`);
for (const f of ['node_modules', 'package-lock.json', 'src', 'dist', 'types', 'out']) rmSync(join(consumer, f), { recursive: true, force: true });
mkdirSync(consumer, { recursive: true });
const fileDeps = Object.fromEntries(Object.entries(tarballs).map(([n, f]) => [n, `file:${f}`]));
write(
  join(consumer, 'package.json'),
  JSON.stringify(
    {
      name: 'openmascot-consumer',
      private: true,
      type: 'module',
      dependencies: { ...fileDeps, ...CONSUMER_DEPS },
      // Transitive @openmascot/* deps (e.g. react → web → core) must resolve to
      // the tarballs too, not the registry.
      overrides: Object.fromEntries(Object.keys(fileDeps).map((n) => [n, `$${n}`])),
    },
    null,
    2,
  ),
);
const inst = run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: consumer });
check(inst.ok, 'npm install (tarballs + react, vite, typescript)');
if (!inst.ok) finish();

// The non-Echo characters actually shipped (pip, riff, … once they exist).
const charactersPkg = manifests['@openmascot/characters'].pkg;
const characterIds = Object.keys(charactersPkg.exports)
  .map((s) => s.slice(2))
  .filter((s) => s && s !== 'library' && s !== 'package.json');

step('a. Node ESM / CJS');
write(
  join(consumer, 'esm.mjs'),
  `import { Mascot, renderSvg } from '@openmascot/core';
import { echo, characters, library } from '@openmascot/characters';
import { echo as echo2 } from '@openmascot/characters/echo';
import { library as library2 } from '@openmascot/characters/library';
if (echo !== echo2 || library !== library2) throw new Error('subpath and root exports differ');
const m = new Mascot(echo, { seed: 42 });
m.play('emote-love');
for (let i = 0; i < 30; i++) m.update(1 / 60);
const svg = renderSvg(m.rig, m.current.frame, { padding: 40, particles: m.current.particles });
if (!svg.startsWith('<svg') || svg.length < 1000) throw new Error('bad svg');
console.log(Object.keys(characters).join(',') + ' ' + svg.length);
`,
);
write(
  join(consumer, 'cjs.cjs'),
  `const { Mascot, renderSvg } = require('@openmascot/core');
const { echo } = require('@openmascot/characters/echo');
const m = new Mascot(echo, { seed: 1 });
m.update(1 / 60);
const svg = renderSvg(m.rig, m.current.frame);
if (!svg.startsWith('<svg')) throw new Error('bad svg');
console.log(svg.length);
`,
);
attempt('ESM import core + characters (+ subpaths) renders an SVG', () => {
  const [ids, len] = execFileSync('node', ['esm.mjs'], { cwd: consumer, encoding: 'utf8' }).trim().split(' ');
  return `characters: ${ids}; ${len} chars of SVG`;
});
attempt('CJS require core + characters/echo renders an SVG', () => {
  execFileSync('node', ['cjs.cjs'], { cwd: consumer, encoding: 'utf8' });
});

step('b. SSR safety (Node, no DOM)');
write(
  join(consumer, 'ssr.mjs'),
  `import * as web from '@openmascot/web';
import { Mascot } from '@openmascot/react';
import { echo } from '@openmascot/characters/echo';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
if (typeof globalThis.document !== 'undefined') throw new Error('unexpected DOM');
if (typeof web.defineOpenMascot !== 'function') throw new Error('web exports missing');
web.defineOpenMascot({ characters: { echo } }); // must be a no-op without customElements
const html = renderToString(createElement(Mascot, { character: echo, animation: 'idle', style: { width: 240 } }));
console.log(html.length);
`,
);
write(
  join(consumer, 'ssr.cjs'),
  `require('@openmascot/web');
const { Mascot } = require('@openmascot/react');
const { echo } = require('@openmascot/characters');
const { createElement } = require('react');
const { renderToString } = require('react-dom/server');
renderToString(createElement(Mascot, { character: echo }));
`,
);
attempt('import @openmascot/web + @openmascot/react and renderToString(<Mascot>) (ESM)', () => {
  execFileSync('node', ['ssr.mjs'], { cwd: consumer, encoding: 'utf8' });
});
attempt('same via require (CJS)', () => {
  execFileSync('node', ['ssr.cjs'], { cwd: consumer, encoding: 'utf8' });
});

step('c. Vite + React app (tree-shaking per character)');
write(join(consumer, 'index.html'), `<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n`);
write(join(consumer, 'vite.config.mjs'), `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()], logLevel: 'warn' });\n`);
write(
  join(consumer, 'src/main.tsx'),
  `import { createRoot } from 'react-dom/client';
import { Mascot, useMascotRef } from '@openmascot/react';
import { echo } from '@openmascot/characters/echo';

function App() {
  const ref = useMascotRef();
  return (
    <>
      <Mascot ref={ref} character={echo} animation="idle" lookAtPointer style={{ width: 240 }} />
      <button onClick={() => ref.current?.play('wave')}>Wave</button>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
`,
);
attempt('vite build', () => {
  const r = run('npx', ['vite', 'build'], { cwd: consumer });
  if (!r.ok) throw new Error('vite build failed');
});
attempt('bundle contains Echo and none of the other characters', () => {
  const assets = join(consumer, 'dist/assets');
  const js = readdirSync(assets).filter((f) => f.endsWith('.js'));
  const bundle = js.map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
  // A distinctive run of each character's SVG source (quote/escape-free, so
  // it survives minification verbatim).
  const marker = (id) => {
    const out = execFileSync(
      'node',
      ['--input-type=module', '-e', `const m = await import('@openmascot/characters/${id}'); const c = Object.values(m).find((v) => v && typeof v === 'object' && typeof v.svg === 'string'); process.stdout.write(c ? c.svg : '');`],
      { cwd: consumer, encoding: 'utf8' },
    );
    const runs = out.split(/["'`\\\n$]/).filter((s) => s.length >= 40);
    return runs.sort((a, b) => b.length - a.length)[0]?.slice(0, 80);
  };
  const echoMarker = marker('echo');
  if (!echoMarker || !bundle.includes(echoMarker)) throw new Error('Echo art not found in the bundle (marker check broken?)');
  const others = characterIds.filter((id) => id !== 'echo' && existsSync(join(consumer, 'node_modules/@openmascot/characters/dist', id)));
  const leaked = others.filter((id) => {
    const mk = marker(id);
    if (!mk) throw new Error(`could not find ${id}'s SVG to look for`);
    return bundle.includes(mk);
  });
  if (leaked.length) throw new Error(`bundle includes: ${leaked.join(', ')}`);
  const kb = (Buffer.byteLength(bundle) / 1024).toFixed(0);
  return `${kb} kB JS; checked absent: ${others.join(', ') || '(no other characters shipped yet)'}`;
});

step('d. TypeScript consumers');
const tsFile = `import { Mascot, renderSvg, compileRig, type CharacterDef, type Clip } from '@openmascot/core';
import { DomRenderer, MascotPlayer, defineOpenMascot } from '@openmascot/web';
import { Mascot as MascotView, useMascotRef, type MascotProps } from '@openmascot/react';
import { echo, characters, library } from '@openmascot/characters';
import { echo as echoOnly } from '@openmascot/characters/echo';
import { clipCategories } from '@openmascot/characters/library';

const c: CharacterDef = echoOnly;
const clips: Record<string, Clip> = library;
const m = new Mascot(c, { seed: 1 });
const svg: string = renderSvg(m.rig, m.update(1 / 60).frame);
const rig = compileRig(echo.svg);
const cats: Record<string, string[]> = clipCategories(clips);
const props: MascotProps = { character: characters.echo, animation: 'idle' };
export { svg, rig, cats, props, DomRenderer, MascotPlayer, defineOpenMascot, MascotView, useMascotRef };
`;
const strict = { strict: true, noEmit: true, skipLibCheck: false, jsx: 'react-jsx', types: [] };
const tsconfigs = {
  bundler: { compilerOptions: { ...strict, module: 'esnext', moduleResolution: 'bundler', target: 'es2022', lib: ['es2022', 'dom'] }, files: ['types/app.ts'] },
  'node16-esm': { compilerOptions: { ...strict, module: 'node16', moduleResolution: 'node16', target: 'es2022', lib: ['es2022', 'dom'] }, files: ['types/app.ts'] },
  'node16-cjs': { compilerOptions: { ...strict, module: 'node16', moduleResolution: 'node16', target: 'es2022', lib: ['es2022', 'dom'] }, files: ['types/app.cts'] },
  // React Native / workers: core and characters must type-check without DOM lib.
  'no-dom': { compilerOptions: { ...strict, module: 'esnext', moduleResolution: 'bundler', target: 'es2022', lib: ['es2022'] }, files: ['types/core.ts'] },
};
write(join(consumer, 'types/app.ts'), tsFile);
write(join(consumer, 'types/app.cts'), tsFile.replace(/^export .*$/m, 'export = { svg, rig, cats, props, DomRenderer, MascotPlayer, defineOpenMascot, MascotView, useMascotRef };'));
write(
  join(consumer, 'types/core.ts'),
  `import { Mascot, renderSvg } from '@openmascot/core';\nimport { echo } from '@openmascot/characters/echo';\nexport const svg: string = renderSvg(new Mascot(echo).rig, new Mascot(echo).update(0.1).frame);\n`,
);
for (const [name, cfg] of Object.entries(tsconfigs)) {
  write(join(consumer, `tsconfig.${name}.json`), JSON.stringify(cfg, null, 2));
  attempt(`tsc --noEmit (${name})`, () => {
    const r = run('npx', ['tsc', '-p', `tsconfig.${name}.json`], { cwd: consumer });
    if (!r.ok) throw new Error('type errors');
  });
}

step('e. CLI');
const cli = (argv, cwd = consumer) => execFileSync('npx', ['openmascot', ...argv], { cwd, encoding: 'utf8' });
attempt('npx openmascot validate echo', () => {
  const out = cli(['validate', 'echo']);
  if (!out.includes('✓ no warnings')) throw new Error(out);
});
attempt('npx openmascot lint echo', () => {
  const out = cli(['lint', 'echo']);
  if (!/✓ \d+ clips OK/.test(out)) throw new Error(out);
  return out.trim().split('\n').at(-1);
});
attempt('npx openmascot render echo → PNG (resvg)', () => {
  cli(['render', 'echo', '--clip', 'wave', '--time', '0.5', '--out', 'out/echo.png']);
  const png = readFileSync(join(consumer, 'out/echo.png'));
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  return `${(png.length / 1024).toFixed(0)} kB`;
});
attempt('npx --package <cli tarball> openmascot validate echo (fresh dir, like `npx @openmascot/cli`)', () => {
  const empty = join(consumer, 'npx-empty');
  rmSync(empty, { recursive: true, force: true });
  mkdirSync(empty);
  const out = execFileSync('npx', ['--yes', '--package', tarballs['@openmascot/cli'], '--', 'openmascot', 'validate', 'echo'], {
    cwd: empty,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: join(consumer, '.npm-cache') },
  });
  if (!out.includes('✓ no warnings')) throw new Error(out);
});

step('f. Browser: <open-mascot> from CDN-style URLs + import map');
await browserCheck();

finish();

// Serves the extracted tarballs under unpkg-style URLs
// (/<name>@<version>/<file>) and loads the custom element through an import
// map, the way the README's CDN snippet does. Needs Chromium; skipped (not
// failed) when none is found.
async function browserCheck() {
  const exe = [process.env.CHROMIUM_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', ...pwBrowsers()].find((p) => p && existsSync(p));
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {}
  if (!exe || !chromium) {
    console.log('  – skipped (no Chromium / playwright-core; set CHROMIUM_PATH)');
    return;
  }
  const { createServer } = await import('node:http');
  const url = (name, file) => `/${name}@${manifests[name].pkg.version}/${file}`;
  const importMap = {
    imports: {
      '@openmascot/core': url('@openmascot/core', 'dist/index.js'),
      '@openmascot/web': url('@openmascot/web', 'dist/index.js'),
      '@openmascot/characters/echo': url('@openmascot/characters', 'dist/echo/index.js'),
    },
  };
  const html = `<!doctype html><html><body>
<open-mascot character="echo" animation="wave" style="width:240px;display:block"></open-mascot>
<script type="importmap">${JSON.stringify(importMap)}</script>
<script type="module">
  import { defineOpenMascot } from '@openmascot/web';
  import { echo } from '@openmascot/characters/echo';
  defineOpenMascot({ characters: { echo } });
</script></body></html>`;
  const server = createServer((req, res) => {
    const m = decodeURIComponent(req.url.split('?')[0]).match(/^\/(@openmascot\/[^@]+)@[^/]+\/(.+)$/);
    const file = m && manifests[m[1]] && join(manifests[m[1]].pkgRoot, m[2]);
    if (req.url === '/favicon.ico') {
      res.writeHead(204).end();
    } else if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' }).end(html);
    } else if (file && file.startsWith(manifests[m[1]].pkgRoot) && existsSync(file)) {
      res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }).end(readFileSync(file));
    } else res.writeHead(404).end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: exe });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForSelector('open-mascot svg', { timeout: 10000 });
    await page.waitForTimeout(500);
    const groups = await page.evaluate(() => document.querySelectorAll('open-mascot svg g').length);
    check(groups > 20 && !errors.length, `<open-mascot> rendered ${groups} groups in Chromium${errors.length ? `; errors: ${errors.join(' | ')}` : ''}`);
  } catch (e) {
    fail(`browser check: ${e instanceof Error ? e.message : e}`);
  } finally {
    await browser.close();
    server.close();
  }
}

function pwBrowsers() {
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((d) => d.startsWith('chromium-'))
    .flatMap((d) => ['chrome-linux/chrome', 'chrome-linux64/chrome'].map((p) => join(base, d, p)));
}

function finish() {
  if (!has('keep') && !opt('dir')) rmSync(consumer, { recursive: true, force: true });
  console.log(failures.length ? `\n✗ ${failures.length} problem(s):\n- ${failures.join('\n- ')}` : '\n✓ packed packages work for consumers');
  process.exit(failures.length ? 1 : 0);
}
