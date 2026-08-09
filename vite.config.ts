import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import Components from 'unplugin-vue-components/vite'
import { VarletImportResolver } from '@varlet/import-resolver'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [
    vue(),
    Components({
      dts: false,
      resolvers: [VarletImportResolver()],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '我的日记',
        short_name: '日记',
        description: '随时随地记录生活',
        theme_color: '#007AFF',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
  },
})
