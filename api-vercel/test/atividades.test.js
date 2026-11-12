import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACOES, montarAtividade } from '../_lib/atividades.js';

const base = { em: new Date('2030-01-01T12:00:00Z'), atorUid: 'u1', atorPapel: 'admin', alvoId: 'x1' };

test('montarAtividade: só campos permitidos por ação; e-mail, nome, CPF e link são descartados', () => {
  const a = montarAtividade({
    ...base,
    acao: 'usuario_criado',
    depois: { papel: 'cliente', condominioId: 'c1', email: 'a@b.com', nome: 'Maria', cpf: '12345678909', link: 'https://x' }
  });
  assert.deepEqual(a.depois, { papel: 'cliente', condominioId: 'c1' });
  assert.equal(a.alvoTipo, 'usuario');
  assert.equal(a.antes, null);
  assert.equal(JSON.stringify(a).includes('Maria'), false);
});

test('montarAtividade: ação fora da lista, ator ou alvo inválido => null', () => {
  assert.equal(montarAtividade({ ...base, acao: 'qualquer' }), null);
  assert.equal(montarAtividade({ ...base, acao: 'login_admin', atorPapel: 'root' }), null);
  assert.equal(montarAtividade({ ...base, acao: 'login_admin', alvoId: '../x' }), null);
  assert.equal(montarAtividade({ ...base, acao: 'login_admin', atorUid: '' }), null);
});

test('montarAtividade: centavos só inteiros; texto só simples; lista fechada de ações', () => {
  const a = montarAtividade({ ...base, acao: 'preco_alterado', antes: { precoCentavos: 6500.5 }, depois: { precoCentavos: 7000, status: 'x' } });
  assert.equal(a.antes, null);
  assert.deepEqual(a.depois, { precoCentavos: 7000 });
  assert.equal(montarAtividade({ ...base, acao: 'status_agendamento', depois: { status: '<script>' } }).depois, null);
  assert.equal(Object.keys(ACOES).length, 11);
});
