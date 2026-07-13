import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Efiko PWA — Stage 2 foundation.
// Workbox precaches the app shell so Efiko opens and teaches with zero network.
export default defineConfig({
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo.png'],
      manifest: {
        name: 'Efiko Learning',
        short_name: 'Efiko',
        description: 'Learn even without internet.',
        theme_color: '#0f766e',
        background_color: '#0b1120',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // App shell precache — the foundation of Offline Mode (0 MB).
        // Keep it lean: the large 512px install icons are fetched on demand by the
        // browser at install time, so we exclude them from the first-load precache.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['**/icon-512.png', '**/icon-maskable-512.png'],
        navigateFallback: '/index.html',
        // Public SEO landing pages are real static documents, not the SPA shell — let the
        // browser load them from the network instead of the app-shell fallback.
        navigateFallbackDenylist: [/^\/(ai|thinkspace|courses|whiteboard|assessments|certificates|marketplace|community|jobs|research|academy|about|privacy)(\/|$)/]
      },
      devOptions: { enabled: true }
    })
  ]
});
