import { readdirSync, existsSync } from 'node:fs';
import { defineConfig } from 'tsup';

// One entry per directory with an index.ts (echo, pip, riff, library, …) plus
// the root barrel, so `@openmascot/characters/<id>` only pulls in that
// character. Shared code (the clip library) is split into chunks. Every entry
// here needs a matching subpath in package.json "exports" (scripts/smoke-pack.mjs
// checks that).
const dirs = readdirSync('src', { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(`src/${d.name}/index.ts`))
  .map((d) => d.name);

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    ...Object.fromEntries(dirs.map((d) => [`${d}/index`, `src/${d}/index.ts`])),
  },
  format: ['esm', 'cjs'],
  splitting: true,
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  platform: 'neutral',
  tsconfig: '../../tsconfig.build.json',
});
