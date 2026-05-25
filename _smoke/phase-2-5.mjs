// Phase 2.5 smoke — hybrid submission, local_high branch.
//
// The seeker submits the SAME synthetic image the hider used → cosine ≈ 1.0
// → above local_match_threshold (0.85) → local_high decision → instant
// ResultScreen with "Decided Locally" subtitle + +50 points + round winner.
//
// Cloud branch is exercised by Phase 3.1 (real Claude tool use). Local_low
// requires real photo pairs to hit cosine < 0.55 reliably; synthetic shapes
// stay in [0.999, 1.000] (see Phase 1.5 notes).

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
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${label}/e]`, m.text().slice(0, 160)); });
  return page;
};
async function persist() { for (const [, p] of personas) try { await p.ctx.storageState({ path: p.sPath }); } catch {} }

// Place hider + seeker ~5m apart (well within 30m tolerance)
const A = await makePage('A', { latitude: 51.5007, longitude: -0.1246, accuracy: 5 });
const B = await makePage('B', { latitude: 51.5007, longitude: -0.12466, accuracy: 5 });
const C = await makePage('C', { latitude: 51.5007, longitude: -0.12455, accuracy: 5 });

const waitAuth = (p) => p.waitForFunction(async () => !!(await window.supabase.auth.getSession()).data.session, null, { timeout: 8000 });

// Setup
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
console.log('[A] code', code);

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

await A.getByTestId('begin-hunt').click();
const gameUrl = `${BASE}/game/${sessionId}`;
await Promise.all([A.waitForURL(gameUrl, { timeout: 30_000 }), B.waitForURL(gameUrl, { timeout: 30_000 }), C.waitForURL(gameUrl, { timeout: 30_000 })]);

const pages = [A, B, C];
const labels = ['A', 'B', 'C'];
const roles = await Promise.all(pages.map(async (p) => (await p.getByTestId('role-title').textContent()).trim().toLowerCase()));
const hiderIdx = roles.findIndex((r) => r === 'hider');
const seekerIdxs = roles.map((r, i) => r === 'seeker' ? i : -1).filter((i) => i >= 0);
const hider = pages[hiderIdx];
const hLabel = labels[hiderIdx];
const seeker = pages[seekerIdxs[0]];
const sLabel = labels[seekerIdxs[0]];
console.log('roles:', roles, '· hider =', hLabel, '· seeker =', sLabel);

for (const p of pages) await p.getByTestId('accept-mission').click();
await hider.waitForFunction(() => window.useStore?.getState().visionReady === true, null, { timeout: 180_000 });

// Build the trap image
const trapJpeg = await hider.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 600; c.height = 600;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#F4E8D0'; ctx.fillRect(0, 0, 600, 600);
  ctx.fillStyle = '#1F3A2E';
  ctx.beginPath(); ctx.arc(300, 300, 200, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#E94F2A';
  ctx.font = 'bold 60px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('STATUE', 300, 320);
  return c.toDataURL('image/jpeg', 0.92);
});
const trapBuf = Buffer.from(trapJpeg.split(',')[1], 'base64');
await hider.setInputFiles('[data-testid="photo-input"]', { name: 'trap.jpg', mimeType: 'image/jpeg', buffer: trapBuf });
await hider.getByTestId('diff-easy').click();
await hider.getByTestId('set-trap').click();

const roundId = await hider.evaluate(() => window.useStore.getState().currentRound?.id);
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const ok = await hider.evaluate(async (rid) => {
    const { data } = await window.supabase.from('rounds').select('status,photo_path').eq('id', rid).maybeSingle();
    return data?.status === 'active' && !!data?.photo_path;
  }, roundId);
  if (ok) break;
}
console.log(`[${hLabel}] trap set`);

// Seeker waits for vision + submits the SAME bytes → local_high
await seeker.waitForFunction(() => window.useStore?.getState().visionReady === true, null, { timeout: 180_000 });
await seeker.waitForSelector('[data-testid="submit-finding"]', { timeout: 15_000 });
await seeker.setInputFiles('[data-testid="photo-input"]', { name: 'mine.jpg', mimeType: 'image/jpeg', buffer: trapBuf });

console.log(`[${sLabel}] submitted, awaiting verdict…`);
let result = null;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 500));
  result = await seeker.evaluate(async () => {
    const id = window.useStore.getState().currentSubmissionId;
    if (!id) return null;
    const { data } = await window.supabase.from('submissions').select('*').eq('id', id).maybeSingle();
    return data;
  });
  if (result?.status === 'verified') break;
}
console.log('submission:', {
  local_sim: result?.local_similarity,
  decision: result?.decision_source,
  match: result?.is_match,
  status: result?.status,
});

// Seeker page should be on ResultScreen
await seeker.waitForSelector('[data-testid="result"]', { timeout: 10_000 }).catch(() => null);
const onResult = await seeker.locator('[data-testid="result"]').count();
const subtitle = await seeker.locator('[data-testid="result-subtitle"]').textContent().catch(() => null);
const statusEl = await seeker.locator('[data-testid="result-status"]').textContent().catch(() => null);
console.log(`[${sLabel}] result: status="${statusEl}", subtitle="${subtitle}"`);
await seeker.screenshot({ path: '_smoke/out/p25-result.png' });

// Round should now be 'finished' with this seeker as winner
const finalRound = await hider.evaluate(async (rid) => {
  const { data } = await window.supabase.from('rounds').select('*').eq('id', rid).maybeSingle();
  return data;
}, roundId);
const winnerScore = await hider.evaluate(async (uid) => {
  const { data } = await window.supabase.from('players').select('score').eq('id', uid).maybeSingle();
  return data?.score;
}, result?.seeker_id);
console.log('round finished:', finalRound?.status, 'winner:', finalRound?.winner_id, '· score:', winnerScore);

const verdict =
  result?.decision_source === 'local_high' &&
  result?.is_match === true &&
  result?.local_similarity > 0.999 &&
  result?.status === 'verified' &&
  onResult === 1 &&
  /Match/i.test(statusEl ?? '') &&
  /decided locally/i.test(subtitle ?? '') &&
  finalRound?.status === 'finished' &&
  finalRound?.winner_id === result?.seeker_id &&
  winnerScore >= 50;

console.log('\nVERDICT:', verdict ? 'PASS' : 'FAIL');
await persist();
await browser.close();
process.exit(verdict ? 0 : 1);
