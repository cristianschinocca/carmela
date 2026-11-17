import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'prompt',
    injectRegister: 'auto',
    manifest: {
      name: 'Mistro · Gestión de cafeterías',
      short_name: 'Mistro',
      start_url: '/',
      display: 'standalone',
      background_color: '#faf9f7',
      theme_color: '#bd2d69',
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,woff,woff2,svg,png,ico}'],
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/api\//],
    },
  })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3001' } },
});
