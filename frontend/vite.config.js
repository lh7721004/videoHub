import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5300,
    strictPort: true,
    allowedHosts: ['videohub.lkim.me'],
    proxy: {
      '/api': 'http://localhost:8300',
      '/uploads': 'http://localhost:8300',
      '/ws': { target: 'http://localhost:8300', ws: true },
      '/live': 'http://localhost:8888',
    },
  },
})
