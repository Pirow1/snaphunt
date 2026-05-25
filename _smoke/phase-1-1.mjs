import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('_smoke/out', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (e) => pageErrors.push(e.message));

console.log('→ goto /');
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

const vtSupported = await page.evaluate(() => typeof document.startViewTransition === 'function');
console.log('View Transitions API supported:', vtSupported);

const bg = await page.evaluate(() => {
  const app = document.getElementById('app');
  if (!app) return null;
  const cs = getComputedStyle(app);
  return { bg: cs.backgroundColor, hasBefore: !!getComputedStyle(app, '::before').backgroundImage };
});
console.log('#app computed:', bg);

const startBtn = await page.getByRole('button', { name: /Start a Hunt/i });
const joinBtn = await page.getByRole('button', { name: /Join a Hunt/i });
console.log('Start btn visible:', await startBtn.isVisible());
console.log('Join  btn visible:', await joinBtn.isVisible());

const startBg = await startBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
const joinBg = await joinBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
console.log('Start btn bg:', startBg, '(expect blaze #E94F2A → rgb(233, 79, 42))');
console.log('Join  btn bg:', joinBg, '(expect cream-2 #EADBB8 → rgb(234, 219, 184))');

await page.screenshot({ path: '_smoke/out/01-home.png', fullPage: false });

// Watch for VT pseudo-elements during navigation.
const vtSeen = await page.evaluate(() => {
  return new Promise((resolve) => {
    let saw = false;
    const obs = new MutationObserver(() => {});
    // We can't easily see ::view-transition pseudos via DOM. Instead, hook startViewTransition.
    const orig = document.startViewTransition?.bind(document);
    if (!orig) return resolve({ patched: false, transitioned: false });
    document.startViewTransition = (cb) => {
      const t = orig(cb);
      t.ready.then(() => {
        saw = true;
      });
      return t;
    };
    setTimeout(() => {
      obs.disconnect();
      resolve({ patched: true, transitioned: saw });
    }, 100);
  });
});
console.log('VT patch installed:', vtSeen);

console.log('→ click Start a Hunt (with mid-transition screenshot race)');
const navP = startBtn.click();
// Try to capture mid-transition shot
await new Promise((r) => setTimeout(r, 120));
await page.screenshot({ path: '_smoke/out/02-mid-transition.png', fullPage: false });
await navP;
await page.waitForURL('**/create', { timeout: 5000 });
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '_smoke/out/03-create.png', fullPage: false });
console.log('At /create:', page.url());

// Verify the placeholder rendered
const createHeading = await page.getByRole('heading', { name: /Create Lobby/i });
console.log('Create Lobby heading visible:', await createHeading.isVisible());

// Click ← Home
console.log('→ click ← Home');
const homeBtn = page.getByRole('button', { name: /← Home/i });
const backP = homeBtn.click();
await new Promise((r) => setTimeout(r, 120));
await page.screenshot({ path: '_smoke/out/04-back-mid.png', fullPage: false });
await backP;
await page.waitForURL('http://localhost:5173/', { timeout: 5000 });
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '_smoke/out/05-home-again.png', fullPage: false });
console.log('Back at:', page.url());

console.log('\n=== console errors ===');
console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');
console.log('\n=== page errors ===');
console.log(pageErrors.length ? pageErrors.join('\n') : '(none)');

await browser.close();
console.log('\nDONE');
