// Phase 3.5 smoke — RoundResultScreen + WinnerRevealScreen + scoring math.
//
// Lighter than a full-game smoke (the full flow is covered by phase-3-3);
// here we DB-seed each scenario and drive a single browser through the
// finished-round / game-finished routes, asserting on the new UI plus
// the points_awarded value that the migration's RPC computed.
//
// Run modes:
//   node _smoke/phase-3-5.mjs phase1   → captures anon auth uid + storage
//   (intermediate: caller seeds DB with that uid via Supabase MCP)
//   node _smoke/phase-3-5.mjs round    → drive RoundResultScreen scenario
//   node _smoke/phase-3-5.mjs winner   → drive WinnerRevealScreen scenario
//   node _smoke/phase-3-5.mjs tie      → WinnerRevealScreen with co-champions

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

mkdirSync('_smoke/out', { recursive: true });

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5173';
const STATE_FILE = '_smoke/out/phase-3-5-state.json';
const STORAGE_FILE = '_smoke/out/phase-3-5-storage.json';
const mode = process.argv[2] ?? 'phase1';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  permissions: ['geolocation'],
  geolocation: { latitude: -33.9249, longitude: 18.4241 },
  ...(mode !== 'phase1' && existsSync(STORAGE_FILE) ? { storageState: STORAGE_FILE } : {}),
});

context.on('page', (p) => {
  p.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) console.log(`[browser/${m.type()}]`, m.text().slice(0, 200));
  });
  p.on('pageerror', (e) => console.log('[browser/pageerror]', e.message));
});

const page = await context.newPage();
await page.goto(`${BASE}/`);
const uid = await page.waitForFunction(
  () => window.useStore?.getState?.()?.identity?.authUserId ?? null,
  { timeout: 15_000 },
).then((h) => h.jsonValue());

if (mode === 'phase1') {
  await context.storageState({ path: STORAGE_FILE });
  writeFileSync(STATE_FILE, JSON.stringify({ uid }));
  console.log('phase1: uid =', uid);
  await browser.close();
  process.exit(0);
}

const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
const { sessionId, awarded } = state;

if (mode === 'round') {
  // RoundResultScreen: navigate to /game/<id> with a finished round.
  await page.goto(`${BASE}/game/${sessionId}`);
  // GameRouter shows RoleReveal first — accept it so we fall through.
  await page.waitForSelector('[data-testid="accept-mission"]', { timeout: 10_000 });
  await page.locator('[data-testid="accept-mission"]').click();

  // RoundResultScreen should render because round.status='finished'.
  await page.waitForSelector('[data-testid="round-result"]', { timeout: 10_000 });
  const headline = (await page.locator('[data-testid="round-result-headline"]').textContent())?.trim();
  console.log('round: headline =', headline);

  const breakdown = await page.locator('[data-testid="round-result-breakdown"]').textContent();
  console.log('round: breakdown text =', breakdown?.replace(/\s+/g, ' ').trim());

  // The points_awarded came from the RPC computation when we seeded. Verify
  // the screen renders a +N number that matches the seeded awarded value.
  const screenText = await page.locator('[data-testid="round-result-breakdown"]').innerText();
  const m = screenText.match(/\+(\d+)/);
  if (!m || Number(m[1]) !== awarded) {
    console.log(`FAIL: expected breakdown to show +${awarded}, got "${screenText}"`);
    await page.screenshot({ path: '_smoke/out/phase-3-5-round-FAIL.png', fullPage: true });
    process.exit(1);
  }

  const ranks = await page.locator('[data-testid="round-result-rank"]').count();
  if (ranks < 1) { console.log('FAIL: standings list empty'); process.exit(1); }

  await page.screenshot({ path: '_smoke/out/phase-3-5-round.png', fullPage: true });
  console.log(`PASS: RoundResultScreen shows winner + breakdown +${awarded} + ${ranks} standings rows`);
  await browser.close();
  process.exit(0);
}

if (mode === 'winner' || mode === 'tie') {
  await page.goto(`${BASE}/game/${sessionId}/winner`);
  await page.waitForSelector('[data-testid="winner-reveal"]', { timeout: 10_000 });
  await page.waitForSelector('[data-testid="winner-card"]', { timeout: 5_000 });

  const entries = await page.locator('[data-testid="winner-entry"]').count();
  console.log(`${mode}: winner entries =`, entries);

  const expectedEntries = mode === 'tie' ? 2 : 1;
  if (entries !== expectedEntries) {
    console.log(`FAIL: expected ${expectedEntries} winner entries, got ${entries}`);
    await page.screenshot({ path: `_smoke/out/phase-3-5-${mode}-FAIL.png`, fullPage: true });
    process.exit(1);
  }

  await page.screenshot({ path: `_smoke/out/phase-3-5-${mode}-reveal.png`, fullPage: true });

  // Click "See Recap →" and verify we land on /gallery/<id>.
  await page.locator('[data-testid="winner-see-recap"]').click();
  await page.waitForURL(`**/gallery/${sessionId}`, { timeout: 10_000 });
  await page.waitForSelector('[data-testid="gallery"]', { timeout: 10_000 });

  await page.screenshot({ path: `_smoke/out/phase-3-5-${mode}.png`, fullPage: true });
  console.log(`PASS: WinnerRevealScreen rendered ${entries} ${mode === 'tie' ? 'co-champions' : 'champion'} and routed to gallery`);
  await browser.close();
  process.exit(0);
}

console.log('unknown mode:', mode);
await browser.close();
process.exit(2);
