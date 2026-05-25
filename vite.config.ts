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
  },
});
