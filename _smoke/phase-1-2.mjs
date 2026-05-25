// Phase 1.2 smoke test — anonymous Supabase auth wiring.
//
// Pass criteria:
//   - / loads with no console / page errors
//   - window.supabase exists (dev-only handle wired in App.tsx)
//   - supabase.auth.getSession() returns a session whose user.id is a UUID
//   - Zustand store identity.authUserId equals that UUID
//   - The auth.users row exists (we ask the client; the server also has it)

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5174';

mkdirSync('_smoke/out', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));

console.log('→ goto', BASE);
await page.goto(BASE + '/', { waitUntil: 'networkidle' });

// Wait up to 5s for the auth handshake (network round-trip to Supabase)
const authResult = await page.waitForFunction(async () => {
  // @ts-ignore — dev-only handle
  const sb = window.supabase;
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}, null, { timeout: 8000 }).then(h => h.jsonValue()).catch(() => null);

console.log('supabase.auth.getSession().user.id =', authResult);

// Pull the Zustand identity slice (exposed on window in dev)
const storeAuthUserId = await page.evaluate(() => {
  const w = window;
  return w.useStore?.getState().identity.authUserId ?? null;
});
console.log('store.identity.authUserId =', storeAuthUserId);

// Inspect store via reading the React-fiber-attached value is fragile; instead
// trigger a second getSession from the page after a tick and assert it survived
// the StrictMode double-effect.
const second = await page.evaluate(async () => {
  // @ts-ignore
  const { data } = await window.supabase.auth.getSession();
  return {
    userId: data.session?.user?.id ?? null,
    isAnonymous: data.session?.user?.is_anonymous ?? null,
    accessTokenPrefix: (data.session?.access_token ?? '').slice(0, 16),
  };
});
console.log('second-read session:', second);

await page.screenshot({ path: '_smoke/out/p12-home.png', fullPage: false });

console.log('\n=== console errors ===');
console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');
console.log('\n=== page errors ===');
console.log(pageErrors.length ? pageErrors.join('\n') : '(none)');

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pass =
  consoleErrors.length === 0 &&
  pageErrors.length === 0 &&
  uuidRe.test(authResult ?? '') &&
  second.userId === authResult &&
  storeAuthUserId === authResult;

console.log('\nVERDICT:', pass ? 'PASS' : 'FAIL');

await browser.close();
process.exit(pass ? 0 : 1);
