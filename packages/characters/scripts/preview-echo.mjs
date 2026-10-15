// Preview renderer for Echo (dev only).
//   node packages/characters/scripts/preview-echo.mjs
// Writes PNGs to out/echo/: front.png (rest pose framed like the reference
// crop), sheet-*.png (every slot variant), wings-folded.png.
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const svgPath = join(repo, "packages/characters/src/echo/echo.svg");
const outDir = join(repo, "out/echo");
mkdirSync(outDir, { recursive: true });

function findChrome() {
  const base = "/opt/pw-browsers";
  for (const d of readdirSync(base)) {
    const p = join(base, d, "chrome-linux/chrome");
    if (d.startsWith("chromium-") && existsSync(p)) return p;
  }
  throw new Error("chromium not found");
}

const svg = readFileSync(svgPath, "utf8");
const browser = await chromium.launch({ executablePath: findChrome() });
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.setContent(
  `<html><body style="margin:0;background:#fff">${svg}</body></html>`,
);

// Set slot -> variant, render a viewBox region at a given pixel size.
async function shot(file, { variants = {}, viewBox, width, height }) {
  await page.evaluate(
    ({ variants, viewBox, width, height }) => {
      const el = document.querySelector("svg");
      for (const slot of el.querySelectorAll("[data-om-slot]")) {
        const vs = [...slot.children].filter((c) => c.hasAttribute("data-om-variant"));
        const want = variants[slot.getAttribute("data-om-slot")];
        vs.forEach((v, i) => {
          const name = v.getAttribute("data-om-variant");
          if (!v.hasAttribute("data-om-orig")) v.setAttribute("data-om-orig", v.getAttribute("display") ?? "");
          const on = want ? name === want : v.getAttribute("data-om-orig") !== "none";
          if (on) v.removeAttribute("display");
          else v.setAttribute("display", "none");
        });
      }
      el.setAttribute("viewBox", viewBox);
      el.setAttribute("width", width);
      el.setAttribute("height", height);
      el.style.display = "block";
    },
    { variants, viewBox, width, height },
  );
  await page.setViewportSize({ width, height });
  await page.locator("svg").screenshot({ path: join(outDir, file) });
}

// Frame matching the reference crop (front.png 1360x840, scale 0.31 units/px,
// x=0 at px 676.5, ground y=0 at px 805).
const S = 0.31;
const refVB = `${-676.5 * S} ${-805 * S} ${1360 * S} ${840 * S}`;
await shot("front.png", { viewBox: refVB, width: 1360, height: 840 });
await shot("front-small.png", { viewBox: "-212 -242 424 252", width: 848, height: 504 });
await shot("wings-folded.png", {
  variants: { "wing-l": "folded", "wing-r": "folded" },
  viewBox: "-212 -242 424 252", width: 848, height: 504,
});

const headVB = "-110 -245 220 185";
const eyes = ["open", "happy", "closed", "heart", "half", "angry", "sad", "surprised", "dizzy"];
for (const e of eyes) {
  await shot(`sheet-eye-${e}.png`, { variants: { "eye-l": e, "eye-r": e }, viewBox: headVB, width: 440, height: 370 });
}
const mouths = ["default", "smile", "open", "tongue", "o", "frown", "grin"];
for (const m of mouths) {
  await shot(`sheet-mouth-${m}.png`, { variants: { mouth: m }, viewBox: headVB, width: 440, height: 370 });
}
await shot(`sheet-blush-on.png`, { variants: { blush: "on", "eye-l": "happy", "eye-r": "happy", mouth: "smile" }, viewBox: headVB, width: 440, height: 370 });
// expression combos like the reference emotions sheet
const combos = {
  excited: { mouth: "open" },
  love: { "eye-l": "happy", "eye-r": "happy", mouth: "smile", blush: "on" },
  unimpressed: { "eye-l": "half", "eye-r": "half", "wing-l": "folded", "wing-r": "folded" },
  playful: { "eye-r": "happy", mouth: "tongue" },
  inlove: { "eye-l": "heart", "eye-r": "heart", mouth: "open" },
  determined: { "eye-l": "angry", "eye-r": "angry" },
  sad: { "eye-l": "sad", "eye-r": "sad", mouth: "frown", "wing-l": "folded", "wing-r": "folded" },
  surprised: { "eye-l": "surprised", "eye-r": "surprised", mouth: "o" },
  dizzy: { "eye-l": "dizzy", "eye-r": "dizzy", mouth: "grin" },
};
for (const [k, v] of Object.entries(combos)) {
  await shot(`combo-${k}.png`, { variants: v, viewBox: "-212 -242 424 252", width: 424, height: 252 });
}
await browser.close();
console.log("wrote", outDir);
