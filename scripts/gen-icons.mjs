// Regenerate PWA raster icons from public/icons/icon.svg.
// Run: node scripts/gen-icons.mjs   (requires devDependency `sharp`)
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public/icons/icon.svg'));
const out = (f) => join(root, 'public/icons', f);

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const { file, size } of targets) {
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(out(file));
  console.log(`wrote public/icons/${file} (${size}x${size})`);
}
