import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Modo web do admin (npm run build:web): só as rotas de src/web/routes, saída em build-web/.
// Sem a variável, a configuração é exatamente a do app para celular (Tauri).
const WEB = process.env.BUILD_WEB_ADMIN === '1';

// CSP do painel web. frame-ancestors não funciona em <meta>: vai no cabeçalho (vercel.json).
const CSP_WEB = {
  'default-src': ['none'],
  'script-src': ['self', 'https://apis.google.com'],
  'style-src': ['self', 'unsafe-inline'],
  'img-src': ['self', 'data:', 'https://*.googleusercontent.com', 'https://firebasestorage.googleapis.com'],
  'font-src': ['self', 'data:'],
  'connect-src': [
    'self',
    'https://*.googleapis.com',
    'https://*.firebaseio.com',
    'https://*.firebaseapp.com',
    'https://target-auto-spa-api.vercel.app'
  ],
  'frame-src': ['https://target-auto-spa-33842.firebaseapp.com', 'https://accounts.google.com'],
  'object-src': ['none'],
  'base-uri': ['self'],
  'form-action': ['self']
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: WEB ? 'web-admin/dist' : 'build',
      assets: WEB ? 'web-admin/dist' : 'build',
      fallback: 'index.html'
    }),
    ...(WEB ? { files: { routes: 'src/web/routes', appTemplate: 'src/web/app.html' }, csp: { mode: 'hash', directives: CSP_WEB } } : {})
  }
};

export default config;
