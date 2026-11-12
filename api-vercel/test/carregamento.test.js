// Teste de fumaça: cada endpoint da API precisa CARREGAR (import e require). Um erro de carregamento,
// como o ERR_REQUIRE_ESM do jose dentro do jwks-rsa (firebase-admin) em Node < 22.12, derruba a função
// inteira na Vercel com 500 antes de qualquer lógica rodar, e os testes da lógica não o enxergam.
// Cada carga roda num processo novo, igual ao que a Vercel faz ao iniciar a função.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

const ENDPOINTS = [
  'api/usuarios/criar.js',
  'api/usuarios/remover.js',
  'api/usuarios/condominio.js',
  'api/usuarios/detalhe.js',
  'api/pagamento/criar.js',
  'api/pagamento/status.js',
  'api/asaas/webhook.js',
  'api/retorno/[tipo].js'
];

const rodar = (codigo) =>
  execFileSync(process.execPath, ['-e', codigo], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).trim();

test('firebase-admin/auth carrega em CommonJS (a cadeia jwks-rsa > jose é ESM)', () => {
  const saida = rodar(`require('firebase-admin/auth'); require('firebase-admin/app'); require('firebase-admin/firestore'); console.log('ok');`);
  assert.equal(saida, 'ok');
});

for (const arquivo of ENDPOINTS) {
  test(`endpoint ${arquivo} carrega por import() e por require() e exporta um handler`, () => {
    const caminho = JSON.stringify(join(raiz, arquivo));
    const viaImport = rodar(`import(${JSON.stringify(pathToFileURL(join(raiz, arquivo)).href)}).then((m) => console.log(typeof m.default)).catch((e) => { console.error(e.code, e.message); process.exit(1); });`);
    assert.equal(viaImport, 'function');
    const viaRequire = rodar(`const m = require(${caminho}); console.log(typeof (m.default ?? m));`);
    assert.equal(viaRequire, 'function');
  });
}
