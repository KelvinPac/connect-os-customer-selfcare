import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// The ConnectOS API only allows CORS from FRONTEND_URL / http://localhost:3000, so in
// development the portal runs on :3000 and proxies /api to the API (no CORS involved).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:5008'
  const proxy = { '/api': { target, changeOrigin: true }, '/company': { target, changeOrigin: true } }
  return {
    plugins: [vue(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    // /company/* are the API's public name + logo endpoints; they live outside /api/v1.
    server: {
      port: 3000,
      strictPort: true,
      proxy: proxy,
    },
    preview: { port: 3000, proxy: proxy },
  }
})
