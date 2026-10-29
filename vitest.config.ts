import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { fileURLToPath } from 'node:url';

// O plugin do Svelte compila os módulos .svelte.ts (runes como $state) e os componentes.
// Testes de componente usam `// @vitest-environment jsdom` no topo do arquivo.
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  resolve: { alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
