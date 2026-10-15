# @openmascot/react

React bindings for [OpenMascot](../../README.md).

```bash
npm install @openmascot/react @openmascot/characters   # (0.1.0, not yet published)
```

```tsx
import { Mascot, useMascotRef } from '@openmascot/react';
import { echo } from '@openmascot/characters';

export function Buddy() {
  const ref = useMascotRef();
  return (
    <>
      <Mascot
        ref={ref}
        character={echo}
        animation="idle"
        expression={null}
        lookAtPointer
        onEvent={(e) => e.type === 'end' && console.log('done', e.clip)}
        style={{ width: 240 }}
      />
      <button onClick={() => ref.current?.play('emote-celebrate')}>🎉</button>
    </>
  );
}
```

Props: `character`, `animation`, `animationKey`, `expression`, `bpm`, `speed`,
`fade`, `holdLastFrame`, `lookAtPointer`, `look`, `paused`, `padding`,
`options`, `onEvent`, `className`, `style`, `title`. The ref exposes `play`,
`emit`, `setExpression`, `lookAt`, `blink`, `runtime` and `player`.

Requires React 18+. See the [API reference](../../docs/api.md#openmascotreact). MIT licensed.
