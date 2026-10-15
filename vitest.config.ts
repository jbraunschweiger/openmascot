import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@openmascot/core': r('./packages/core/src/index.ts'),
      '@openmascot/web': r('./packages/web/src/index.ts'),
      '@openmascot/react': r('./packages/react/src/index.tsx'),
      '@openmascot/characters': r('./packages/characters/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx'],
    environment: 'node',
  },
});
