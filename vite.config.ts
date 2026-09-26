import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Plugin to automatically write dynamic version.json into dist and public at build time
function generateVersionJsonPlugin(): Plugin {
  return {
    name: 'generate-version-json',
    writeBundle() {
      const buildTime = new Date().toISOString();
      const version = process.env.npm_package_version || '5.0.0';
      const versionData = {
        version,
        buildTime,
        gitCommit: process.env.GITHUB_SHA || 'local-build',
        app: 'Hotel Damview Billing & Invoicing Suite',
      };

      try {
        const rootDir = path.resolve('.');
        const distPath = path.join(rootDir, 'dist');
        if (fs.existsSync(distPath)) {
          fs.writeFileSync(path.join(distPath, 'version.json'), JSON.stringify(versionData, null, 2));
        }
        const publicPath = path.join(rootDir, 'public');
        if (fs.existsSync(publicPath)) {
          fs.writeFileSync(path.join(publicPath, 'version.json'), JSON.stringify(versionData, null, 2));
        }
      } catch (err) {
        console.warn('[Vite Plugin] Warning writing version.json:', err);
      }
    },
  };
}

export default defineConfig(() => {
  const basePath = process.env.VITE_BASE_PATH || './';
  const pwaScope = process.env.VITE_BASE_PATH || '/';
  const buildTime = new Date().toISOString();
  const version = process.env.npm_package_version || '5.0.0';

  return {
    base: basePath,
    define: {
      '__APP_VERSION__': JSON.stringify(version),
      '__BUILD_TIME__': JSON.stringify(buildTime),
    },
    plugins: [
      react(),
      tailwindcss(),
      generateVersionJsonPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: pwaScope,
          name: 'Hotel Damview Billing & Invoicing Suite',
          short_name: 'Damview ERP',
          description:
            'Offline-first billing, invoicing, and quotation management application for Hotel Damview with dynamic A4 PDF preview, client ledgers, and background Google Workspace sync.',
          theme_color: '#1c1917',
          background_color: '#1c1917',
          display: 'standalone',
          orientation: 'any',
          start_url: pwaScope,
          scope: pwaScope,
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          categories: ['business', 'finance', 'productivity', 'utilities'],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/version.json'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/health/, /^\/_healthz/, /version\.json$/],
          runtimeCaching: [
            {
              urlPattern: /version\.json/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': '.',
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      chunkSizeWarningLimit: 2500,
    },
    server: {
      hmr: false,
      ws: false as const,
    },
  };
});
