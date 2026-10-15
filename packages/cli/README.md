# @openmascot/cli

Command line tools for [OpenMascot](../../README.md): validate rigs, lint
clips, render frames, and build **frame sheets** (contact sheets of an
animation) for visual review by humans and AI agents.

From the monorepo:

```bash
pnpm openmascot validate echo                     # bone tree + warnings
pnpm openmascot validate path/to/character.svg
pnpm openmascot list echo                         # clips, expressions, effects
pnpm openmascot lint echo                         # every clip vs the rig (exit 1 on problems)
pnpm openmascot render echo --clip wave --time 0.6 --out out/wave.png
pnpm framesheet echo emote-love --frames 12       # → out/sheets/echo-emote-love.png
pnpm framesheet echo wave --from idle
pnpm framesheet echo --expressions
pnpm framesheet echo --sweep root.yaw --range 0,330
pnpm framesheet echo --param lookX --range -1,1
npx tsx packages/cli/src/fx-sheet.ts hearts confetti   # effects review sheet
```

PNG output uses [@resvg/resvg-js](https://github.com/yisibl/resvg-js) (no
browser required); `.svg` outputs are written as-is. Full flag list:
[docs/api.md#cli](../../docs/api.md#cli). Review workflow:
[docs/testing.md](../../docs/testing.md). MIT licensed.
