// Phase 1.4 smoke test — Join + Lobby with realtime.
//
// Two browser contexts (= two anon users):
//   A creates a session and waits in the lobby
//   B navigates to /join, types the code via the on-screen keypad, fills
//     identity, taps Join
//   B should appear in A's player list within 1500 ms (realtime CDC)
//   Begin-Hunt button must be disabled (only 2 players, need 3)
//   QR canvas exists on A's lobby

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5175';
mkdirSync('_smoke/out', { recursive: true });

const browser = await chromium.launch();

const makePage = async (label) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${label}/console]`, m.text()); });
  page.on('pageerror', (e) => console.log(`[${label}/pageerror]`, e.message));
  return { ctx, page };
};

// Capture ALL console for diagnostics this run
const makePageVerbose = async (label) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' || /\[rt\//.test(t)) console.log(`[${label}/${m.type()}]`, t);
  });
  page.on('pageerror', (e) => console.log(`[${label}/pageerror]`, e.message));
  return { ctx, page };
};
const a = await makePageVerbose('A');
const b = await makePageVerbose('B');

// --- A creates ---
console.log('[A] goto /');
await a.page.goto(BASE + '/', { waitUntil: 'networkidle' });
await a.page.waitForFunction(async () => !!(await window.supabase.auth.getSession()).data.session, null, { timeout: 8000 });

await a.page.getByRole('button', { name: /Start a Hunt/i }).click();
await a.page.waitForURL('**/create');
const aName = 'Alice' + Math.floor(Math.random() * 1000);
await a.page.getByLabel(/Your hunter name/i).fill(aName);
await a.page.getByRole('button', { name: '🦊' }).click();
await a.page.getByRole('button', { name: /Set the Trap/i }).click();
await a.page.waitForURL(/\/lobby\/[0-9a-f-]{36}$/);
await a.page.waitForLoadState('networkidle');

const code = await a.page.getByTestId('lobby-code').textContent();
console.log('[A] code displayed:', code);

await a.page.screenshot({ path: '_smoke/out/p14-A-lobby-solo.png' });

// QR canvas check
const qrCanvas = await a.page.evaluate(() => {
  const c = document.querySelector('canvas');
  return c ? { w: c.width, h: c.height, hasContent: c.toDataURL().length > 200 } : null;
});
console.log('[A] QR canvas:', qrCanvas);

// Begin Hunt should be disabled
const beginDisabled = await a.page.getByTestId('begin-hunt').isDisabled();
console.log('[A] Begin Hunt disabled (1 player):', beginDisabled);

// --- B joins ---
console.log('[B] goto /join');
await b.page.goto(BASE + '/join', { waitUntil: 'networkidle' });
await b.page.waitForFunction(async () => !!(await window.supabase.auth.getSession()).data.session, null, { timeout: 8000 });

// Type code via the on-screen keypad (NOT native keyboard)
console.log('[B] typing code via keypad:', code);
for (const ch of code) {
  await b.page.getByRole('button', { name: new RegExp(`^Key ${ch}$`, 'i') }).click();
}

// Should auto-advance to identity step
await b.page.waitForSelector('#join-name', { timeout: 5000 });
const bName = 'Bob' + Math.floor(Math.random() * 1000);
await b.page.getByLabel(/Your hunter name/i).fill(bName);
await b.page.getByRole('button', { name: '🐝' }).click();

await b.page.screenshot({ path: '_smoke/out/p14-B-identity.png' });

const tBefore = Date.now();
await b.page.getByRole('button', { name: /Join the Hunt/i }).click();
await b.page.waitForURL(/\/lobby\/[0-9a-f-]{36}$/, { timeout: 10000 });
console.log('[B] joined, at', b.page.url());

await b.page.waitForLoadState('networkidle');
await b.page.screenshot({ path: '_smoke/out/p14-B-lobby.png' });

// Now wait for A to see B appear via realtime — poll the store
console.log('[A] waiting for B to appear in A.useStore.players…');
let tAfter = null;
for (let i = 0; i < 50; i++) {
  const count = await a.page.evaluate(() => window.useStore.getState().players.length);
  if (count >= 2) { tAfter = Date.now(); break; }
  await new Promise((r) => setTimeout(r, 200));
}
if (!tAfter) {
  // Diagnostic dump
  const diag = await a.page.evaluate(async () => {
    const w = window;
    const s = w.useStore.getState();
    const { data: dbPlayers } = await w.supabase
      .from('players').select('*').eq('session_id', s.session?.id ?? '00000000-0000-0000-0000-000000000000');
    const channels = w.supabase.getChannels?.() ?? [];
    return {
      storePlayers: s.players.map(p => ({ name: p.name, host: p.is_host })),
      dbPlayers: (dbPlayers ?? []).map(p => ({ name: p.name, host: p.is_host })),
      channelStates: channels.map(c => ({ topic: c.topic, state: c.state })),
    };
  });
  console.log('[A] DIAG store/db/channels:', JSON.stringify(diag, null, 2));
  tAfter = Date.now();
} else {
  console.log(`[A] B appeared after ${tAfter - tBefore} ms`);
}

// Read A's player list directly
const aPlayers = await a.page.evaluate(() => {
  const w = window;
  return w.useStore?.getState().players.map((p) => ({ name: p.name, emoji: p.emoji, isHost: p.is_host })) ?? [];
});
console.log('[A] players in store:', aPlayers);
await a.page.screenshot({ path: '_smoke/out/p14-A-lobby-2players.png' });

// Begin Hunt still disabled with 2 players
const beginStillDisabled = await a.page.getByTestId('begin-hunt').isDisabled();
console.log('[A] Begin Hunt disabled (2 players):', beginStillDisabled);

const verdict =
  /^[A-Z0-9]{6}$/.test(code ?? '') &&
  !!qrCanvas?.hasContent &&
  beginDisabled === true &&
  beginStillDisabled === true &&
  aPlayers.length === 2 &&
  aPlayers.some((p) => p.name === aName && p.isHost) &&
  aPlayers.some((p) => p.name === bName && !p.isHost) &&
  (tAfter - tBefore) < 3000;

console.log('\nVERDICT:', verdict ? 'PASS' : 'FAIL');

await browser.close();
process.exit(verdict ? 0 : 1);
