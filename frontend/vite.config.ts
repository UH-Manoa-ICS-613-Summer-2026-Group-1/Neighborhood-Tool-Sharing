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
    setupFiles: "./tests/vitest_setup.ts",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],

    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/main.tsx",
        "src/**/*.d.ts",
      ],
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5000'
    }
  },
})
