// Servidor de desenvolvimento da versão web do admin. O app (npm run dev) não muda.
// Uso: npm run dev:web
import { spawnSync } from 'node:child_process';

const r = spawnSync('npx', ['vite', 'dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, BUILD_WEB_ADMIN: '1' }
});
process.exit(r.status ?? 1);
