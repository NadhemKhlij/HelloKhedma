// Logo icons: writes icons/favicon.svg and every PNG icon (favicon, PWA "any" + maskable, Apple touch) from one
// definition of the mark, so the logo stays identical everywhere. Run after changing the mark below:
//   node scripts/gen-icons.mjs            (CHROME_PATH=/path/to/chrome if Playwright's own browser is not installed)
// The mark (owner's choice 2026-11-09, "B refined"): a lowercase h and a dot, on a rounded square. Fixed colours here,
// taken from the site palette (css/input.css): warm charcoal --bg #1f1e1d, ivory --text #f5f4ef, and the default path
// colour #7c5cff mixed 75% with the ivory page (#9c83fd, 5.6:1 on charcoal). In the top bar (index.html, .logo-* in
// css/input.css) the same mark follows the theme and the selected path colour instead.
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const CHARCOAL = "#1f1e1d", IVORY = "#f5f4ef", DOT = "#9c83fd";
const MARK = `<path d="M22 13V51M22 37a10.5 10.5 0 0 1 21 0V51" fill="none" stroke="${IVORY}" stroke-width="7.5" stroke-linecap="round"/>`
  + `<circle cx="46" cy="14" r="5.5" fill="${DOT}"/>`;
// rounded: transparent corners (browser tab, "any" icons); otherwise full bleed (the system masks it: maskable, iOS).
const svg = ({ rounded = true, scale = 1 } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
  + `<rect width="64" height="64" ${rounded ? 'rx="14" ' : ""}fill="${CHARCOAL}"/>`
  + `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${MARK}</g></svg>\n`;

const ICONS = [
  { file: "icons/favicon-32.png", size: 32 },
  { file: "icons/icon-192.png", size: 192, scale: 0.9 },
  { file: "icons/icon-512.png", size: 512, scale: 0.9 },
  { file: "icons/icon-maskable-512.png", size: 512, rounded: false, scale: 0.78 }, // inside the 80 % safe circle
  { file: "icons/apple-touch-icon.png", size: 180, rounded: false, scale: 0.86 },
];

writeFileSync("icons/favicon.svg", svg());
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage();
for (const { file, size, ...opt } of ICONS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg(opt)}`);
  await page.screenshot({ path: file, omitBackground: true });
  console.log("wrote", file);
}
await browser.close();
console.log("wrote icons/favicon.svg");
