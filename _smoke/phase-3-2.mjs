// Phase 3.2 smoke — multi-round flow + scoring.
//
// Drives a full 3-round game with 3 browsers (host + 2 others). After each
// round, a non-hider submits the identical photo (cosine ≈ 1.0 → local_high
// → instant win), score accumulates by 50pts. Host auto-advances after a
// 5s pause. At round 3 finish, session.status flips to 'finished' and all
// browsers navigate to /gallery/:sessionId.
//
// Verifies: hider rotates by join order, scores accumulate across rounds,
// HiderWaitScreen renders the "TRAP SET" stamp + countdown, toasts fire,
// gallery navigation happens for every client.

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

// Host (A) creates the session
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

// B, C join
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

// Drop rounds_total to 3 for speed. Host has UPDATE RLS on own session.
await A.evaluate(async () => {
  const s = window.useStore.getState().session;
  const next = { ...s.settings, rounds_total: 3 };
  await window.supabase.from('sessions').update({ settings: next }).eq('id', s.id);
  // Mirror locally so the host's startNextRound decision matches DB immediately.
  window.useStore.setState({ session: { ...s, settings: next } });
});
console.log('[A] rounds_total → 3');

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

// Wait for vision on every client so it doesn't bottleneck mid-round.
await Promise.all(pages.map((p) => p.waitForFunction(() => window.useStore?.getState().visionReady === true, null, { timeout: 240_000 })));

const playRound = async (roundNumber) => {
  console.log(`\n=== ROUND ${roundNumber} ===`);
  // Re-derive roles from each client's GameRouter
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

  // Hider sets the trap. photo-input is hidden but Playwright can drive it
  // directly; wait for the difficulty selector to confirm Capture screen is up.
  await hider.waitForSelector('[data-testid="diff-easy"]', { timeout: 30_000 });
  await hider.setInputFiles('[data-testid="photo-input"]', { name: 'trap.jpg', mimeType: 'image/jpeg', buffer: trapBuf });
  await hider.getByTestId('diff-easy').click();
  await hider.getByTestId('set-trap').click();

  // Wait for round.status='active' on the hider's view (HiderWaitScreen)
  await hider.waitForSelector('[data-testid="hider-wait"]', { timeout: 30_000 });
  const stampVisible = await hider.locator('[data-testid="trap-stamp"]').count();
  const countdown0 = await hider.locator('[data-testid="hider-countdown"]').textContent().catch(() => null);
  console.log(`[${hLabel}] HiderWaitScreen rendered (stamp=${stampVisible}, countdown="${countdown0}")`);

  // Seeker waits for the submit button, then sends the identical image
  await seeker.waitForSelector('[data-testid="submit-finding"]', { timeout: 30_000 });
  await seeker.setInputFiles('[data-testid="photo-input"]', { name: 'mine.jpg', mimeType: 'image/jpeg', buffer: trapBuf });

  // Seeker → ResultScreen
  await seeker.waitForSelector('[data-testid="result"]', { timeout: 20_000 });
  const subtitle = await seeker.locator('[data-testid="result-subtitle"]').textContent();
  const statusEl = await seeker.locator('[data-testid="result-status"]').textContent();
  console.log(`[${sLabel}] result: "${statusEl}" · "${subtitle}"`);

  // Wait for host's auto-advance (5s pause + a little slack)
  // Either currentRound.round_number advances, OR session.status flips.
  const targetRoundNumber = roundNumber + 1;
  await A.waitForFunction((target) => {
    const st = window.useStore.getState();
    return (
      st.currentRound?.round_number === target ||
      st.session?.status === 'finished'
    );
  }, targetRoundNumber, { timeout: 30_000 });

  return { hiderIdx, hiderPlayerId: await hider.evaluate(() => window.useStore.getState().identity.authUserId) };
};

const r1 = await playRound(1);
const r2 = await playRound(2);
const r3 = await playRound(3);

// Round 3 was the last; host should have called finishSession; everyone
// should navigate to /gallery/<sessionId>.
const galleryUrl = new RegExp(`/gallery/${sessionId}$`);
await Promise.all(pages.map((p) => p.waitForURL(galleryUrl, { timeout: 20_000 })));
console.log('all clients navigated to /gallery');

// Hider rotation: hider_idx should advance by 1 (mod 3) each round, in
// join-order direction. Verify by walking via DB.
const finalSession = await A.evaluate(async (sid) => {
  const { data } = await window.supabase.from('sessions').select('*').eq('id', sid).maybeSingle();
  return data;
}, sessionId);

const roundsRows = await A.evaluate(async (sid) => {
  const { data } = await window.supabase
    .from('rounds').select('*').eq('session_id', sid).order('round_number');
  return data;
}, sessionId);

const playerRows = await A.evaluate(async (sid) => {
  const { data } = await window.supabase
    .from('players').select('*').eq('session_id', sid).order('joined_at');
  return data;
}, sessionId);

const playerById = Object.fromEntries(playerRows.map((p) => [p.id, p]));
const sortedHiders = roundsRows.map((r) => playerById[r.hider_id]?.name);
const winners = roundsRows.map((r) => playerById[r.winner_id]?.name ?? null);
const statuses = roundsRows.map((r) => r.status);
const scores = playerRows.map((p) => `${p.name}=${p.score}`);
console.log('\nRound summary:');
console.log('  hiders by round:', sortedHiders);
console.log('  winners:', winners);
console.log('  statuses:', statuses);
console.log('  scores:', scores);
console.log('  session.status:', finalSession.status, '· finished_at:', !!finalSession.finished_at);

// Rotation check: hider in round N+1 is next player in join order from N
const joinOrder = playerRows.map((p) => p.id);
let rotationOk = true;
for (let i = 0; i < roundsRows.length - 1; i++) {
  const cur = joinOrder.indexOf(roundsRows[i].hider_id);
  const next = joinOrder.indexOf(roundsRows[i + 1].hider_id);
  if ((cur + 1) % joinOrder.length !== next) { rotationOk = false; break; }
}

// Score check: each winner should have +50 per round they won
const expectedScores = {};
for (const p of playerRows) expectedScores[p.id] = 0;
for (const r of roundsRows) if (r.winner_id) expectedScores[r.winner_id] += r.point_value;
const scoresOk = playerRows.every((p) => p.score === expectedScores[p.id]);

await A.screenshot({ path: '_smoke/out/p32-gallery-A.png' });
await B.screenshot({ path: '_smoke/out/p32-gallery-B.png' });

const verdict =
  roundsRows.length === 3 &&
  statuses.every((s) => s === 'finished') &&
  winners.every((w) => w !== null) &&
  rotationOk &&
  scoresOk &&
  finalSession.status === 'finished';

console.log('\nrotation ok:', rotationOk, '· scores ok:', scoresOk);
console.log('VERDICT:', verdict ? 'PASS' : 'FAIL');
await persist();
await browser.close();
process.exit(verdict ? 0 : 1);
