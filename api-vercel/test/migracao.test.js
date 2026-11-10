import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrarInsulfilm } from '../_lib/migracao.js';

function criarDb() {
  const docs = new Map([
    ['users/i1', { nome: 'Ivo', email: 'ivo@ex.com', role: 'insulfilm', condominioId: null }],
    ['users/i2', { nome: 'Ina', email: 'ina@ex.com', role: 'insulfilm', condominioId: 'c1' }],
    ['users/c1', { nome: 'Ana', email: 'ana@ex.com', role: 'cliente', condominioId: 'c1' }],
    ['users/g1', { nome: 'Gui', email: 'gui@ex.com', role: 'gerente', condominioId: 'c1' }]
  ]);
  return {
    docs,
    collection: () => ({
      where: (campo, _op, valor) => ({
        async get() {
          return {
            docs: [...docs.entries()]
              .filter(([, d]) => d[campo] === valor)
              .map(([caminho, d]) => ({ id: caminho.split('/')[1], data: () => d }))
          };
        }
      })
    }),
    doc: (caminho) => ({
      async update(v) {
        docs.set(caminho, { ...docs.get(caminho), ...v });
      }
    })
  };
}

test('migração: dry-run só lista e não grava nada', async () => {
  const db = criarDb();
  const r = await migrarInsulfilm(db);
  assert.equal(r.aplicado, false);
  assert.deepEqual(r.afetados.map((a) => a.uid), ['i1', 'i2']);
  assert.equal(db.docs.get('users/i1').role, 'insulfilm');
});

test('migração: com aplicar, vira funcionário com especialidade e sem condomínio; os outros ficam como estão', async () => {
  const db = criarDb();
  await migrarInsulfilm(db, { aplicar: true });
  for (const uid of ['i1', 'i2']) {
    assert.deepEqual(
      { role: db.docs.get(`users/${uid}`).role, e: db.docs.get(`users/${uid}`).especialidade, c: db.docs.get(`users/${uid}`).condominioId },
      { role: 'funcionario', e: 'insulfilm', c: null }
    );
  }
  assert.equal(db.docs.get('users/c1').role, 'cliente');
  assert.equal(db.docs.get('users/g1').especialidade, undefined);
});

test('migração: rodar de novo não acha mais nada (idempotente)', async () => {
  const db = criarDb();
  await migrarInsulfilm(db, { aplicar: true });
  const r = await migrarInsulfilm(db, { aplicar: true });
  assert.equal(r.afetados.length, 0);
});
