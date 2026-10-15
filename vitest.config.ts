import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // Exact-match regexes: a plain string alias would also rewrite subpaths
    // (`@openmascot/characters/echo` → `…/src/index.ts/echo`).
    alias: [
      { find: /^@openmascot\/core$/, replacement: r('./packages/core/src/index.ts') },
      { find: /^@openmascot\/web$/, replacement: r('./packages/web/src/index.ts') },
      { find: /^@openmascot\/react$/, replacement: r('./packages/react/src/index.tsx') },
      { find: /^@openmascot\/characters$/, replacement: r('./packages/characters/src/index.ts') },
      { find: /^@openmascot\/characters\/([\w-]+)$/, replacement: r('./packages/characters/src') + '/$1/index.ts' },
    ],
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx'],
    environment: 'node',
  },
});
