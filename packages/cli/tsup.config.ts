import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

// The CLI ships as one self-contained ESM file: @openmascot/core and
// @openmascot/characters are bundled in, only @resvg/resvg-js (native) stays
// a runtime dependency.
export default defineConfig({
  entry: { bin: 'src/bin.ts' },
  format: ['esm'],
  sourcemap: true,
  clean: true,
  target: 'node20',
  platform: 'node',
  noExternal: ['@openmascot/core', '@openmascot/characters'],
  async onSuccess() {
    // src/bin.ts starts with a tsx shebang for running from source; the built
    // file runs on plain node.
    const file = 'dist/bin.js';
    const code = readFileSync(file, 'utf8').replace(/^#!.*\n/, '');
    writeFileSync(file, `#!/usr/bin/env node\n${code}`);
    chmodSync(file, 0o755);
  },
});
