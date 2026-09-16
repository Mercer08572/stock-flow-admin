import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPrefix = env.VITE_API_BASE_URL || '/api/v1'

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        [apiPrefix]: {
          // 与 ../stock-flow/.env.example 的 HTTP_ADDR=:8181 保持一致。
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:8181',
          changeOrigin: true,
        },
      },
    },
  }
})
