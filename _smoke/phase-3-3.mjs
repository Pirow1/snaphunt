// Phase 3.3 smoke — Gallery + Play Again.
//
// Plays a full 3-round game (same shape as phase-3-2 but with
// rounds_total=2 to shave time), confirms /gallery/<id> renders the
// recap cards + scoreboard correctly, then verifies "Play Again" routes
// every client back to / and clears the in-memory session.

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5173';
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
const pages = [A, B, C];
const labels = ['A', 'B', 'C'];

const waitAuth = (p) => p.waitForFunction(async () => !!(await window.supabase.auth.getSession()).data.session, null, { timeout: 8000 });

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

for (const [page, name, emoji] of [[B, 'Bob', '🐝'], [C, 'Cleo', '🐢']]) {
  await page.goto(BASE + '/join', { waitUntil: 'domcontentloaded' });
  await waitAuth(page);
  for (const ch of code) await page.getByRole('button', { name: new RegExp(`^Key ${ch}$`, 'i') }).click();
  await page.waitForSelector('#join-name');
  await page.getByLabel(/Your hunter name/i).fill(name);
  await page.getByRole('button', { name: emoji }).click();
  await page.getByRole('button', { name: /Join the Hunt/i }).click();
  await page.waitForURL(/\/lobby\/[0-9a-f-]{36}$/);
}
for (let i = 0; i < 50; i++) {
  if ((await A.evaluate(() => window.useStore.getState().players.length)) >= 3) break;
  await new Promise((r) => setTimeout(r, 200));
}

// rounds_total → 2 (smaller than 3.2 for speed; still verifies multi-round + gallery)
const ROUNDS_TOTAL = 2;
await A.evaluate(async (n) => {
  const s = window.useStore.getState().session;
  const next = { ...s.settings, rounds_total: n };
  await window.supabase.from('sessions').update({ settings: next }).eq('id', s.id);
  window.useStore.setState({ session: { ...s, settings: next } });
}, ROUNDS_TOTAL);
console.log(`[A] rounds_total → ${ROUNDS_TOTAL}`);

await A.getByTestId('begin-hunt').click();
const gameUrl = `${BASE}/game/${sessionId}`;
await Promise.all(pages.map((p) => p.waitForURL(gameUrl, { timeout: 30_000 })));

const trapBuf = await A.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 600; c.height = 600;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#F4E8D0'; ctx.fillRect(0, 0, 600, 600);
  ctx.fillStyle = '#1F3A2E';
  ctx.beginPath(); ctx.arc(300, 300, 200, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#E94F2A';
  ctx.font = 'bold 60px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('STATUE', 300, 320);
  return c.toDataURL('image/jpeg', 0.92);
}).then((d) => Buffer.from(d.split(',')[1], 'base64'));

await Promise.all(pages.map((p) => p.waitForFunction(() => window.useStore?.getState().visionReady === true, null, { timeout: 240_000 })));

const playRound = async (roundNumber, isLast) => {
  console.log(`\n=== ROUND ${roundNumber} ===`);
  await Promise.all(pages.map((p) => p.waitForSelector('[data-testid="role-title"]', { timeout: 30_000 })));
  const roles = await Promise.all(pages.map(async (p) => (await p.getByTestId('role-title').textContent()).trim().toLowerCase()));
  const hiderIdx = roles.findIndex((r) => r === 'hider');
  const seekerIdxs = roles.map((r, i) => r === 'seeker' ? i : -1).filter((i) => i >= 0);
  const hider = pages[hiderIdx];
  const hLabel = labels[hiderIdx];
  const seeker = pages[seekerIdxs[0]];
  const sLabel = labels[seekerIdxs[0]];
  console.log(`roles: [${roles.join(', ')}] · hider=${hLabel} · seeker=${sLabel}`);

  for (const p of pages) await p.getByTestId('accept-mission').click();

  await hider.waitForSelector('[data-testid="diff-easy"]', { timeout: 30_000 });
  await hider.setInputFiles('[data-testid="photo-input"]', { name: 'trap.jpg', mimeType: 'image/jpeg', buffer: trapBuf });
  await hider.getByTestId('diff-easy').click();
  await hider.getByTestId('set-trap').click();

  await hider.waitForSelector('[data-testid="hider-wait"]', { timeout: 30_000 });

  await seeker.waitForSelector('[data-testid="submit-finding"]', { timeout: 30_000 });
  await seeker.setInputFiles('[data-testid="photo-input"]', { name: 'mine.jpg', mimeType: 'image/jpeg', buffer: trapBuf });
  await seeker.waitForSelector('[data-testid="result"]', { timeout: 20_000 });

  // After the last round host waits 5s and calls finishSession.
  // After non-last rounds, host calls startNextRound. Wait for either.
  if (isLast) {
    await Promise.all(pages.map((p) => p.waitForURL(new RegExp(`/gallery/${sessionId}$`), { timeout: 25_000 })));
  } else {
    const targetRoundNumber = roundNumber + 1;
    await A.waitForFunction(
      (target) => {
        const st = window.useStore.getState();
        return st.currentRound?.round_number === target || st.session?.status === 'finished';
      },
      targetRoundNumber,
      { timeout: 30_000 },
    );
  }
};

for (let r = 1; r <= ROUNDS_TOTAL; r++) {
  await playRound(r, r === ROUNDS_TOTAL);
}

console.log('\nAll clients on /gallery — inspecting…');
await A.waitForSelector('[data-testid="gallery"]', { timeout: 10_000 });
// Recap fetch is async — wait for at least one card to mount.
await A.waitForSelector('[data-testid="recap-card"]', { timeout: 15_000 });

// Recap cards: one per round
const recapCount = await A.locator('[data-testid="recap-card"]').count();
const stamps = await A.locator('[data-testid="recap-stamp"]').allTextContents();
const sources = await A.locator('[data-testid="recap-source"]').allTextContents();
const scoreRows = await A.locator('[data-testid="scoreboard-row"]').count();
const goldRow = await A.locator('[data-testid="scoreboard-row"][data-you="true"]').count();
console.log(`recap cards: ${recapCount}, stamps: ${stamps}, sources: ${sources}, score rows: ${scoreRows}, you-highlighted: ${goldRow}`);

await A.screenshot({ path: '_smoke/out/p33-gallery-A.png', fullPage: true });

// Play Again from B's perspective
console.log('\n[B] clicking Play Again…');
await B.getByTestId('play-again').click();
await B.waitForURL(BASE + '/', { timeout: 10_000 });
const bClearedSession = await B.evaluate(() => {
  const st = window.useStore.getState();
  return st.session === null && st.currentRound === null && st.currentSubmissionId === null;
});
console.log('[B] back to /, store cleared:', bClearedSession);

const verdict =
  recapCount === ROUNDS_TOTAL &&
  stamps.every((s) => /MATCH|LEGENDARY/i.test(s)) &&
  sources.every((s) => /LOCAL|CLAUDE/i.test(s)) &&
  scoreRows === 3 &&
  goldRow === 1 &&
  bClearedSession;

console.log('\nVERDICT:', verdict ? 'PASS' : 'FAIL');
await persist();
await browser.close();
process.exit(verdict ? 0 : 1);
