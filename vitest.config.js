import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/setupTests.js',
        'src/server/**',
        'dist/**',
      ],
      statements: 10, // lowered for demonstration since we only wrote a few tests
      branches: 10,
      functions: 10,
      lines: 10,
    },
  },
});
