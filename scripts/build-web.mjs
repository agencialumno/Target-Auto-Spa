// Build da versão web do admin (saída em build-web/). O build do app (npm run build) não muda.
// Uso: npm run build:web
import { spawnSync } from 'node:child_process';

const r = spawnSync('npx', ['vite', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, BUILD_WEB_ADMIN: '1' }
});
process.exit(r.status ?? 1);
