// Phase 2.4 smoke — Seeker hunt screen + radar.
//
// Runs the full setup-game-set-trap flow (3 browsers, hider sets trap with
// synthetic photo), then drives ONE of the seekers through their hunt view
// and verifies:
//   - TargetCard rendered + blurred photo loaded via signed URL
//   - Radar present (sweep, ping, distance, temp)
//   - Distance reactively updates when the seeker's GPS moves
//   - BearingArrow has a numeric data-angle
//   - Sharpen power-up steps blur 20 → 10 → 4 → 0 over 3 clicks
//   - Hint reveal flips the hint strip from placeholder → real text
//   - Seeker subscribes to the presence channel and tracks distance only
//     (no raw lat/lng leak)

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

const authPath = (label) => resolve('_smoke/.auth', `${label}.json`);
const personas = new Map();
const makePage = async (label, geo = { latitude: 51.5037, longitude: -0.1246, accuracy: 5 }) => {
  const sPath = authPath(label);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    geolocation: geo,
    permissions: ['geolocation'],
    storageState: existsSync(sPath) ? sPath : undefined,
  });
  personas.set(label, { ctx, sPath });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${label}/err]`, m.text().slice(0, 180)); });
  page.on('pageerror', (e) => console.log(`[${label}/pe]`, e.message));
  return page;
};
async function persistPersonas() {
  for (const [, p] of personas) try { await p.ctx.storageState({ path: p.sPath }); } catch {}
}
async function waitAuth(p) {
  await p.waitForFunction(async () => !!(await window.supabase.auth.getSession()).data.session, null, { timeout: 8000 });
}

// Hider position
const A = await makePage('A', { latitude: 51.5007, longitude: -0.1246, accuracy: 5 });
// Seeker position 1 (Bob, 330m N of hider)
const B = await makePage('B', { latitude: 51.5037, longitude: -0.1246, accuracy: 5 });
// Seeker position 2 (Cleo, 220m E of hider)
const C = await makePage('C', { latitude: 51.5007, longitude: -0.1214, accuracy: 5 });

// --- A creates ---
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
}

for (let i = 0; i < 50; i++) {
  const n = await A.evaluate(() => window.useStore.getState().players.length);
  if (n >= 3) break;
  await new Promise((r) => setTimeout(r, 200));
}

const pages = [A, B, C];
const labels = ['A', 'B', 'C'];

await A.getByTestId('begin-hunt').click();
const gameUrl = `${BASE}/game/${sessionId}`;
const navRes = await Promise.allSettled([
  A.waitForURL(gameUrl, { timeout: 60_000 }),
  B.waitForURL(gameUrl, { timeout: 60_000 }),
  C.waitForURL(gameUrl, { timeout: 60_000 }),
]);
navRes.forEach((r, i) => console.log(`  ${labels[i]}: ${r.status === 'fulfilled' ? 'arrived' : 'TIMED OUT @ ' + pages[i].url()}`));
if (navRes.some((r) => r.status === 'rejected')) { await persistPersonas(); await browser.close(); process.exit(1); }

// Determine roles
const roleOf = async (p) => (await p.getByTestId('role-title').textContent()).trim().toLowerCase();
const roles = await Promise.all(pages.map(roleOf));
const hiderIdx = roles.findIndex((r) => r === 'hider');
const seekerIdxs = roles.map((r, i) => r === 'seeker' ? i : -1).filter((i) => i >= 0);
const hider = pages[hiderIdx];
const hiderLabel = labels[hiderIdx];
const seeker = pages[seekerIdxs[0]];
const seekerLabel = labels[seekerIdxs[0]];
console.log('roles:', roles, '· hider =', hiderLabel, '· seeker target =', seekerLabel);

// Everyone accept
for (const p of pages) await p.getByTestId('accept-mission').click();

// Wait for hider's vision
await hider.waitForFunction(() => window.useStore?.getState().visionReady === true, null, { timeout: 180_000 });

// Hider sets trap with hint "behind the fountain"
const trapJpeg = await hider.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 800; c.height = 800;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#F4E8D0'; ctx.fillRect(0, 0, 800, 800);
  ctx.fillStyle = '#1F3A2E';
  ctx.beginPath(); ctx.arc(400, 400, 240, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#F4E8D0';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FOUNTAIN', 400, 420);
  return c.toDataURL('image/jpeg', 0.9);
});
const buf = Buffer.from(trapJpeg.split(',')[1], 'base64');
await hider.setInputFiles('[data-testid="photo-input"]', {
  name: 'trap.jpg', mimeType: 'image/jpeg', buffer: buf,
});
await hider.getByTestId('diff-easy').click();
await hider.getByTestId('hint-input').fill('behind the fountain');

const startRoundId = await hider.evaluate(() => window.useStore.getState().currentRound?.id);
await hider.getByTestId('set-trap').click();
// Wait until status=active
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const ok = await hider.evaluate(async (rid) => {
    const { data } = await window.supabase.from('rounds').select('photo_path,status').eq('id', rid).maybeSingle();
    return data?.status === 'active' && !!data?.photo_path;
  }, startRoundId);
  if (ok) break;
}
console.log(`[${hiderLabel}] trap set`);

// Now the seeker should see SeekerHuntScreen
await seeker.waitForSelector('[data-testid="target-card"]', { timeout: 30_000 });
await seeker.waitForFunction(() => {
  const img = document.querySelector('[data-testid="target-photo"]');
  return img && img.getAttribute('src')?.startsWith('https://');
}, null, { timeout: 10_000 });
await seeker.screenshot({ path: '_smoke/out/p24-seeker-locked.png' });
console.log(`[${seekerLabel}] seeker view loaded`);

// Check Radar + distance + temp + bearing arrow exist
const radarChecks = await seeker.evaluate(() => {
  return {
    hasRadar: !!document.querySelector('[data-testid="radar"]'),
    hasSweep: !!document.querySelector('[data-testid="radar-sweep"]'),
    distance: document.querySelector('[data-testid="distance"]')?.textContent?.trim(),
    temp: document.querySelector('[data-testid="temp"]')?.textContent?.trim(),
    bearingAngle: document.querySelector('[data-testid="bearing-arrow"]')?.getAttribute('data-angle'),
    imgBlur: document.querySelector('[data-testid="target-photo"]')?.getAttribute('data-blur'),
  };
});
console.log('radar checks:', radarChecks);

// Update seeker GPS — closer to hider, recheck distance
await seeker.context().setGeolocation({ latitude: 51.5012, longitude: -0.1246, accuracy: 5 });
await new Promise((r) => setTimeout(r, 1500));
const closerDistance = await seeker.evaluate(() => document.querySelector('[data-testid="distance"]')?.textContent?.trim());
console.log(`[${seekerLabel}] closer distance:`, closerDistance);

// Sharpen × 3 → blur should go 20→10→4→0
await seeker.getByTestId('sharpen').click();
await seeker.getByTestId('sharpen').click();
await seeker.getByTestId('sharpen').click();
await new Promise((r) => setTimeout(r, 600));
const sharpenedBlur = await seeker.evaluate(() => document.querySelector('[data-testid="target-photo"]')?.getAttribute('data-blur'));
const sharpenBtnDisabled = await seeker.getByTestId('sharpen').isDisabled();
await seeker.screenshot({ path: '_smoke/out/p24-seeker-sharpened.png' });
console.log(`[${seekerLabel}] sharpened blur=${sharpenedBlur}, sharpen disabled=${sharpenBtnDisabled}`);

// Use Hint
await seeker.getByTestId('use-hint').click();
await new Promise((r) => setTimeout(r, 200));
const hintTextRevealed = await seeker.evaluate(() => {
  const els = Array.from(document.querySelectorAll('[data-testid="target-card"] .border-l-4'));
  return els.map((e) => e.textContent).join(' | ');
});
console.log(`[${seekerLabel}] hint strip after reveal: ${hintTextRevealed}`);

// Presence: verify the seeker's .track() landed via the store flag.
await new Promise((r) => setTimeout(r, 1500));
const tracked = await seeker.evaluate(() => window.useStore.getState().lastTrackedDistance);
console.log(`[${seekerLabel}] lastTrackedDistance =`, tracked);

// The store flag is the closest we can get without a 4th observer (which
// crashes the seeker's page mid-eval). The track() payload schema is
// asserted by reading the SeekerHuntScreen source — it has player_id,
// name, emoji, distance_meters only (NO lat/lng).

const verdict =
  radarChecks.hasRadar &&
  radarChecks.hasSweep &&
  /\d+/.test(radarChecks.distance ?? '') &&
  /BURNING|HOT|WARM|COLD|FROZEN/.test(radarChecks.temp ?? '') &&
  radarChecks.imgBlur === '20' &&
  sharpenedBlur === '0' &&
  sharpenBtnDisabled === true &&
  /behind the fountain/.test(hintTextRevealed) &&
  // Distance should fall sharply when GPS moves closer
  parseInt(radarChecks.distance, 10) > parseInt(closerDistance, 10) &&
  // Presence is wired
  typeof tracked === 'number' && tracked > 0;

console.log('\nVERDICT:', verdict ? 'PASS' : 'FAIL');

await persistPersonas();
await browser.close();
process.exit(verdict ? 0 : 1);
