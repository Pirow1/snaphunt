// Phase 2.2 smoke — Hider capture + embedding (Pillar 1 wired into gameplay).
//
// Non-headless: needs real WebGPU for CLIP encoding.
//
// Flow:
//   - 3 browsers create a session and start a game
//   - identify the hider via role-title text
//   - hider grants/mocks geolocation, captures a synthetic photo, picks
//     difficulty=medium, types a hint, taps Set Trap
//   - verify the DB rounds row has every field populated correctly
//   - verify embedding is 512 floats with magnitude ≈ 1.0
//   - verify the hider's view moved off HiderCapture (round.status='active')

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5173';
mkdirSync('_smoke/out', { recursive: true });
mkdirSync('_smoke/.auth', { recursive: true });

const browser = await chromium.launch({
  headless: false,
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'],
});

// Persisted storage state per persona — reuses the anonymous Supabase
// session across smoke runs so we don't hit the auth rate limit.
const authPath = (label) => resolve('_smoke/.auth', `${label}.json`);
const personas = new Map();

const makePage = async (label) => {
  const sPath = authPath(label);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    geolocation: { latitude: 51.5074, longitude: -0.1278, accuracy: 5 },
    permissions: ['geolocation'],
    storageState: existsSync(sPath) ? sPath : undefined,
  });
  personas.set(label, { ctx, sPath });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${label}/error]`, m.text().slice(0, 200)); });
  page.on('pageerror', (e) => console.log(`[${label}/pageerror]`, e.message));
  return page;
};

// Snapshot every persona's storage at the end so the next smoke run reuses.
async function persistPersonas() {
  for (const [, p] of personas) {
    try { await p.ctx.storageState({ path: p.sPath }); } catch {}
  }
}

const A = await makePage('A');
const B = await makePage('B');
const C = await makePage('C');

async function waitAuth(p) {
  await p.waitForFunction(async () => !!(await window.supabase.auth.getSession()).data.session, null, { timeout: 8000 });
}
async function waitVision(p, label) {
  console.log(`[${label}] waiting vision ready…`);
  await p.waitForFunction(() => window.useStore?.getState().visionReady === true, null, { timeout: 180_000 });
}

// --- A creates session ---
await A.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await waitAuth(A);
await A.getByRole('button', { name: /Start a Hunt/i }).click();
await A.waitForURL('**/create');
await A.getByLabel(/Your hunter name/i).fill('Alice');
await A.getByRole('button', { name: '🦊' }).click();
await A.getByRole('button', { name: /Set the Trap/i }).click();
await A.waitForURL(/\/lobby\/[0-9a-f-]{36}$/);
await A.waitForLoadState('domcontentloaded');
const code = (await A.getByTestId('lobby-code').textContent()).trim();
const sessionId = A.url().split('/lobby/')[1];
console.log('[A] session', sessionId, 'code', code);

// --- B and C join ---
for (const [page, label, name, emoji] of [[B, 'B', 'Bob', '🐝'], [C, 'C', 'Cleo', '🐢']]) {
  await page.goto(BASE + '/join', { waitUntil: 'domcontentloaded' });
  await waitAuth(page);
  for (const ch of code) {
    await page.getByRole('button', { name: new RegExp(`^Key ${ch}$`, 'i') }).click();
  }
  await page.waitForSelector('#join-name');
  await page.getByLabel(/Your hunter name/i).fill(name);
  await page.getByRole('button', { name: emoji }).click();
  await page.getByRole('button', { name: /Join the Hunt/i }).click();
  await page.waitForURL(/\/lobby\/[0-9a-f-]{36}$/);
  await page.waitForLoadState('domcontentloaded');
  console.log(`[${label}] joined`);
}

// Wait for A to see 3
let aPCount = 0;
for (let i = 0; i < 60; i++) {
  aPCount = await A.evaluate(() => window.useStore.getState().players.length);
  if (aPCount >= 3) break;
  await new Promise((r) => setTimeout(r, 200));
}
console.log(`[A] players in store: ${aPCount}`);
if (aPCount < 3) {
  const diag = await A.evaluate(async () => {
    const s = window.useStore.getState();
    const { data } = await window.supabase.from('players').select('name').eq('session_id', s.session?.id ?? '');
    return { storeNames: s.players.map(p => p.name), dbNames: (data ?? []).map(p => p.name) };
  });
  console.log('DIAG:', diag);
  await persistPersonas(); await browser.close(); process.exit(1);
}

// --- Begin Hunt + figure out who's the hider ---
const disabled = await A.getByTestId('begin-hunt').isDisabled();
console.log(`[A] begin enabled = ${!disabled}`);
await A.getByTestId('begin-hunt').click();
const gameUrl = `${BASE}/game/${sessionId}`;
console.log('[*] awaiting all to reach /game/');
const navRes = await Promise.allSettled([
  A.waitForURL(gameUrl, { timeout: 15000 }),
  B.waitForURL(gameUrl, { timeout: 15000 }),
  C.waitForURL(gameUrl, { timeout: 15000 }),
]);
const lbls = ['A','B','C'];
navRes.forEach((r, i) => console.log(`  ${lbls[i]}: ${r.status === 'fulfilled' ? 'arrived' : 'TIMED OUT @ ' + [A,B,C][i].url()}`));
if (navRes.some(r => r.status === 'rejected')) {
  const errMsg = await A.locator('text=Need at least, text=Could not, text=Only the host').first().textContent().catch(() => '(no error visible)');
  console.log('[A] error visible:', errMsg);
  await persistPersonas(); await browser.close(); process.exit(1);
}
const roles = await Promise.all([A, B, C].map(async (p) => (await p.getByTestId('role-title').textContent()).trim().toLowerCase()));
const labels = ['A', 'B', 'C'];
const pages = [A, B, C];
const hiderIdx = roles.findIndex((r) => r === 'hider');
console.log('roles:', roles, 'hider =', labels[hiderIdx]);
if (hiderIdx === -1) { console.log('no hider found, bailing'); await browser.close(); process.exit(1); }
const hider = pages[hiderIdx];
const hiderLabel = labels[hiderIdx];

// Everyone accepts (clears the local accepted=false gate)
for (const p of pages) await p.getByTestId('accept-mission').click();

// Hider should now be on HiderCaptureScreen
await hider.waitForSelector('[data-testid="capture-target"]', { timeout: 5000 });
console.log(`[${hiderLabel}] on hider-capture`);
await hider.screenshot({ path: '_smoke/out/p22-hider-empty.png' });

// Wait for vision to be ready on the hider's tab (HomeScreen pre-warmed it)
await waitVision(hider, hiderLabel);

// --- Build a synthetic photo via canvas (yellow circle on cream) ---
const dataUrl = await hider.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 800; c.height = 800;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#F4E8D0'; ctx.fillRect(0, 0, 800, 800);
  ctx.fillStyle = '#E8B547';
  ctx.beginPath(); ctx.arc(400, 400, 220, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1A1614';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PARK BENCH', 400, 700);
  return c.toDataURL('image/jpeg', 0.9);
});
const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
await hider.setInputFiles('[data-testid="photo-input"]', {
  name: 'trap.jpg', mimeType: 'image/jpeg', buffer: buf,
});
console.log(`[${hiderLabel}] photo captured`);
await hider.screenshot({ path: '_smoke/out/p22-hider-photo.png' });

// Pick difficulty Medium + add hint
await hider.getByTestId('diff-medium').click();
await hider.getByTestId('hint-input').fill('greenish, near the path');

// --- Set Trap ---
const startRoundId = await hider.evaluate(() => window.useStore.getState().currentRound?.id);
console.log(`[${hiderLabel}] currentRound.id before click:`, startRoundId);
const tStart = Date.now();
await hider.getByTestId('set-trap').click();
console.log(`[${hiderLabel}] Set Trap clicked, polling DB for photo_path…`);

// Manual poll — Playwright's waitForFunction with async returns truthy on
// the promise itself before resolution.
let pollPhase = null;
let pollErr = null;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 500));
  pollPhase = await hider.evaluate(async (rid) => {
    const { data, error } = await window.supabase.from('rounds').select('photo_path,status').eq('id', rid).maybeSingle();
    return { status: data?.status, photo_path: data?.photo_path, err: error?.message };
  }, startRoundId);
  // Also peek at any error displayed on screen
  pollErr = await hider.locator('div.bg-blaze.text-cream').first().textContent().catch(() => null);
  if (pollPhase.status === 'active' && pollPhase.photo_path) break;
  if (i === 5 || i === 15 || i === 30) console.log(`  t=${(i+1)*0.5}s status=${pollPhase.status} photo_path=${pollPhase.photo_path} err=${pollErr ?? ''}`);
}
const tTrap = Date.now() - tStart;
console.log(`[${hiderLabel}] final after ${tTrap} ms — status=${pollPhase?.status}, photo_path=${pollPhase?.photo_path}, error=${pollErr ?? '(none)'}`);
await hider.screenshot({ path: '_smoke/out/p22-after-trap.png' });

// --- Verify the DB row ---
const dbRound = await hider.evaluate(async (rid) => {
  const { data } = await window.supabase
    .from('rounds').select('*').eq('id', rid).maybeSingle();
  return data;
}, startRoundId);
console.log('round fields:', {
  status: dbRound?.status,
  difficulty: dbRound?.difficulty,
  point_value: dbRound?.point_value,
  hint: dbRound?.hint,
  hider_lat: dbRound?.hider_lat,
  hider_lng: dbRound?.hider_lng,
  photo_path: dbRound?.photo_path,
  embedding_len: Array.isArray(dbRound?.photo_embedding) ? dbRound.photo_embedding.length : '(missing)',
  started_at: dbRound?.started_at ? 'set' : 'null',
  expires_at: dbRound?.expires_at ? 'set' : 'null',
});

const embedding = dbRound?.photo_embedding ?? [];
const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
console.log(`embedding |v| = ${mag.toFixed(4)}`);

// Verify the storage object exists by creating a signed URL
const photoExists = await hider.evaluate(async (path) => {
  const { data, error } = await window.supabase.storage
    .from('round-photos').createSignedUrl(path, 60);
  return { hasUrl: !!data?.signedUrl, error: error?.message };
}, dbRound?.photo_path ?? '');
console.log('photo storage:', photoExists);

// Verify the hider's view moved off HiderCaptureScreen (back to placeholder for now)
await new Promise((r) => setTimeout(r, 500));
const stillOnCapture = await hider.locator('[data-testid="capture-target"]').count();
console.log(`hider still on capture target? ${stillOnCapture > 0}`);

const verdict =
  dbRound?.status === 'active' &&
  dbRound?.difficulty === 'medium' &&
  dbRound?.point_value === 100 &&
  dbRound?.hint === 'greenish, near the path' &&
  typeof dbRound?.hider_lat === 'number' &&
  typeof dbRound?.hider_lng === 'number' &&
  dbRound?.photo_path?.endsWith('.jpg') &&
  embedding.length === 512 &&
  Math.abs(mag - 1.0) < 0.001 &&
  photoExists.hasUrl === true &&
  stillOnCapture === 0;

console.log('\nVERDICT:', verdict ? 'PASS' : 'FAIL');
await persistPersonas();
await browser.close();
process.exit(verdict ? 0 : 1);
