import { defineConfig } from 'vitest/config';

// Unit tests for pure modules (lib/*). The DOM/Playwright checks live outside the repo's unit suite.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
