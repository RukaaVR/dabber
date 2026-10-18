// Builds the app icon set from public/brand/mascot.svg using headless Chromium.
// Usage: node scripts/render-icons.mjs
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const pub = (p) => path.join(root, "public", p);
const mascot = fs.readFileSync(pub("brand/mascot.svg"), "utf8");
const inner = mascot.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

// App icon: mascot on a dark rounded tile with a soft blue glow.
const icon = (radius, scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><radialGradient id="bg" cx=".5" cy=".45" r=".65"><stop offset="0" stop-color="#1e3170"/><stop offset="1" stop-color="#121318"/></radialGradient></defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  <g transform="translate(${256 - 256 * scale} ${248 - 256 * scale}) scale(${scale})">${inner}</g>
</svg>`;
fs.writeFileSync(pub("icons/icon.svg"), icon(112, 0.92));

const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find((p) => fs.existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();
async function render(svg, size, out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: out, omitBackground: true });
}
await render(mascot, 256, pub("brand/logo-mark.png"));
await render(mascot, 512, pub("brand/mascot.png"));
await render(icon(112, 0.92), 512, pub("icons/icon-512.png"));
await render(icon(112, 0.92), 192, pub("icons/icon-192.png"));
await render(icon(0, 0.92), 180, pub("icons/apple-touch-icon.png"));
await render(icon(0, 0.72), 512, pub("icons/icon-maskable-512.png")); // mascot inside the 80% safe zone
for (const s of [16, 32, 48]) await render(icon(s / 4.5, 0.98), s, path.join(root, `.icon-${s}.png`));
await browser.close();
console.log("icons rendered");
