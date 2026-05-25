import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*'],
      manifest: {
        name: 'SnapHunt',
        short_name: 'SnapHunt',
        description: 'Photographic hide-and-seek',
        theme_color: '#F4E8D0',
        background_color: '#F4E8D0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [],
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
