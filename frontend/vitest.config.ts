import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx', "**/*.spec.ts", "**/*.spec.tsx"],
    exclude: ['**/node_modules/**', '**/dist/**', "**/src/contracts/typechain-types/**"]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});