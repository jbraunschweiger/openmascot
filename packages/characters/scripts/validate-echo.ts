// Dev check: compile echo.svg with the core rig compiler and print the tree.
//   npx tsx packages/characters/scripts/validate-echo.ts
import { readFileSync } from "node:fs";
import { compileRig, describeRig } from "../../core/src/rig.ts";

const src = readFileSync(new URL("../src/echo/echo.svg", import.meta.url), "utf8");
const warnings: { message: string }[] = [];
const rig = compileRig(src, { warnings } as never);
console.log(describeRig(rig));
console.log(warnings.length ? warnings.map((w) => "WARN " + w.message).join("\n") : "no warnings");
