import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endpoint, criarLimitador, origensPermitidas, ipDe } from '../_lib/http.js';
import { criarUsuario, removerUsuario } from '../_lib/usuarios.js';

const SENHA = 'Abcdef1!x';

function fakeRes() {
  const r = { codigo: 0, cabecalhos: {}, corpo: undefined };
  r.setHeader = (k, v) => void (r.cabecalhos[k] = v);
  r.status = (c) => ((r.codigo = c), r);
  r.json = (c) => ((r.corpo = c), r);
  r.end = () => r;
  return r;
}

function fakeReq({ metodo = 'POST', origem, auth, corpo, tipo = 'application/json', ip = '1.1.1.1', tamanho } = {}) {
  return {
    method: metodo,
    headers: {
      ...(origem ? { origin: origem } : {}),
      ...(auth ? { authorization: auth } : {}),
      ...(tipo ? { 'content-type': tipo } : {}),
      ...(tamanho ? { 'content-length': String(tamanho) } : {}),
      'x-forwarded-for': `${ip}, 10.0.0.1`
    },
    body: corpo
  };
}

// Auth e Firestore falsos: a-adm é admin, c-cli é cliente
function deps() {
  const docs = new Map([
    ['users/adm1', { role: 'admin' }],
    ['users/cli1', { role: 'cliente' }]
  ]);
  const contas = new Set();
  return {
    docs,
    contas,
    auth: {
      verifyIdToken: async (t) => {
        if (!['adm1', 'cli1'].includes(t)) throw new Error('token ruim (detalhe interno)');
        return { uid: t };
      },
      createUser: async ({ email }) => {
        if (contas.has(email)) throw Object.assign(new Error('x'), { code: 'auth/email-already-exists' });
        contas.add(email);
        return { uid: 'novo1' };
      },
      deleteUser: async () => {}
    },
    db: {
      doc: (c) => ({
        get: async () => ({ exists: docs.has(c), data: () => docs.get(c) }),
        set: async (v) => void docs.set(c, v),
        delete: async () => void docs.delete(c)
      }),
      collection: () => ({
        where: () => ({ count: () => ({ get: async () => ({ data: () => ({ count: 2 }) }) }) })
      })
    }
  };
}

const ENV_PROD = { VERCEL_ENV: 'production' };
const corpo = { nome: 'Fulano', email: 'f@ex.com', senha: SENHA, role: 'cliente' };

function montar(logica = criarUsuario, extra = {}) {
  const d = deps();
  const h = endpoint(logica, { obterDeps: () => d, limitador: criarLimitador({ max: 1000 }), env: ENV_PROD, ...extra });
  return { d, h };
}

async function chamar(h, req) {
  const res = fakeRes();
  await h(req, res);
  return res;
}

test('autenticação: sem token, token inválido, não-admin e admin', async () => {
  const { h, d } = montar();
  let r = await chamar(h, fakeReq({ corpo }));
  assert.equal(r.codigo, 401);

  r = await chamar(h, fakeReq({ auth: 'Bearer lixo', corpo }));
  assert.equal(r.codigo, 401);
  assert.ok(!JSON.stringify(r.corpo).includes('detalhe interno'), 'não vaza a mensagem interna');

  r = await chamar(h, fakeReq({ auth: 'Bearer cli1', corpo }));
  assert.equal(r.codigo, 403);
  assert.equal(d.contas.size, 0);

  r = await chamar(h, fakeReq({ auth: 'Bearer adm1', corpo }));
  assert.equal(r.codigo, 200);
  assert.equal(r.corpo.uid, 'novo1');
});

test('Authorization em formato errado é recusado', async () => {
  const { h } = montar();
  for (const auth of ['adm1', 'Basic adm1', 'Bearer ', 'bearer adm1']) {
    const r = await chamar(h, fakeReq({ auth, corpo }));
    assert.equal(r.codigo, 401, auth);
  }
});

test('remover: sem token, não-admin e admin', async () => {
  const { h, d } = montar(removerUsuario);
  assert.equal((await chamar(h, fakeReq({ corpo: { uid: 'cli1' } }))).codigo, 401);
  assert.equal((await chamar(h, fakeReq({ auth: 'Bearer cli1', corpo: { uid: 'adm1' } }))).codigo, 403);
  assert.equal((await chamar(h, fakeReq({ auth: 'Bearer adm1', corpo: { uid: 'cli1' } }))).codigo, 200);
  assert.equal(d.docs.has('users/cli1'), false);
});

test('CORS: origem do app recebe o cabeçalho; outras são recusadas', async () => {
  const { h } = montar();
  let r = await chamar(h, fakeReq({ metodo: 'OPTIONS', origem: 'tauri://localhost' }));
  assert.equal(r.codigo, 204);
  assert.equal(r.cabecalhos['Access-Control-Allow-Origin'], 'tauri://localhost');

  r = await chamar(h, fakeReq({ metodo: 'OPTIONS', origem: 'https://malicioso.com' }));
  assert.equal(r.codigo, 403);
  assert.equal(r.cabecalhos['Access-Control-Allow-Origin'], undefined);

  r = await chamar(h, fakeReq({ origem: 'https://malicioso.com', auth: 'Bearer adm1', corpo }));
  assert.equal(r.codigo, 403, 'POST de outro site é recusado mesmo com token válido');
});

test('CORS: localhost de desenvolvimento só fora de produção', () => {
  assert.equal(origensPermitidas({ VERCEL_ENV: 'production' }).has('http://localhost:1420'), false);
  assert.equal(origensPermitidas({ VERCEL_ENV: 'preview' }).has('http://localhost:1420'), true);
  assert.equal(origensPermitidas({ VERCEL_ENV: 'production' }).has('tauri://localhost'), true);
});

test('só POST; cabeçalhos de segurança presentes', async () => {
  const { h } = montar();
  const r = await chamar(h, fakeReq({ metodo: 'GET' }));
  assert.equal(r.codigo, 405);
  assert.equal(r.cabecalhos['Cache-Control'], 'no-store');
  assert.equal(r.cabecalhos['X-Content-Type-Options'], 'nosniff');
});

test('Content-Type e tamanho do corpo', async () => {
  const { h } = montar();
  assert.equal((await chamar(h, fakeReq({ tipo: 'text/plain', auth: 'Bearer adm1', corpo }))).codigo, 415);
  assert.equal((await chamar(h, fakeReq({ tamanho: 5000, auth: 'Bearer adm1', corpo }))).codigo, 413);
});

test('validação de entrada: tipos, tamanhos, role e e-mail', async () => {
  const { h } = montar();
  const A = 'Bearer adm1';
  const casos = [
    ['corpo nulo', undefined],
    ['corpo array', []],
    ['nome enorme', { ...corpo, nome: 'x'.repeat(101) }],
    ['e-mail enorme', { ...corpo, email: 'a'.repeat(250) + '@ex.com' }],
    ['e-mail inválido', { ...corpo, email: 'sem-arroba' }],
    ['senha enorme', { ...corpo, senha: 'Aa1!' + 'x'.repeat(200) }],
    ['senha não string', { ...corpo, senha: 12345678 }],
    ['role desconhecido', { ...corpo, role: 'root' }],
    ['role objeto', { ...corpo, role: { $ne: 1 } }],
    ['condomínio com caracteres inválidos', { ...corpo, role: 'gerente', condominioId: '../x' }]
  ];
  for (const [nome, c] of casos) {
    const r = await chamar(h, fakeReq({ auth: A, corpo: c }));
    assert.equal(r.codigo, 400, nome);
  }
});

test('remover: uid inválido', async () => {
  const { h } = montar(removerUsuario);
  for (const uid of ['', '../users', 'a b', 'x'.repeat(129), 123, null]) {
    const r = await chamar(h, fakeReq({ auth: 'Bearer adm1', corpo: { uid } }));
    assert.equal(r.codigo, 400, String(uid));
  }
});

test('erro inesperado vira 500 genérico, sem detalhes', async () => {
  const logica = async () => {
    throw new Error('senha do banco = 123 (segredo)');
  };
  const original = console.error;
  console.error = () => {};
  try {
    const { h } = montar(logica);
    const r = await chamar(h, fakeReq({ auth: 'Bearer adm1', corpo }));
    assert.equal(r.codigo, 500);
    assert.deepEqual(r.corpo, { erro: 'Erro interno.' });
  } finally {
    console.error = original;
  }
});

test('limite de tentativas por IP: 429 depois do máximo, outro IP não é afetado', async () => {
  let agora = 0;
  const limitador = criarLimitador({ max: 3, janelaMs: 60_000, agora: () => agora });
  const { h } = montar(criarUsuario, { limitador });

  for (let i = 0; i < 3; i++) {
    assert.equal((await chamar(h, fakeReq({ ip: '9.9.9.9', auth: 'Bearer lixo', corpo }))).codigo, 401);
  }
  const bloqueado = await chamar(h, fakeReq({ ip: '9.9.9.9', auth: 'Bearer adm1', corpo }));
  assert.equal(bloqueado.codigo, 429);
  assert.equal(bloqueado.cabecalhos['Retry-After'], '60');

  assert.equal((await chamar(h, fakeReq({ ip: '8.8.8.8', auth: 'Bearer adm1', corpo }))).codigo, 200);

  agora = 61_000; // passou a janela
  assert.equal((await chamar(h, fakeReq({ ip: '9.9.9.9', auth: 'Bearer adm1', corpo: { ...corpo, email: 'g@ex.com' } }))).codigo, 200);
});

test('ipDe usa o primeiro IP do x-forwarded-for', () => {
  assert.equal(ipDe({ headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' } }), '203.0.113.5');
  assert.equal(ipDe({ headers: { 'x-real-ip': '198.51.100.1' } }), '198.51.100.1');
});
