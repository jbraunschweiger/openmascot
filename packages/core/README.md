# @openmascot/core

The framework-agnostic engine of [OpenMascot](../../README.md): annotated-SVG
rig compiler, 2.5D solver, clip playback and blending, expressions, springs,
particle effects and a string renderer. **Zero dependencies, no DOM** — runs in
browsers, Node, workers and React Native.

```bash
npm install @openmascot/core   # (0.1.0, not yet published — use the monorepo for now)
```

```ts
import { Mascot, renderSvg } from '@openmascot/core';
import { echo } from '@openmascot/characters';

const m = new Mascot(echo, { seed: 1 });
m.play('emote-happy');
m.emit('sparkles');
for (let i = 0; i < 30; i++) m.update(1 / 60);

const svg = renderSvg(m.rig, m.current.frame, { padding: 40, particles: m.current.particles });
```

Bring your own renderer by consuming `m.current` (`{ frame, particles }`): per
bone instance a local 2D matrix and opacity, the visible slot variants and the
draw order. See `src/render-string.ts` for a compact reference renderer.

Docs: [API](../../docs/api.md) · [architecture](../../docs/architecture.md) ·
[rig format](../../docs/rig-format.md) · [animation](../../docs/animation.md) ·
[pseudo-3D](../../docs/pseudo-3d.md) · [effects](../../docs/effects.md)

MIT licensed.
