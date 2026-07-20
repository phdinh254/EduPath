import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Backend has no global "/api" prefix - its routes live at the root (e.g. /auth/login).
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
