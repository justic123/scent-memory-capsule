import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 设置本地代理，欺骗浏览器，解决 CORS 跨域拦截
    proxy: {
      '/api/v3': {
        target: 'https://ark.cn-beijing.volces.com',
        changeOrigin: true,
      }
    }
  }
})