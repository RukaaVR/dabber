// Screenshot tour of the less-travelled screens (modals, menus, error pages, mobile).
// Usage: BASE=http://localhost:3000 node scripts/tour.mjs <screenshot-dir>
// Logs in as the seeded demo user "mika" (run `npm run seed` first).
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.argv[2] || "./tour-shots";
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find((p) => fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
let n = 0;
const browser = await chromium.launch({ executablePath: exe, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });

async function page(viewport) {
  const ctx = await browser.newContext({ viewport, permissions: ["microphone"] });
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && !/status of 40[14]/.test(m.text()) && errors.push(m.text()));
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return p;
}
async function shot(p, name) {
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${name}.png` });
}
async function login(p) {
  await p.goto(`${BASE}/login`);
  await p.fill("#username", "mika");
  await p.fill("#password", "dabber123");
  await p.click("button:has-text('Log In')");
  await p.waitForURL(/\/app/);
  await p.locator(".rail").waitFor();
}

try {
  const p = await page({ width: 1360, height: 860 });
  await p.goto(`${BASE}/nope`);
  await shot(p, "404");
  await p.goto(`${BASE}/invite/doesnotexist`);
  await p.locator("text=Invite invalid").waitFor();
  await shot(p, "invite-invalid");
  await p.goto(`${BASE}/login`);
  await p.fill("#username", "mika");
  await p.fill("#password", "wrong-password");
  await p.click("button:has-text('Log In')");
  await p.locator(".form-error").waitFor();
  await shot(p, "login-error");
  await login(p);
  await p.click(".rail-item[aria-label^='Dabber Lounge']");
  await p.locator(".composer textarea").waitFor();
  await shot(p, "seeded-server");
  await p.locator(".msg").last().click({ button: "right" });
  await shot(p, "message-menu");
  await p.keyboard.press("Escape");
  await p.click("button[aria-label='Emoji']");
  await p.locator(".emoji-picker").waitFor();
  await shot(p, "emoji-picker");
  await p.keyboard.press("Escape");
  await p.click(".me-card");
  await shot(p, "status-menu");
  await p.keyboard.press("Escape");
  await p.keyboard.press("Control+k");
  await shot(p, "quick-switcher");
  await p.keyboard.press("Escape");
  await p.keyboard.press("Control+/");
  await shot(p, "shortcuts");
  await p.keyboard.press("Escape");
  await p.click(".server-head");
  await p.click(".ctx-item:has-text('Create channel')");
  await shot(p, "create-channel");
  await p.keyboard.press("Escape");
  await p.click(".rail-item[aria-label='Direct messages']");
  await p.click("button[aria-label='Create a group']");
  await shot(p, "create-group");
  await p.keyboard.press("Escape");
  await p.click("[role=tab]:has-text('Add Friend')");
  await p.fill("input[aria-label='Username']", "nobody-here");
  await p.click("button:has-text('Send Friend Request')");
  await p.locator(".add-friend-box.bad").waitFor();
  await shot(p, "add-friend-error");
  await p.click("button[aria-label='Settings']");
  await shot(p, "settings-account");
  await p.click(".settings-nav button:has-text('Profile')");
  await shot(p, "settings-profile");
  await p.click(".settings-nav button:has-text('Notifications')");
  await shot(p, "settings-notifications");
  await p.click(".settings-nav button:has-text('Voice & Audio')");
  await shot(p, "settings-voice");
  await p.keyboard.press("Escape");

  const m = await page({ width: 390, height: 844 });
  await login(m);
  await m.click(".rail-item[aria-label^='Dabber Lounge']");
  await m.locator(".sidebar .channel-row").first().waitFor();
  await shot(m, "mobile-server-list");
  await m.click(".channel-row:has-text('general') .ch-main");
  await m.locator(".composer textarea").waitFor();
  await shot(m, "mobile-channel");
  await m.click("button[aria-label='Members']");
  await shot(m, "mobile-members");
  await m.click("button[aria-label='Members']");
  await m.click("button[aria-label='Upload or create']");
  await shot(m, "mobile-plus-menu");
  await m.keyboard.press("Escape");
  await m.click("button[aria-label='Back']");
  await m.click(".server-head");
  await m.click(".ctx-item:has-text('Invite people')");
  await shot(m, "mobile-invite-sheet");
  await m.keyboard.press("Escape");
  await m.click("button[aria-label='Settings']");
  await shot(m, "mobile-settings");
  await m.keyboard.press("Escape");
  await m.goto(`${BASE}/`);
  await shot(m, "mobile-landing");
} catch (e) {
  errors.push(`FAIL: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
}
console.log(errors.length ? errors.join("\n") : "no console errors");
process.exit(errors.length ? 1 : 0);
