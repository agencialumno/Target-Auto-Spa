import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// O plugin do Svelte compila os módulos .svelte.ts (runes como $state) usados pelo authStore
export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
