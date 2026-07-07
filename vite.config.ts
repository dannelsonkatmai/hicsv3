import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Offline-first PWA is a hard requirement (spec §8): the service worker
// precaches the app shell so the command post keeps working without a network.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'HICS Command',
        short_name: 'HICS',
        description:
          'Hospital Incident Command System — incident management, IAP builder, status boards, and emergency preparedness.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Never cache Supabase API calls in the SW — the app's own sync layer
        // (IndexedDB + outbox) owns offline data, not the HTTP cache.
        navigateFallbackDenylist: [/^\/rest/, /^\/auth/, /^\/functions/],
        runtimeCaching: []
      }
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react']
  }
});
