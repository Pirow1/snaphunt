import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // `autoUpdate` reloads as soon as a new SW activates. On Vercel that can
      // misfire repeatedly (per-edge hash drift in the precache manifest) and
      // trap users in a reload loop. `prompt` only installs; we don't surface
      // a "new version" UI so the user just keeps the existing SW.
      registerType: 'prompt',
      includeAssets: ['icons/*'],
      manifest: {
        name: 'Potch Treasure Hunt',
        short_name: 'Potch',
        description: 'Photographic hide-and-seek — SnapHunt & Rush B game modes',
        theme_color: '#0A1208',
        background_color: '#0A1208',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/huggingface\.co\/.*\.onnx$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'onnx-models',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  server: {
    host: true,
    // COOP + COEP credentialless lets ORT WASM use SharedArrayBuffer threads
    // when available without requiring every cross-origin asset (fonts, HF
    // model weights) to opt-in via CORP. Vision falls back to single-threaded
    // WASM regardless if the browser can't grant SAB.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  preview: {
    host: true,
    // Mirror dev so local `vite preview` builds the same SAB-capable env.
    // In production, vercel.json serves these headers from edge.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
});
