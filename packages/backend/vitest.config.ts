import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Each test file gets its own worker — important for SQLite (file-per-test)
    pool: 'forks',
  },
});
