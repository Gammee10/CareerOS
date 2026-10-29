import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure functions first (parser, due logic, scheduling); integration tests against a real
    // database run in their own nightly job, not here.
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
