// Phase 3.1 smoke — Pillar 3 (Claude tool use) via verify-submission edge fn.
//
// Forces the cloud branch by mutating the seeker's local thresholds in-memory
// (local_match_threshold → 2.0 so identical photos can't pass locally;
// local_reject_threshold → -1.0 so they also can't be rejected locally).
// The submission therefore escalates to the edge function, which calls Claude
// with tool_choice=submit_verdict and writes cloud_similarity, cloud_reasoning,
// decision_source='cloud', status='verified'.
//
// Verifies: edge function actually ran, returned a tool_use block, ResultScreen
// shows real reasoning + "Verified by Claude" subtitle, round flipped to
// 'finished' with the seeker as winner, score incremented.

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

// ~5m apart, well within 30m tolerance
const A = await makePage('A', { latitude: 51.5007, longitude: -0.1246, accuracy: 5 });
const B = await makePage('B', { latitude: 51.5007, longitude: -0.12466, accuracy: 5 });
const C = await makePage('C', { latitude: 51.5007, longitude: -0.12455, accuracy: 5 });

const waitAuth = (p) => p.waitForFunction(async () => !!(await window.supabase.auth.getSession()).data.session, null, { timeout: 8000 });

// Host creates session
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

// Build the trap image — identical to seeker's image, so cosine ≈ 1.0
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
console.log(`[${hLabel}] trap set, round=${roundId}`);

await seeker.waitForFunction(() => window.useStore?.getState().visionReady === true, null, { timeout: 180_000 });
await seeker.waitForSelector('[data-testid="submit-finding"]', { timeout: 15_000 });

// ⭐ Force the cloud branch: mutate the seeker's in-memory session settings so
// identical photos can't pass locally and can't be rejected locally.
const forced = await seeker.evaluate(() => {
  const s = window.useStore.getState().session;
  if (!s) return false;
  window.useStore.setState({
    session: {
      ...s,
      settings: {
        ...s.settings,
        local_match_threshold: 2.0,   // unreachable: cosine ∈ [-1,1]
        local_reject_threshold: -1.0, // unreachable
      },
    },
  });
  return true;
});
console.log(`[${sLabel}] forced cloud thresholds:`, forced);

await seeker.setInputFiles('[data-testid="photo-input"]', { name: 'mine.jpg', mimeType: 'image/jpeg', buffer: trapBuf });

console.log(`[${sLabel}] submitted, awaiting Claude verdict (~5-15s)…`);
let result = null;
const startMs = Date.now();
for (let i = 0; i < 60; i++) { // 60 * 700ms = 42s budget
  await new Promise((r) => setTimeout(r, 700));
  result = await seeker.evaluate(async () => {
    const id = window.useStore.getState().currentSubmissionId;
    if (!id) return null;
    const { data } = await window.supabase.from('submissions').select('*').eq('id', id).maybeSingle();
    return data;
  });
  if (result?.status === 'verified' || result?.status === 'error') break;
}
const tookMs = Date.now() - startMs;
console.log('submission (after ' + tookMs + 'ms):', {
  local_sim: result?.local_similarity,
  cloud_sim: result?.cloud_similarity,
  decision: result?.decision_source,
  match: result?.is_match,
  status: result?.status,
  reasoning: result?.cloud_reasoning?.slice(0, 120),
});

// Seeker page → ResultScreen
await seeker.waitForSelector('[data-testid="result"]', { timeout: 10_000 }).catch(() => null);
const onResult = await seeker.locator('[data-testid="result"]').count();
const subtitle = await seeker.locator('[data-testid="result-subtitle"]').textContent().catch(() => null);
const statusEl = await seeker.locator('[data-testid="result-status"]').textContent().catch(() => null);
console.log(`[${sLabel}] result: status="${statusEl}", subtitle="${subtitle}"`);
await seeker.screenshot({ path: '_smoke/out/p31-result.png' });

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
  result?.decision_source === 'cloud' &&
  typeof result?.cloud_similarity === 'number' &&
  result.cloud_similarity >= 0 && result.cloud_similarity <= 100 &&
  typeof result?.cloud_reasoning === 'string' &&
  result.cloud_reasoning.length > 10 &&
  result?.is_match === true &&
  result?.status === 'verified' &&
  onResult === 1 &&
  /Match/i.test(statusEl ?? '') &&
  /verified by claude/i.test(subtitle ?? '') &&
  finalRound?.status === 'finished' &&
  finalRound?.winner_id === result?.seeker_id &&
  winnerScore >= 50;

console.log('\nVERDICT:', verdict ? 'PASS' : 'FAIL');
await persist();
await browser.close();
process.exit(verdict ? 0 : 1);
