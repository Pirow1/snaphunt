// Phase 2.3 smoke — compass + bearing math.
//
// We can't rotate a physical device in Playwright, so we dispatch synthetic
// `deviceorientationabsolute` events with explicit `alpha` values and verify
// the math:
//
//   compass.ts converts Android alpha (CCW from N) → heading (CW from N):
//     alpha=0   → heading=0   (facing N)
//     alpha=270 → heading=90  (facing E)
//
//   BearingArrow rotates by  arrowAngle = (bearing - heading + 360) % 360.
//
// Setup: position me at 51.5037,-0.1246 (~330m due north of Big Ben at
// 51.5007,-0.1246). bearingTo should be ≈ 180° (south).
//
//   heading=0  (N) → arrowAngle ≈ 180° (arrow points down)
//   heading=90 (E) → arrowAngle ≈  90° (arrow points right — target is on my right)
//   Δ-arrowAngle = -90° (rotated 90° CCW) — opposite of the 90° CW device turn

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5173';
mkdirSync('_smoke/out', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  geolocation: { latitude: 51.5037, longitude: -0.1246, accuracy: 5 },
  permissions: ['geolocation'],
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

console.log('→ goto /compass-test');
await page.goto(BASE + '/compass-test', { waitUntil: 'domcontentloaded' });

// Wait for bearing to populate (depends on coords)
await page.waitForFunction(() => {
  const el = document.querySelector('[data-testid="bearing"]');
  return el && /\d/.test(el.textContent ?? '');
}, null, { timeout: 8000 });

const bearingText = (await page.getByTestId('bearing').textContent()).trim();
console.log('bearing =', bearingText);
const bearing = parseFloat(bearingText);

// Dispatch synthetic compass events
async function setAlpha(alpha) {
  await page.evaluate((a) => {
    // Constructing DeviceOrientationEvent directly with init dict
    const ev = new DeviceOrientationEvent('deviceorientationabsolute', {
      absolute: true,
      alpha: a,
      beta: 0,
      gamma: 0,
    });
    window.dispatchEvent(ev);
  }, alpha);
  // Give React a tick to render
  await new Promise((r) => setTimeout(r, 100));
}

console.log('→ alpha=0 (facing N)');
await setAlpha(0);
const heading0 = parseFloat((await page.getByTestId('heading').textContent()).replace('°', ''));
const arrow0  = parseFloat((await page.getByTestId('arrow-angle').textContent()).replace(/[^\d.]/g, ''));
console.log(`  heading=${heading0}°, arrow=${arrow0}°`);
await page.screenshot({ path: '_smoke/out/p23-north.png' });

console.log('→ alpha=270 (facing E, rotated 90° clockwise)');
await setAlpha(270);
const heading1 = parseFloat((await page.getByTestId('heading').textContent()).replace('°', ''));
const arrow1  = parseFloat((await page.getByTestId('arrow-angle').textContent()).replace(/[^\d.]/g, ''));
console.log(`  heading=${heading1}°, arrow=${arrow1}°`);
await page.screenshot({ path: '_smoke/out/p23-east.png' });

// Test bearingTo via fixed-bearing pure call
const bMath = await page.evaluate(async () => {
  const mod = await import('/src/lib/compass.ts');
  // 0,0 → 1,1 should be NE — bearing in first quadrant
  return mod.bearingTo(0, 0, 1, 1);
});
console.log('bearingTo(0,0,1,1):', bMath.toFixed(2), '(expected ~45)');

const tol = 1.0;
const headingOk = Math.abs(heading0 - 0) <= tol && Math.abs(heading1 - 90) <= tol;
// arrow0 ≈ bearing, arrow1 ≈ bearing - 90 (mod 360)
const arrow0Expected = ((bearing - 0) % 360 + 360) % 360;
const arrow1Expected = ((bearing - 90) % 360 + 360) % 360;
const arrowOk =
  Math.abs(arrow0 - arrow0Expected) <= tol &&
  Math.abs(arrow1 - arrow1Expected) <= tol;
const deltaOk = Math.abs(((arrow1 - arrow0 + 540) % 360) - 180 + 90) <= tol;
const mathOk = Math.abs(bMath - 45) < 1.0;

const verdict =
  pageErrors.length === 0 &&
  headingOk &&
  arrowOk &&
  deltaOk &&
  mathOk;

console.log('\n=== pass map ===');
console.log('  no pageerr: ', pageErrors.length === 0);
console.log('  heading:    ', headingOk, `(got ${heading0}, ${heading1}; expected 0, 90)`);
console.log('  arrow:      ', arrowOk, `(got ${arrow0}, ${arrow1}; expected ${arrow0Expected.toFixed(1)}, ${arrow1Expected.toFixed(1)})`);
console.log('  delta=-90°: ', deltaOk, `(${arrow1 - arrow0}°)`);
console.log('  bearingTo:  ', mathOk, `(${bMath.toFixed(2)})`);

console.log('\nVERDICT:', verdict ? 'PASS' : 'FAIL');

await browser.close();
process.exit(verdict ? 0 : 1);
