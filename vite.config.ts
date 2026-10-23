import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.VITE_BASE || '/pixel-rogue-fighter/',
  server: { port: 5173 },
  build: { target: 'es2022' },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
