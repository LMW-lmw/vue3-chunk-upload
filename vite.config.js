import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 8009,
    host: true,
    proxy: {
      // https://cn.vitejs.dev/config/#server-proxy
      '/api': {
        target: 'http://192.168.0.177:8080/',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
