import { defineConfig } from 'vitest/config';

// Testes das regras do Firestore: precisam do emulador (`npm run test:rules`)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['firestore-tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000
  }
});
