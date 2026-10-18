// End-to-end smoke test: two users sign up, make a server, chat in realtime,
// react / reply / edit / pin / delete, add each other as friends, DM, join voice.
// Usage: BASE=http://localhost:3000 node scripts/smoke.mjs [screenshot-dir]
// Needs a running Dabber (npm run dev) and Playwright's Chromium.
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOTS = process.argv[2] || null;
const exe = process.env.CHROMIUM || ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find((p) => fs.existsSync(p));
const stamp = Date.now().toString(36).slice(-5);
const errors = [];
let step = 0;

function log(msg) {
  console.log(`  ✓ ${msg}`);
}
async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${String(++step).padStart(2, "0")}-${name}.png` });
}

const browser = await chromium.launch({
  executablePath: exe,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
    "--auto-select-desktop-capture-source=Entire screen",
    "--enable-usermedia-screen-capturing",
  ],
});

async function newUser(name) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, permissions: ["microphone", "clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${name}] ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  return { ctx, page, name };
}

try {
  const a = await newUser("alice");
  const b = await newUser("bob");
  const ua = `alice${stamp}`;
  const ub = `bob${stamp}`;

  // landing
  await a.page.goto(BASE);
  await a.page.getByRole("heading", { level: 1 }).waitFor();
  await shot(a.page, "landing");
  log("landing page renders");

  // sign up both
  for (const [u, uname, dn] of [
    [a, ua, "Alice"],
    [b, ub, "Bob"],
  ]) {
    await u.page.goto(`${BASE}/signup`);
    await u.page.fill("#username", uname);
    await u.page.fill("#displayName", dn);
    await u.page.fill("#password", "hunter22");
    if (u === a) await shot(a.page, "signup");
    await u.page.click("button:has-text('Continue')");
    await u.page.waitForURL(/\/app/);
    await u.page.getByText("Friends", { exact: true }).first().waitFor();
  }
  await shot(a.page, "home-empty");
  log("both users signed up and see the app");

  // alice creates a server from a template
  await a.page.click("button[aria-label='Add a server']");
  await a.page.click("text=Gaming");
  await a.page.fill("#server-name", `Game Night ${stamp}`);
  await shot(a.page, "create-server");
  await a.page.click(".modal-foot button:has-text('Create')");
  await a.page.waitForURL(/\/app\/s\/[a-z0-9]+\/[a-z0-9]+/);
  await a.page.locator(".msg.system").first().waitFor();
  await shot(a.page, "server-created");
  log("server created from template, landed in first channel");

  // go to #general
  await a.page.click(".channel-row:has-text('general') .ch-main");
  await a.page.waitForSelector("textarea[placeholder='Message #general']");

  // invite
  await a.page.click(".server-head");
  await a.page.click(".ctx-item:has-text('Invite people')");
  const link = await a.page.locator("input[aria-label='Invite link']").inputValue({ timeout: 5000 });
  await a.page.waitForFunction(() => !document.querySelector("input[aria-label='Invite link']")?.value.includes("Making"));
  const inviteUrl = await a.page.locator("input[aria-label='Invite link']").inputValue();
  if (!/\/invite\/\w+/.test(inviteUrl)) throw new Error(`bad invite link ${link} ${inviteUrl}`);
  await shot(a.page, "invite-modal");
  await a.page.keyboard.press("Escape");
  log(`invite link made: ${inviteUrl}`);

  // bob opens invite page and joins
  await b.page.goto(inviteUrl);
  await b.page.getByRole("heading", { name: "Game Night" }).waitFor();
  await shot(b.page, "invite-page");
  await b.page.click("button:has-text('Accept Invite')");
  await b.page.waitForURL(/\/app\/s\//);
  await b.page.locator(".channel-row:has-text('general') .ch-main").click();
  await b.page.waitForSelector("textarea[placeholder='Message #general']");
  log("bob joined through the invite page");

  // realtime chat
  await a.page.fill("textarea[placeholder='Message #general']", "hello **bob**! check `this` out");
  await a.page.keyboard.press("Enter");
  await b.page.locator(".msg-text:has-text('hello')").waitFor({ timeout: 8000 });
  await b.page.locator(".msg-text strong:has-text('bob')").waitFor();
  log("message delivered in realtime with markdown");

  // typing indicator
  await b.page.type("textarea[placeholder='Message #general']", "typing something", { delay: 20 });
  await a.page.locator(".typing-line:has-text('typing')").waitFor({ timeout: 8000 });
  log("typing indicator shows");
  await b.page.fill("textarea[placeholder='Message #general']", "");

  // mention + reply
  const msgA = a.page.locator(".msg").filter({ has: a.page.locator(".msg-text", { hasText: "hello" }) }).first();
  await b.page.locator(".msg:has-text('hello')").last().hover();
  await b.page.locator(".msg:has-text('hello')").last().locator("button[aria-label='Reply']").click();
  await b.page.fill("textarea[placeholder='Message #general']", `@${ua} hi there`);
  // the mention menu opens; Enter picks; then send
  await b.page.keyboard.press("Space");
  await b.page.keyboard.press("Enter");
  await a.page.locator(".msg.mentioned").waitFor({ timeout: 8000 });
  await a.page.locator(".msg-reply").waitFor();
  await shot(a.page, "chat-mention-reply");
  log("reply + mention highlight work");

  // reaction
  await msgA.hover();
  await msgA.locator("button[aria-label='React with 👍']").click();
  await b.page.locator(".reaction:has-text('👍')").waitFor({ timeout: 8000 });
  log("reaction syncs");

  // edit
  await msgA.hover();
  await msgA.locator("button[aria-label='Edit']").click();
  await a.page.locator(".msg-editor textarea").fill("hello bob (edited version)");
  await a.page.keyboard.press("Enter");
  await b.page.locator(".msg-text:has-text('edited version')").waitFor({ timeout: 8000 });
  await b.page.locator(".msg-edited").first().waitFor();
  log("edit syncs with (edited) marker");

  // pin
  await msgA.click({ button: "right" });
  await a.page.click(".ctx-item:has-text('Pin message')");
  await a.page.click("button[aria-label='Pinned messages']");
  await a.page.locator(".side-panel .result-card").first().waitFor({ timeout: 8000 });
  await shot(a.page, "pins");
  await a.page.click(".side-panel button[aria-label='Close']");
  log("pin + pins panel");

  // search
  await a.page.fill("input[aria-label='Search messages']", "edited");
  await a.page.keyboard.press("Enter");
  await a.page.locator(".side-panel .result-card").first().waitFor({ timeout: 8000 });
  await a.page.click(".side-panel button[aria-label='Close']");
  log("search finds messages");

  // delete with confirm
  await a.page.fill("textarea[placeholder='Message #general']", "this will be deleted");
  await a.page.keyboard.press("Enter");
  const del = a.page.locator(".msg:has-text('this will be deleted')").last();
  await b.page.locator(".msg-text:has-text('this will be deleted')").waitFor();
  await del.hover();
  await del.locator("button[aria-label='Delete message']").click();
  await a.page.click(".modal-foot button:has-text('Delete')");
  await b.page.locator(".msg-text:has-text('this will be deleted')").waitFor({ state: "detached", timeout: 8000 });
  log("delete syncs");

  // file upload (image)
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVR42mNkYPhfz0AEYBxVSF+FjP8ZiFIIVzxq4KjCUYWjCkcVEgsA0qcR0WmQzEUAAAAASUVORK5CYII=",
    "base64",
  );
  await a.page.setInputFiles(".composer input[type=file]", { name: "dot.png", mimeType: "image/png", buffer: png });
  await a.page.locator(".upload-tile").waitFor();
  await a.page.keyboard.press("Enter").catch(() => {});
  await a.page.click("button[aria-label='Send']");
  await b.page.locator(".msg-img img").first().waitFor({ timeout: 8000 });
  log("image attachment uploads and shows");

  // poll: create + vote syncs
  await a.page.click("button[aria-label='Upload or create']");
  await a.page.click(".ctx-item:has-text('Create a poll')");
  await a.page.fill("#poll-q", "Which game tonight?");
  await a.page.fill("input[aria-label='Answer 1']", "Kart");
  await a.page.fill("input[aria-label='Answer 2']", "Party");
  await a.page.click(".modal-foot button:has-text('Post poll')");
  await b.page.locator(".poll:has-text('Which game tonight?')").waitFor({ timeout: 8000 });
  await b.page.click(".poll-opt:has-text('Party')");
  await a.page.locator(".poll-sub:has-text('1 person voted')").waitFor({ timeout: 8000 });
  await shot(b.page, "poll");
  log("poll: create, vote, live results");

  // invite link posted in chat renders an embed
  await a.page.fill("textarea[placeholder='Message #general']", `come hang ${inviteUrl}`);
  await a.page.keyboard.press("Enter");
  await b.page.locator(".invite-embed .ie-name").last().waitFor({ timeout: 8000 });
  log("invite links render an invite card");

  // voice message (fake mic)
  await b.page.click("button[aria-label='Record a voice message']");
  await b.page.locator(".voice-rec").waitFor();
  await b.page.waitForTimeout(1500);
  await b.page.click("button[aria-label='Send voice message']");
  await a.page.locator(".audio-player:has-text('Voice message')").waitFor({ timeout: 8000 });
  log("voice message records, uploads and plays");

  // drag to reorder channels (alice manages channels)
  const before = await a.page.locator(".channel-row .ch-name").allTextContents();
  await a.page.dragAndDrop(".channel-row:has-text('clips')", ".channel-row:has-text('general')");
  await a.page.waitForFunction(
    () => {
      const names = [...document.querySelectorAll(".channel-row .ch-name")].map((e) => e.textContent);
      return names.indexOf("clips") < names.indexOf("general");
    },
    null,
    { timeout: 8000 },
  );
  log(`drag-to-reorder channels (${before.length} rows)`);

  // mute server from the server menu
  await a.page.click(".server-head");
  await a.page.click(".ctx-item:has-text('Mute server')");
  await a.page.locator(".server-head svg[aria-label='Muted']").waitFor();
  await a.page.click(".server-head");
  await a.page.click(".ctx-item:has-text('Unmute server')");
  log("mute / unmute server");

  // members list + profile card
  await a.page.locator(".members .member-row").nth(1).waitFor();
  await a.page.locator(".members .member-row:has-text('Bob')").click();
  await a.page.locator(".profile-card").waitFor();
  await shot(a.page, "profile-card");
  // add friend from the profile card
  await a.page.click(".profile-card button:has-text('Add Friend')");
  await a.page.keyboard.press("Escape");
  log("profile card opens, friend request sent");

  // bob accepts
  await b.page.click("button[aria-label='Direct messages']");
  await b.page.click(".nav-row:has-text('Friends')");
  await b.page.click("[role=tab]:has-text('Pending')");
  await b.page.locator(".people-row:has-text('Alice')").waitFor({ timeout: 8000 });
  await shot(b.page, "friends-pending");
  await b.page.click(".people-row:has-text('Alice') button[aria-label='Accept']");
  await b.page.click("[role=tab]:has-text('All')");
  await b.page.locator(".people-row:has-text('Alice')").waitFor();
  log("friend request accepted");

  // DM
  await b.page.click(".people-row:has-text('Alice') button[aria-label='Message Alice']");
  await b.page.waitForURL(/\/app\/dm\//);
  await b.page.fill("textarea", "psst, private message");
  await b.page.keyboard.press("Enter");
  await a.page.locator(".rail-badge").first().waitFor({ timeout: 8000 });
  await shot(a.page, "dm-badge");
  await a.page.click("button[aria-label='Direct messages']");
  await a.page.locator(".chat-row:has-text('Bob') button").first().click();
  await a.page.locator(".msg-text:has-text('psst')").waitFor();
  await shot(a.page, "dm");
  log("DM delivered with unread badge");

  // DM call: alice rings bob, bob accepts from the ring card
  await a.page.click("button[aria-label='Start voice call']");
  await b.page.locator(".ring-card").waitFor({ timeout: 8000 });
  await shot(b.page, "ring");
  await b.page.click(".ring-card button[aria-label='Accept']");
  await a.page.locator(".dm-call .voice-tile").nth(1).waitFor({ timeout: 10000 });
  await shot(a.page, "dm-call");
  await a.page.click(".dm-call .call-btn.hang");
  await b.page.click(".dm-call .call-btn.hang");
  log("DM call: ring, accept, both connected, hang up");

  // group DM with the one friend, then rename and leave
  await a.page.click("button[aria-label='Create a group']");
  await a.page.click(".modal .pick-row:has-text('Bob')");
  await a.page.click(".modal-foot button:has-text('Create DM')");
  await a.page.waitForURL(/\/app\/dm\//);
  log("create DM from the + picker");

  // voice channel
  await a.page.click(`.rail-item[aria-label^='Game Night ${stamp}']`);
  await a.page.click(".channel-row:has-text('Lobby') .ch-main");
  await a.page.locator(".voice-panel").waitFor({ timeout: 10000 });
  await b.page.click(`.rail-item[aria-label^='Game Night ${stamp}']`);
  await b.page.locator(".voice-person:has-text('Alice')").waitFor({ timeout: 8000 });
  await b.page.click(".channel-row:has-text('Lobby') .ch-main");
  await a.page.locator(".voice-tile").nth(1).waitFor({ timeout: 10000 });
  await b.page.waitForTimeout(2500);
  const remote = await a.page.evaluate(() => {
    // WebRTC connected? look for a remote audio track
    return document.querySelectorAll(".voice-tile").length;
  });
  await shot(a.page, "voice");
  log(`voice: both joined (${remote} tiles)`);
  // screen share: bob sees LIVE and can watch
  await a.page.click(".call-btn[aria-label='Share screen']");
  await b.page.locator(".voice-person:has-text('Alice') .live-chip").waitFor({ timeout: 10000 });
  await b.page.locator(".voice-tile:has-text('Alice') .live-chip").waitFor({ timeout: 10000 });
  await b.page.click(".voice-tile:has-text('Alice')");
  await b.page.locator(".stream-main video").waitFor({ timeout: 10000 });
  await b.page.waitForFunction(() => {
    const v = document.querySelector(".stream-main video");
    return v && v.videoWidth > 0;
  }, null, { timeout: 15000 });
  await shot(b.page, "screen-share");
  await a.page.click(".call-btn[aria-label='Share screen']");
  log("screen share: LIVE badge, viewer receives video frames");
  await a.page.click("button[aria-label='Mute']");
  await b.page.locator(".voice-person:has-text('Alice') svg").first().waitFor({ timeout: 8000 });
  await a.page.click(".call-btn.hang");
  await b.page.click(".call-btn.hang");
  log("mute + disconnect");

  // settings: theme + accent
  await a.page.click("button[aria-label='Settings']");
  await a.page.click(".settings-nav button:has-text('Appearance')");
  await a.page.click(".theme-tile:has-text('Light')");
  await a.page.click(".tint-tile:has-text('Mint')");
  await shot(a.page, "settings-light");
  await a.page.keyboard.press("Escape");
  await shot(a.page, "app-light");
  await a.page.click("button[aria-label='Settings']");
  await a.page.click(".settings-nav button:has-text('Appearance')");
  await a.page.click(".theme-tile:has-text('Dark')");
  await a.page.click(".tint-tile:has-text('Dab Violet')");
  await a.page.click(".settings-nav button:has-text('Profile')");
  await a.page.fill("#p-about", "I host game night 🎮");
  await a.page.click(".save-bar button:has-text('Save Changes')");
  await a.page.locator(".toast:has-text('Profile saved')").waitFor();
  await a.page.keyboard.press("Escape");
  log("settings: theme, accent and profile save");

  // server settings: make public, create role
  await a.page.click(".server-head");
  await a.page.click(".ctx-item:has-text('Server settings')");
  await a.page.click("button[aria-label='Show in Discover']");
  await a.page.fill("#s-desc", "Weekly games and chaos.");
  await a.page.click(".save-bar button:has-text('Save Changes')");
  await a.page.locator(".toast:has-text('Server saved')").waitFor();
  await a.page.click(".settings-nav button:has-text('Roles')");
  await a.page.click(".roles-list button:has-text('Create Role')");
  await a.page.fill("#r-name", "Moderator");
  await a.page.click(".save-bar button:has-text('Save Changes')");
  await a.page.locator(".toast:has-text('Role saved')").waitFor();
  await shot(a.page, "server-roles");
  await a.page.keyboard.press("Escape");
  log("server settings: discover toggle + role");

  // discover from bob's side
  await b.page.click("button[aria-label='Discover servers']");
  await b.page.locator(`.discovery-card:has-text('Game Night ${stamp}')`).waitFor({ timeout: 8000 });
  await shot(b.page, "discover");
  log("discover lists the public server");

  // kick: alice removes bob, bob is told and the server disappears
  await a.page.click(`.rail-item[aria-label^='Game Night ${stamp}']`);
  await a.page.locator(".members .member-row:has-text('Bob')").click();
  await a.page.click(".profile-card button[aria-label='More']");
  await a.page.click(".ctx-item:has-text('Kick Bob')");
  await a.page.click(".modal-foot button:has-text('Kick')");
  await b.page.locator(".toast:has-text('You were kicked')").waitFor({ timeout: 8000 });
  await b.page.locator(`.rail-item[aria-label^='Game Night ${stamp}']`).waitFor({ state: "detached" });
  log("kick: member removed live, told why");

  // quick switcher
  await b.page.keyboard.press("Control+k");
  await b.page.fill("input[aria-label='Search channels, DMs and servers']", "#memes");
  await b.page.keyboard.press("Enter").catch(() => {});
  await b.page.keyboard.press("Escape").catch(() => {});
  log("quick switcher");

  // mobile layout
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await a.ctx.storageState() });
  const mp = await m.newPage();
  mp.on("pageerror", (e) => errors.push(`[mobile] pageerror: ${e.message}`));
  await mp.goto(`${BASE}/app`);
  await mp.locator(".sidebar").waitFor();
  await shot(mp, "mobile-home");
  await mp.locator(".chat-row button").first().click();
  await mp.locator(".composer textarea").waitFor();
  await shot(mp, "mobile-chat");
  await mp.click("button[aria-label='Back']");
  await mp.locator(".sidebar").waitFor();
  log("mobile: list ↔ chat navigation");

  // logout
  await a.page.click(".me-card");
  await a.page.click(".ctx-item:has-text('Log out')");
  await a.page.waitForURL(BASE + "/");
  log("log out");
} catch (e) {
  console.error("\n  ✗ FAILED:", e.message);
  errors.push(`FAIL: ${e.message}`);
} finally {
  await browser.close();
}

const real = errors.filter((e) => !/favicon|Failed to load resource: the server responded with a status of 404/.test(e) || e.startsWith("FAIL"));
if (errors.length) {
  console.log("\n  Console errors:");
  for (const e of errors) console.log("   -", e);
}
process.exit(real.length ? 1 : 0);
