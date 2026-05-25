import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5176';

const browser = await chromium.launch({
  headless: false,
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'],
});
const page = await browser.newPage();
page.on('console', (m) => console.log(`[${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('requestfailed', (r) => console.log('[reqfail]', r.url(), r.failure()?.errorText));

console.log('→ goto /vision-test');
await page.goto(BASE + '/vision-test', { waitUntil: 'domcontentloaded' });

// Probe WebGPU support and check store state every 5s for 30s
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const probe = await page.evaluate(() => ({
    hasWebGPU: typeof navigator.gpu !== 'undefined',
    progress: window.useStore?.getState().visionLoadProgress,
    ready: window.useStore?.getState().visionReady,
  }));
  console.log(`t=${5 * (i + 1)}s`, probe);
}

await browser.close();
