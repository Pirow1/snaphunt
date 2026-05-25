// Phase 1.3 smoke test — Home + Create Lobby + createSession() action.
//
// Pass criteria (per playbook):
//   - / renders the SNAPHUNT title with blaze HUNT rotated -3deg
//   - Tap "Start a Hunt", enter name, pick emoji, submit
//   - Lands on /lobby/<uuid> via View Transition (no hard cut)
//   - DB: sessions row exists with our code + host_id = our auth uid
//   - DB: players row exists with id = auth uid + is_host = true + name + emoji
//   - Zero console / page errors

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5175';
mkdirSync('_smoke/out', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));

console.log('→ goto', BASE);
await page.goto(BASE + '/', { waitUntil: 'networkidle' });

// Wait for anon auth handshake
const uid = await page.waitForFunction(async () => {
  const { data } = await window.supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}, null, { timeout: 8000 }).then(h => h.jsonValue());
console.log('authUserId:', uid);

// Check title: HUNT span has rotate(-3deg) and blaze colour
const titleCheck = await page.evaluate(() => {
  const hunt = [...document.querySelectorAll('h1 span')].find(s => s.textContent === 'HUNT');
  if (!hunt) return { found: false };
  const cs = getComputedStyle(hunt);
  return {
    found: true,
    color: cs.color,
    transform: cs.transform,
  };
});
console.log('HUNT span:', titleCheck);

await page.screenshot({ path: '_smoke/out/p13-home.png' });

// Tap "Start a Hunt"
console.log('→ click Start a Hunt');
await page.getByRole('button', { name: /Start a Hunt/i }).click();
await page.waitForURL('**/create', { timeout: 5000 });
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '_smoke/out/p13-create.png' });

// Fill the form
console.log('→ fill name + pick emoji');
const testName = 'Smoke' + Math.floor(Math.random() * 10000);
await page.getByLabel(/Your hunter name/i).fill(testName);
// Pick the third emoji (🦅) so it's not the default
await page.getByRole('button', { name: '🦅' }).click();

await page.screenshot({ path: '_smoke/out/p13-create-filled.png' });

// Submit
console.log('→ submit');
const submitBtn = page.getByRole('button', { name: /Set the Trap/i });
await submitBtn.click();

// Should land on /lobby/<uuid>
await page.waitForURL(/\/lobby\/[0-9a-f-]{36}$/, { timeout: 10000 });
const lobbyUrl = page.url();
const sessionId = lobbyUrl.split('/lobby/')[1];
console.log('navigated to:', lobbyUrl);
console.log('sessionId:', sessionId);

await page.waitForLoadState('networkidle');
await page.screenshot({ path: '_smoke/out/p13-lobby.png' });

// Verify DB rows via the same client (RLS lets us see our own session + player)
const dbCheck = await page.evaluate(async (sid) => {
  const { data: session, error: sErr } = await window.supabase
    .from('sessions').select('*').eq('id', sid).maybeSingle();
  const { data: players, error: pErr } = await window.supabase
    .from('players').select('*').eq('session_id', sid);
  return {
    session,
    sessionErr: sErr?.message,
    players,
    playersErr: pErr?.message,
  };
}, sessionId);
console.log('DB session:', dbCheck.session);
console.log('DB players:', dbCheck.players);
console.log('errors:', { s: dbCheck.sessionErr, p: dbCheck.playersErr });

// Read store for cross-check
const storeState = await page.evaluate(() => {
  const s = window.useStore.getState();
  return {
    sessionId: s.session?.id,
    sessionCode: s.session?.code,
    identityName: s.identity.name,
    identityEmoji: s.identity.emoji,
    storeAuthId: s.identity.authUserId,
  };
});
console.log('store snapshot:', storeState);

console.log('\n=== console errors ===');
console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');
console.log('\n=== page errors ===');
console.log(pageErrors.length ? pageErrors.join('\n') : '(none)');

const transformOk = /matrix.*0?\.99/.test(titleCheck.transform ?? '') ||
                    /-3deg|0\.998477|-0\.0523/.test(titleCheck.transform ?? '');
const blazeOk = (titleCheck.color ?? '').replace(/\s/g, '') === 'rgb(233,79,42)';

const verdict =
  consoleErrors.length === 0 &&
  pageErrors.length === 0 &&
  titleCheck.found &&
  blazeOk &&
  transformOk &&
  /\/lobby\/[0-9a-f-]{36}$/.test(lobbyUrl) &&
  dbCheck.session?.host_id === uid &&
  dbCheck.session?.code?.length === 6 &&
  dbCheck.players?.length === 1 &&
  dbCheck.players[0].id === uid &&
  dbCheck.players[0].is_host === true &&
  dbCheck.players[0].name === testName &&
  dbCheck.players[0].emoji === '🦅' &&
  storeState.sessionCode === dbCheck.session?.code;

console.log('\nVERDICT:', verdict ? 'PASS' : 'FAIL');
console.log('checks: transformOk=%s blazeOk=%s', transformOk, blazeOk);

await browser.close();
process.exit(verdict ? 0 : 1);
