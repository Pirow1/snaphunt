// Phase 2.1 smoke — startGame() + GameRouter + RoleRevealScreen.
//
// Three browsers (host + 2 guests = 3 players, the MIN_TO_START):
//   * A creates session
//   * B and C join via code
//   * A taps "Begin the Hunt"
//   * All three navigate to /game/<sessionId> via realtime broadcast
//   * Exactly one client shows HIDER, the other two show SEEKER
//   * "★ Assignment ★" stamp is present on each
//   * Accept Mission on each takes them to the role-specific placeholder

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5173';
mkdirSync('_smoke/out', { recursive: true });

const browser = await chromium.launch();

const makePage = async (label) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${label}/error]`, m.text()); });
  page.on('pageerror', (e) => console.log(`[${label}/pageerror]`, e.message));
  return page;
};

const A = await makePage('A');
const B = await makePage('B');
const C = await makePage('C');

async function waitAuth(p) {
  await p.waitForFunction(async () => !!(await window.supabase.auth.getSession()).data.session, null, { timeout: 8000 });
}

// --- A creates ---
console.log('[A] create');
await A.goto(BASE + '/', { waitUntil: 'networkidle' });
await waitAuth(A);
await A.getByRole('button', { name: /Start a Hunt/i }).click();
await A.waitForURL('**/create');
await A.getByLabel(/Your hunter name/i).fill('Alice');
await A.getByRole('button', { name: '🦊' }).click();
await A.getByRole('button', { name: /Set the Trap/i }).click();
await A.waitForURL(/\/lobby\/[0-9a-f-]{36}$/);
await A.waitForLoadState('networkidle');
const code = (await A.getByTestId('lobby-code').textContent()).trim();
const lobbyUrl = A.url();
const sessionId = lobbyUrl.split('/lobby/')[1];
console.log('[A] code:', code, '· session:', sessionId);

// --- B and C join ---
for (const [page, label, name, emoji] of [[B, 'B', 'Bob', '🐝'], [C, 'C', 'Cleo', '🐢']]) {
  console.log(`[${label}] join`);
  await page.goto(BASE + '/join', { waitUntil: 'networkidle' });
  await waitAuth(page);
  for (const ch of code) {
    await page.getByRole('button', { name: new RegExp(`^Key ${ch}$`, 'i') }).click();
  }
  await page.waitForSelector('#join-name');
  await page.getByLabel(/Your hunter name/i).fill(name);
  await page.getByRole('button', { name: emoji }).click();
  await page.getByRole('button', { name: /Join the Hunt/i }).click();
  await page.waitForURL(/\/lobby\/[0-9a-f-]{36}$/);
  await page.waitForLoadState('networkidle');
}

// Wait until A's store sees 3 players
console.log('[A] waiting for 3 players in store…');
let aCount = -1;
for (let i = 0; i < 40; i++) {
  aCount = await A.evaluate(() => window.useStore.getState().players.length);
  if (aCount >= 3) break;
  await new Promise((r) => setTimeout(r, 200));
}
if (aCount < 3) {
  const diag = await A.evaluate(async () => {
    const s = window.useStore.getState();
    const { data } = await window.supabase
      .from('players').select('name').eq('session_id', s.session?.id ?? '00000000-0000-0000-0000-000000000000');
    return {
      store: s.players.map((p) => p.name),
      db: (data ?? []).map((p) => p.name),
      sessionStatus: s.session?.status,
    };
  });
  console.log('[A] DIAG:', diag);
  await browser.close();
  process.exit(1);
}
console.log(`[A] 3 players visible (count=${aCount})`);
await A.screenshot({ path: '_smoke/out/p21-lobby-3players.png' });

// --- Begin the Hunt ---
console.log('[A] Begin the Hunt');
const beginBtn = A.getByTestId('begin-hunt');
const beginDisabled = await beginBtn.isDisabled();
console.log('[A] begin enabled:', !beginDisabled);
if (beginDisabled) {
  console.log('[A] still disabled — bailing');
  await browser.close();
  process.exit(1);
}
await beginBtn.click();

// All three should navigate to /game/<sessionId>
console.log('[*] waiting for all clients to reach /game/');
const gameUrl = `${BASE}/game/${sessionId}`;
const navStart = Date.now();
const navResults = await Promise.allSettled([
  A.waitForURL(gameUrl, { timeout: 10000 }),
  B.waitForURL(gameUrl, { timeout: 10000 }),
  C.waitForURL(gameUrl, { timeout: 10000 }),
]);
const labels = ['A', 'B', 'C'];
navResults.forEach((r, i) => console.log(`  ${labels[i]}: ${r.status === 'fulfilled' ? 'arrived' : 'TIMED OUT @ ' + [A,B,C][i].url()}`));
if (navResults.some((r) => r.status === 'rejected')) {
  // Diagnostic: what does each client's store say?
  const diag = await Promise.all([A, B, C].map(async (p, i) => {
    const s = await p.evaluate(() => ({
      status: window.useStore.getState().session?.status,
      currentRoundId: window.useStore.getState().session?.current_round_id,
      currentRound: window.useStore.getState().currentRound?.id ?? null,
      url: window.location.pathname,
    }));
    return { label: labels[i], ...s };
  }));
  console.log('post-start diag:', JSON.stringify(diag, null, 2));
  await browser.close();
  process.exit(1);
}
console.log(`[*] all reached game in ${Date.now() - navStart} ms`);

// Wait for role title to render on each
const roles = await Promise.all([A, B, C].map(async (p, i) => {
  const label = ['A', 'B', 'C'][i];
  await p.waitForSelector('[data-testid="role-title"]', { timeout: 5000 });
  const title = (await p.getByTestId('role-title').textContent())?.trim().toLowerCase();
  const stamp = (await p.getByTestId('role-stamp').textContent())?.trim();
  return { label, title, stamp };
}));
console.log('roles:', roles);

await Promise.all([
  A.screenshot({ path: '_smoke/out/p21-A-role.png' }),
  B.screenshot({ path: '_smoke/out/p21-B-role.png' }),
  C.screenshot({ path: '_smoke/out/p21-C-role.png' }),
]);

const hiderCount = roles.filter((r) => r.title === 'hider').length;
const seekerCount = roles.filter((r) => r.title === 'seeker').length;
const stampOk = roles.every((r) => /assignment/i.test(r.stamp ?? ''));

console.log(`[*] hiders=${hiderCount}, seekers=${seekerCount}, stampOk=${stampOk}`);

// --- Accept Mission on each ---
console.log('[*] tapping Accept Mission on all three');
for (const p of [A, B, C]) {
  await p.getByTestId('accept-mission').click();
}
// Brief settle
await new Promise((r) => setTimeout(r, 800));
const postAccept = await Promise.all([A, B, C].map(async (p) => {
  // Look for the placeholder label inside the screen
  const labelEl = await p.locator('text=SCREEN ·').first().textContent().catch(() => null);
  return labelEl ?? '(no placeholder)';
}));
console.log('post-accept labels:', postAccept);

const verdict =
  hiderCount === 1 &&
  seekerCount === 2 &&
  stampOk &&
  postAccept.every((s) => /hider capture|seeker hunt/i.test(s ?? ''));

console.log('\nVERDICT:', verdict ? 'PASS' : 'FAIL');
await browser.close();
process.exit(verdict ? 0 : 1);
