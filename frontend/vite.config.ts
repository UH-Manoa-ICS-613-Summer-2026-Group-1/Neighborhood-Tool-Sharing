import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    environment: "jsdom",
    setupFiles: "./tests/vitest_setup.ts"
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5000'
    }
  },
})
