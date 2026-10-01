import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      include: ['services/**/*.ts', 'components/**/*.tsx', 'App.tsx', 'constants.ts'],
      // Ratchet only: raise these as coverage grows, never lower them.
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 86,
        branches: 91,
      },
    },
  },
});
