import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: process.env.VITEST_INCLUDE ? [process.env.VITEST_INCLUDE] : ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 180_000,
    hookTimeout: 120_000,
  },
});
