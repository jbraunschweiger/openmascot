# @openmascot/web

Browser runtime for [OpenMascot](../../README.md): a live DOM SVG renderer
that only touches changed attributes, a player that owns the animation loop
(pauses off-screen and in hidden tabs, honours reduced motion, tracks the
pointer), and the `<open-mascot>` custom element.

```bash
npm install @openmascot/web @openmascot/characters
# or: pnpm add @openmascot/web @openmascot/characters
# or: yarn add @openmascot/web @openmascot/characters
```

`@openmascot/web` is safe to import during SSR: nothing touches the DOM until
you create a player or call `defineOpenMascot()`, which is also the only thing
that registers the custom element (the package has no side effects).

### Custom element

```html
<open-mascot character="echo" animation="idle" look-at-pointer style="width:240px"></open-mascot>
<script type="module">
  import { defineOpenMascot } from '@openmascot/web';
  import { echo } from '@openmascot/characters/echo';
  defineOpenMascot({ characters: { echo } });
  document.querySelector('open-mascot').play('wave');
</script>
```

No build step? Load it from a CDN — [esm.sh](https://esm.sh) resolves the
`@openmascot/core` dependency for you:

```html
<open-mascot character="echo" animation="wave" style="width:240px"></open-mascot>
<script type="module">
  import { defineOpenMascot } from 'https://esm.sh/@openmascot/web@0.1.0';
  import { echo } from 'https://esm.sh/@openmascot/characters@0.1.0/echo';
  defineOpenMascot({ characters: { echo } });
</script>
```

With unpkg or jsDelivr, add an import map for the bare specifiers:

```html
<script type="importmap">
  {
    "imports": {
      "@openmascot/core": "https://unpkg.com/@openmascot/core@0.1.0/dist/index.js",
      "@openmascot/web": "https://unpkg.com/@openmascot/web@0.1.0/dist/index.js",
      "@openmascot/characters/echo": "https://unpkg.com/@openmascot/characters@0.1.0/dist/echo/index.js"
    }
  }
</script>
<script type="module">
  import { defineOpenMascot } from '@openmascot/web';
  import { echo } from '@openmascot/characters/echo';
  defineOpenMascot({ characters: { echo } });
</script>
```

Attributes: `character`, `animation`, `expression`, `bpm`, `speed`, `padding`,
`look-at-pointer`, `paused`. Events: `mascot:start|end|loop|effect|expression`.

### Player

```ts
import { MascotPlayer } from '@openmascot/web';
const player = new MascotPlayer(document.getElementById('host')!, echo, { lookAtPointer: true });
player.play('dance-bop', { bpm: 110 });
player.mascot.setExpression('happy', 2);
```

### Renderer only

```ts
import { DomRenderer } from '@openmascot/web';
const r = new DomRenderer(mascot.rig, { padding: 40 });
host.appendChild(r.svg);
r.render(mascot.update(dt));
```

See the [API reference](../../docs/api.md#openmascotweb). MIT licensed.
