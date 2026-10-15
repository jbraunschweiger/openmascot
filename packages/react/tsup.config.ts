import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.tsx' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  platform: 'neutral',
  tsconfig: '../../tsconfig.build.json',
  // <Mascot> uses hooks: mark it as a client component for React Server
  // Components frameworks (Next.js app router). Ignored everywhere else.
  banner: { js: "'use client';" },
});
