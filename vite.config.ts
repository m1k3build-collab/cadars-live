import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages project site: https://m1k3build-collab.github.io/cadars-live/
const pagesBase = '/cadars-live/'

export default defineConfig({
  base: pagesBase,
  server: { host: '0.0.0.0', port: 43123, strictPort: true },
  preview: { host: '0.0.0.0', port: 43123, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: pagesBase,
        name: 'CADARS Live',
        short_name: 'CADARS Live',
        description:
          'Who is on the air, the Monday GB3YA net, repeater coverage, and the club diary for Cwmbran & District Amateur Radio Society.',
        lang: 'en-GB',
        dir: 'ltr',
        start_url: pagesBase,
        scope: pagesBase,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1c1712',
        theme_color: '#1c1712',
        categories: ['utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: "Who's on the air",
            short_name: 'On air',
            url: `${pagesBase}#air`,
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Monday net',
            short_name: 'Net',
            url: `${pagesBase}#net`,
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Coverage map',
            short_name: 'Map',
            url: `${pagesBase}#map`,
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: `${pagesBase}index.html`,
        navigateFallbackAllowlist: [/^\/cadars-live\/?/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ico,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/kzzqrormwligrdbrxsrw\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
})
