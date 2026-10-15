# @openmascot/cli

Command line tools for [OpenMascot](../../README.md): validate rigs, lint
clips, render frames, and build **frame sheets** (contact sheets of an
animation) for visual review by humans and AI agents.

Run it without installing, or add it to a project:

```bash
npx @openmascot/cli validate echo
npm install --save-dev @openmascot/cli      # then: npx openmascot …
# or: pnpm add -D @openmascot/cli  /  yarn add -D @openmascot/cli
```

The published CLI is a single bundled file (Node 20+) with the bundled
characters built in; its only dependency is `@resvg/resvg-js` for PNG output.

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
