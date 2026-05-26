// Late-join smoke (migrations 0014 + 0015).
//
// Verifies that a seeker with the lobby code can join a hunt that has
// already started ('playing' status) and lands directly in /game/<id>,
// skipping the lobby. Also verifies that joining a finished session
// returns the expected friendly error.
//
// Setup:
//   - A creates lobby
//   - B, C join lobby (need ≥3 to start)
//   - A clicks Begin Hunt → session.status = 'playing'
// Late-join test:
//   - D opens /join, fills code + name → expect URL = /game/<id>
//   - D sees RoleReveal with role-title === 'seeker'
// Finished-reject test:
//   - Flip session.status to 'finished' via window.supabase
//   - E opens /join, fills same code → expect inline error toast and
//     stays on /join (never routes to /game or /lobby)

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5175';
mkdirSync('_smoke/out', { recursive: true });
mkdirSync('_smoke/.auth', { recursive: true });

const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'] });
const authPath = (l) => resolve('_smoke/.auth', `${l}.json`);
const personas = new Map();
const makePage = async (label, geo) => {
  const sPath = authPath(label);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    geolocation: geo, permissions: ['geolocation'],
    storageState: existsSync(sPath) ? sPath : undefined,
  });
  personas.set(label, { ctx, sPath });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${label}/e]`, m.text().slice(0, 200)); });
  return page;
};
async function persist() { for (const [, p] of personas) try { await p.ctx.storageState({ path: p.sPath }); } catch {} }

const A = await makePage('A', { latitude: 51.5007, longitude: -0.12460, accuracy: 5 });
const B = await makePage('B', { latitude: 51.5007, longitude: -0.12466, accuracy: 5 });
const C = await makePage('C', { latitude: 51.5007, longitude: -0.12455, accuracy: 5 });
const D = await makePage('D', { latitude: 51.5007, longitude: -0.12450, accuracy: 5 });
const E = await makePage('E', { latitude: 51.5007, longitude: -0.12470, accuracy: 5 });

const waitAuth = (p) => p.waitForFunction(async () => !!(await window.supabase.auth.getSession()).data.session, null, { timeout: 8000 });

async function joinByCode(page, code, name, emoji) {
  await page.goto(BASE + '/join', { waitUntil: 'domcontentloaded' });
  await waitAuth(page);
  for (const ch of code) await page.getByRole('button', { name: new RegExp(`^Key ${ch}$`, 'i') }).click();
  await page.waitForSelector('#join-name');
  await page.getByLabel(/Your hunter name/i).fill(name);
  await page.getByRole('button', { name: emoji }).click();
  await page.getByRole('button', { name: /Join the Hunt/i }).click();
}

// === 1. A creates lobby ============================================
await A.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await waitAuth(A);
await A.getByRole('button', { name: /Start a Hunt/i }).click();
await A.waitForURL('**/create');
await A.getByLabel(/Your hunter name/i).fill('Alice');
await A.getByRole('button', { name: '🦊' }).click();
await A.getByRole('button', { name: /Set the Trap/i }).click();
await A.waitForURL(/\/lobby\/[0-9a-f-]{36}$/);
const code = (await A.getByTestId('lobby-code').textContent()).trim();
const sessionId = A.url().split('/lobby/')[1];
console.log('[A] code', code, 'session', sessionId);

// === 2. B + C join lobby ===========================================
await joinByCode(B, code, 'Bob', '🐝');
await B.waitForURL(/\/lobby\/[0-9a-f-]{36}$/);
await joinByCode(C, code, 'Cleo', '🐢');
await C.waitForURL(/\/lobby\/[0-9a-f-]{36}$/);

// Wait until A's store reflects all 3 players
for (let i = 0; i < 60; i++) {
  if ((await A.evaluate(() => window.useStore.getState().players.length)) >= 3) break;
  await new Promise((r) => setTimeout(r, 200));
}
const lobbyPlayers = await A.evaluate(() => window.useStore.getState().players.length);
console.log(`[A] lobby players: ${lobbyPlayers}`);

// === 3. A starts the hunt ==========================================
await A.getByTestId('begin-hunt').click();
const gameUrl = `${BASE}/game/${sessionId}`;
await Promise.all([A, B, C].map((p) => p.waitForURL(gameUrl, { timeout: 30_000 })));
console.log('[A/B/C] all on /game — session.status should be "playing" now');

// Confirm via the store on A
const statusAfterStart = await A.evaluate(() => window.useStore.getState().session?.status);
console.log(`session.status after begin-hunt: ${statusAfterStart}`);

// === 4. D joins MID-HUNT — expect direct route to /game ============
console.log('\n--- LATE-JOIN TEST ---');
const beforeUrl = D.url();
console.log(`[D] before join: ${beforeUrl}`);
await joinByCode(D, code, 'Dax', '🦌');
// CRITICAL: D should go straight to /game/<id>, NOT /lobby/<id>
let dRoutedToGame = false;
try {
  await D.waitForURL(gameUrl, { timeout: 10_000 });
  dRoutedToGame = true;
} catch {
  console.log(`[D] FAIL — did not land on /game, current URL: ${D.url()}`);
}
console.log(`[D] routed to /game directly: ${dRoutedToGame}`);

// D should see RoleReveal as 'seeker' (hider was assigned at game-start
// from the original 3 lobby members, so D is always a seeker).
await D.waitForSelector('[data-testid="role-title"]', { timeout: 15_000 });
const dRoleText = (await D.getByTestId('role-title').textContent()).trim().toLowerCase();
console.log(`[D] role-title: "${dRoleText}"`);
const dIsSeeker = dRoleText === 'seeker';

// Confirm D's player row exists in the session
const dPlayerInSession = await A.evaluate(() => {
  const players = window.useStore.getState().players;
  return players.some((p) => p.name === 'Dax');
});
console.log(`[D] player row visible to host: ${dPlayerInSession}`);

await D.screenshot({ path: '_smoke/out/late-join-D.png', fullPage: true });

// === 5. Finished-session reject ====================================
console.log('\n--- FINISHED-REJECT TEST ---');
// Flip the session to 'finished' from A's browser (host).
await A.evaluate(async (id) => {
  await window.supabase.from('sessions').update({ status: 'finished' }).eq('id', id);
}, sessionId);
await new Promise((r) => setTimeout(r, 500));

const finishedStatus = await A.evaluate(async (id) => {
  const { data } = await window.supabase.from('sessions').select('status').eq('id', id).single();
  return data?.status;
}, sessionId);
console.log(`session.status now: ${finishedStatus}`);

// E tries to join the finished session — should hit P0003 and see an
// inline error, NOT route to /game or /lobby.
await joinByCode(E, code, 'Eve', '🦅');
// Give the RPC time to round-trip and the error to render.
await new Promise((r) => setTimeout(r, 2000));
const eUrl = E.url();
const eOnJoin = /\/join/.test(eUrl) && !/\/game\/|\/lobby\//.test(eUrl);
console.log(`[E] URL after join attempt: ${eUrl}`);
console.log(`[E] still on /join (not routed): ${eOnJoin}`);

// Look for the friendly error string on the page (rendered by JoinScreen).
const eErrorText = await E.locator('text=/already finished|hunt has already/i').first().textContent().catch(() => null);
console.log(`[E] error text: ${eErrorText}`);
const eSawError = !!eErrorText;

await E.screenshot({ path: '_smoke/out/late-join-E-rejected.png', fullPage: true });

// === Verdict =======================================================
const verdict =
  lobbyPlayers === 3 &&
  statusAfterStart === 'playing' &&
  dRoutedToGame &&
  dIsSeeker &&
  dPlayerInSession &&
  eOnJoin &&
  eSawError;

console.log('\n=========================================');
console.log('lobbyPlayers === 3       ', lobbyPlayers === 3);
console.log('statusAfterStart=playing ', statusAfterStart === 'playing');
console.log('D routed to /game        ', dRoutedToGame);
console.log('D is seeker              ', dIsSeeker);
console.log('D visible to host        ', dPlayerInSession);
console.log('E stayed on /join        ', eOnJoin);
console.log('E saw error toast        ', eSawError);
console.log('=========================================');
console.log('VERDICT:', verdict ? 'PASS' : 'FAIL');

await persist();
await browser.close();
process.exit(verdict ? 0 : 1);
