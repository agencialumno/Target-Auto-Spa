import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarUsuario, removerUsuario, ErroHttp } from '../_lib/usuarios.js';

const SENHA = 'Abcdef1!x';

// Firestore e Auth falsos, em memória
function criarDeps({ papeis = {}, falhaGravar = false, tokenInvalido = false } = {}) {
  const docs = new Map(Object.entries(papeis).map(([uid, role]) => [`users/${uid}`, { role }]));
  const contas = new Map(); // uid -> email
  let seq = 0;
  const log = { deleteUser: [] };

  const auth = {
    async verifyIdToken(token) {
      if (tokenInvalido) throw new Error('token ruim');
      return { uid: token };
    },
    async createUser({ email }) {
      if ([...contas.values()].includes(email)) {
        const e = new Error('dup');
        e.code = 'auth/email-already-exists';
        throw e;
      }
      const uid = `novo${++seq}`;
      contas.set(uid, email);
      return { uid };
    },
    async deleteUser(uid) {
      log.deleteUser.push(uid);
      if (!contas.has(uid) && !docs.has(`users/${uid}`)) {
        const e = new Error('nf');
        e.code = 'auth/user-not-found';
        throw e;
      }
      contas.delete(uid);
    }
  };

  const db = {
    doc(caminho) {
      return {
        async get() {
          return { exists: docs.has(caminho), data: () => docs.get(caminho) };
        },
        async set(v) {
          if (falhaGravar) throw new Error('falha');
          docs.set(caminho, v);
        },
        async delete() {
          docs.delete(caminho);
        }
      };
    },
    collection() {
      return {
        where: () => ({
          count: () => ({
            async get() {
              const n = [...docs.values()].filter((d) => d.role === 'admin').length;
              return { data: () => ({ count: n }) };
            }
          })
        })
      };
    }
  };
  return { auth, db, docs, contas, log };
}

const bearer = (uid) => `Bearer ${uid}`;
const corpoValido = { nome: 'Fulano', email: 'Fulano@Ex.com', senha: SENHA, role: 'gerente', condominioId: 'c1' };

async function status(promessa) {
  try {
    await promessa;
    return 200;
  } catch (e) {
    assert.ok(e instanceof ErroHttp, `erro inesperado: ${e?.message}`);
    return e.status;
  }
}

test('criar: sem header, token inválido, não-admin e admin inexistente são recusados', async () => {
  const d = criarDeps({ papeis: { a1: 'admin', c1: 'cliente' } });
  assert.equal(await status(criarUsuario(d, undefined, corpoValido)), 401);
  assert.equal(await status(criarUsuario(criarDeps({ tokenInvalido: true }), bearer('a1'), corpoValido)), 401);
  assert.equal(await status(criarUsuario(d, bearer('c1'), corpoValido)), 403);
  assert.equal(await status(criarUsuario(d, bearer('fantasma'), corpoValido)), 403);
  assert.equal(d.contas.size, 0);
});

test('criar: admin cria conta e perfil; e-mail em minúsculas; condominio só para cliente/gerente', async () => {
  const d = criarDeps({ papeis: { a1: 'admin' } });
  const { uid } = await criarUsuario(d, bearer('a1'), corpoValido);
  assert.deepEqual(d.docs.get(`users/${uid}`), {
    nome: 'Fulano',
    email: 'fulano@ex.com',
    role: 'gerente',
    condominioId: 'c1'
  });
  const { uid: u2 } = await criarUsuario(d, bearer('a1'), { ...corpoValido, email: 'b@ex.com', role: 'insulfilm' });
  assert.equal(d.docs.get(`users/${u2}`).condominioId, null);
});

test('criar: valida campos, senha fraca e e-mail repetido', async () => {
  const d = criarDeps({ papeis: { a1: 'admin' } });
  const A = bearer('a1');
  assert.equal(await status(criarUsuario(d, A, { ...corpoValido, nome: ' ' })), 400);
  assert.equal(await status(criarUsuario(d, A, { ...corpoValido, email: 'x' })), 400);
  assert.equal(await status(criarUsuario(d, A, { ...corpoValido, role: 'root' })), 400);
  assert.equal(await status(criarUsuario(d, A, { ...corpoValido, senha: 'fraca' })), 400);
  await criarUsuario(d, A, corpoValido);
  assert.equal(await status(criarUsuario(d, A, corpoValido)), 409);
});

test('criar: se gravar o perfil falhar, a conta é desfeita', async () => {
  const d = criarDeps({ papeis: { a1: 'admin' }, falhaGravar: true });
  assert.equal(await status(criarUsuario(d, bearer('a1'), corpoValido)), 500);
  assert.equal(d.contas.size, 0);
  assert.equal(d.log.deleteUser.length, 1);
});

test('remover: só admin; não remove a si mesmo', async () => {
  const d = criarDeps({ papeis: { a1: 'admin', c1: 'cliente' } });
  d.contas.set('c1', 'c@ex.com');
  assert.equal(await status(removerUsuario(d, bearer('c1'), { uid: 'a1' })), 403);
  assert.equal(await status(removerUsuario(d, bearer('a1'), { uid: 'a1' })), 400);
  assert.equal(await status(removerUsuario(d, bearer('a1'), {})), 400);

  await removerUsuario(d, bearer('a1'), { uid: 'c1' });
  assert.equal(d.docs.has('users/c1'), false);
  assert.equal(d.contas.has('c1'), false);
});

test('remover: com 2 admins remove um; com 1 admin (contagem) recusa remover admin', async () => {
  const d = criarDeps({ papeis: { a1: 'admin', a2: 'admin' } });
  await removerUsuario(d, bearer('a1'), { uid: 'a2' });
  assert.equal(d.docs.has('users/a2'), false);

  const ultimo = criarDeps({ papeis: { a1: 'admin', a5: 'admin' } });
  ultimo.db.collection = () => ({
    where: () => ({ count: () => ({ get: async () => ({ data: () => ({ count: 1 }) }) }) })
  });
  assert.equal(await status(removerUsuario(ultimo, bearer('a1'), { uid: 'a5' })), 400);
  assert.equal(ultimo.docs.has('users/a5'), true);
});

test('remover: conta já inexistente no Authentication ainda limpa o perfil', async () => {
  const d = criarDeps({ papeis: { a1: 'admin', c9: 'cliente' } });
  await removerUsuario(d, bearer('a1'), { uid: 'c9' }); // c9 não está em `contas`; user-not-found é ignorado
  assert.equal(d.docs.has('users/c9'), false);
});
