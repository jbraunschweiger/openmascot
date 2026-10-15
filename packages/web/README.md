# @openmascot/web

Browser runtime for [OpenMascot](../../README.md): a live DOM SVG renderer
that only touches changed attributes, a player that owns the animation loop
(pauses off-screen and in hidden tabs, honours reduced motion, tracks the
pointer), and the `<open-mascot>` custom element.

```bash
npm install @openmascot/web @openmascot/characters   # (0.1.0, not yet published)
```

### Custom element

```html
<open-mascot character="echo" animation="idle" look-at-pointer style="width:240px"></open-mascot>
<script type="module">
  import { defineOpenMascot } from '@openmascot/web';
  import { echo } from '@openmascot/characters';
  defineOpenMascot({ characters: { echo } });
  document.querySelector('open-mascot').play('wave');
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
