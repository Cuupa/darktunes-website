/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src'),
      'darktunes-sanitize-html-server': resolve(projectRoot, 'src/lib/sanitizeHtml.server.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    // https origin so Secure cookies are accepted (production is https); jsdom's
    // default http://localhost rejects them. jsdom 26 is pinned in package.json.
    environmentOptions: { jsdom: { url: 'https://localhost/' } },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/unit/**/*.{test,spec}.{ts,tsx}'],
  },
})
