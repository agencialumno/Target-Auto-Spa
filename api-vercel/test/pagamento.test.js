import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarPagamento } from '../_lib/pagamento.js';
import { criarAuth, criarBanco, bearer, status } from './_falso.js';

const CHAVE = '$aact_hmlg_exemplo-falso';
const ENV = { ASAAS_API_KEY: CHAVE, ASAAS_BASE_URL: 'https://api-sandbox.asaas.com/v3', API_PUBLICA_URL: 'https://api.exemplo.com' };
const AGORA = new Date('2030-01-01T12:00:00Z');

const agendamento = (extra = {}) => ({
  clienteId: 'ana',
  status: 'agendado',
  itens: [
    { servicoId: 's1', nome: 'Banho', precoCentavos: 6500 },
    { servicoId: 's2', nome: 'Polimento', precoCentavos: 19999 }
  ],
  total: 26499,
  vagaId: 'c1_2030-01-02_09:00_1',
  ...extra
});

function montar({ ag = agendamento(), extraDocs = {}, resposta } = {}) {
  const db = criarBanco({ 'agendamentos/ag1': ag, ...extraDocs });
  const chamadas = [];
  let n = 0;
  const deps = {
    auth: criarAuth(),
    db,
    env: ENV,
    agora: () => AGORA,
    fetch:
      resposta ??
      (async (url, init) => {
        chamadas.push({ url, init, corpo: JSON.parse(init.body) });
        n++;
        return { ok: true, status: 200, json: async () => ({ id: `chk-${n}`, link: `https://sandbox.asaas.com/000/checkoutSession/show/chk-${n}` }) };
      })
  };
  return { db, deps, chamadas };
}

const pedir = (deps, token = 'tok-ana', id = 'ag1') => criarPagamento(deps, token ? bearer(token) : undefined, { agendamentoId: id });

test('dono cria o Checkout com o valor do DOCUMENTO e grava pagamento pendente', async () => {
  const { db, deps, chamadas } = montar();
  const r = await pedir(deps);
  assert.equal(r.link, 'https://sandbox.asaas.com/000/checkoutSession/show/chk-1');
  assert.equal(r.reutilizado, false);

  const p = chamadas[0].corpo;
  assert.equal(chamadas[0].url, 'https://api-sandbox.asaas.com/v3/checkouts');
  assert.equal(chamadas[0].init.headers.access_token, CHAVE);
  assert.equal(p.externalReference, 'ag1');
  assert.equal(p.minutesToExpire, 15);
  assert.deepEqual(p.billingTypes, ['PIX', 'CREDIT_CARD']);
  assert.deepEqual(p.items.map((i) => i.value), [65, 199.99]);
  assert.deepEqual(p.items.map((i) => i.name), ['Banho', 'Polimento']);
  assert.equal(p.callback.successUrl, 'https://api.exemplo.com/api/retorno/pago');

  const salvo = db.docs.get('agendamentos/ag1').pagamento;
  assert.equal(salvo.status, 'pendente');
  assert.equal(salvo.checkoutId, 'chk-1');
  assert.equal(salvo.venceEm.getTime(), AGORA.getTime() + 15 * 60_000);
});

test('o corpo da requisição não influencia o valor: só o agendamentoId é lido', async () => {
  const { deps, chamadas } = montar();
  await criarPagamento(deps, bearer('tok-ana'), { agendamentoId: 'ag1', total: 1, valor: 0.01, items: [{ value: 1 }] });
  assert.deepEqual(chamadas[0].corpo.items.map((i) => i.value), [65, 199.99]);
});

test('idempotente: com Checkout aberto devolve o mesmo e não chama o Asaas de novo', async () => {
  const { deps, chamadas } = montar();
  const a = await pedir(deps);
  const b = await pedir(deps);
  assert.equal(chamadas.length, 1);
  assert.equal(b.link, a.link);
  assert.equal(b.reutilizado, true);
});

test('Checkout vencido ou perdido: cria outro', async () => {
  const { db, deps, chamadas } = montar();
  await pedir(deps);
  const ag = db.docs.get('agendamentos/ag1');
  db.docs.set('agendamentos/ag1', { ...ag, pagamento: { ...ag.pagamento, venceEm: new Date(AGORA.getTime() - 1000) } });
  const r = await pedir(deps);
  assert.equal(chamadas.length, 2);
  assert.equal(r.link.endsWith('chk-2'), true);
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.checkoutId, 'chk-2');
});

test('só o dono: outro usuário recebe 404 (igual a "não existe"), sem token 401, token ruim 401', async () => {
  const { deps, chamadas } = montar();
  assert.equal(await status(pedir(deps, 'tok-bia')), 404);
  assert.equal(await status(pedir(deps, null)), 401);
  assert.equal(await status(pedir(deps, 'tok-falso')), 401);
  assert.equal(await status(pedir(deps, 'tok-ana', 'naoexiste')), 404);
  assert.equal(chamadas.length, 0);
});

test('só agendamento "agendado": cancelado, em andamento ou finalizado são recusados', async () => {
  for (const st of ['cancelado', 'em_andamento', 'finalizado']) {
    const { deps, chamadas } = montar({ ag: agendamento({ status: st }) });
    assert.equal(await status(pedir(deps)), 409, st);
    assert.equal(chamadas.length, 0);
  }
});

test('já pago (ou pago após cancelamento) não gera nova cobrança', async () => {
  for (const s of ['pago', 'pago_apos_cancelamento']) {
    const { deps, chamadas } = montar({ ag: agendamento({ pagamento: { status: s } }) });
    assert.equal(await status(pedir(deps)), 409, s);
    assert.equal(chamadas.length, 0);
  }
});

test('valores que não conferem (total diferente da soma dos itens, não inteiro, itens ruins) são recusados', async () => {
  for (const extra of [{ total: 100 }, { total: 26499.5 }, { total: 0 }, { total: '26499' }, { itens: [] }, { itens: [{ nome: 'x', precoCentavos: 1.5 }], total: 1.5 }]) {
    const { deps, chamadas } = montar({ ag: agendamento(extra) });
    assert.equal(await status(pedir(deps)), 409, JSON.stringify(extra));
    assert.equal(chamadas.length, 0);
  }
});

test('id de agendamento inválido ou corpo ruim: 400', async () => {
  const { deps } = montar();
  for (const id of ['../x', '', 'a b', 5, null]) {
    assert.equal(await status(criarPagamento(deps, bearer('tok-ana'), { agendamentoId: id })), 400);
  }
  assert.equal(await status(criarPagamento(deps, bearer('tok-ana'), undefined)), 400);
  assert.equal(await status(criarPagamento(deps, bearer('tok-ana'), [])), 400);
});

test('usuário novo: sem customer. Usuário com cliente conhecido: passa customer, nunca customerData', async () => {
  const novo = montar();
  await pedir(novo.deps);
  assert.equal('customer' in novo.chamadas[0].corpo, false);
  assert.equal('customerData' in novo.chamadas[0].corpo, false);

  const conhecido = montar({ extraDocs: { 'clientesAsaas/ana': { asaasCustomerId: 'cus_000005' } } });
  await pedir(conhecido.deps);
  assert.equal(conhecido.chamadas[0].corpo.customer, 'cus_000005');
  assert.equal('customerData' in conhecido.chamadas[0].corpo, false);
});

test('id de cliente guardado com formato estranho é ignorado', async () => {
  const { deps, chamadas } = montar({ extraDocs: { 'clientesAsaas/ana': { asaasCustomerId: '../../x' } } });
  await pedir(deps);
  assert.equal('customer' in chamadas[0].corpo, false);
});

test('falha do Asaas: 502 genérico, nada gravado, chave fora da resposta', async () => {
  const { db, deps } = montar({ resposta: async () => ({ ok: false, status: 400, json: async () => ({ errors: [{ description: 'detalhe interno' }] }) }) });
  const e = await pedir(deps).catch((x) => x);
  assert.equal(e.status, 502);
  assert.equal(e.message.includes(CHAVE), false);
  assert.equal(e.message.includes('detalhe'), false);
  assert.equal(db.docs.get('agendamentos/ag1').pagamento, undefined);
});

test('sem configuração do Asaas: 503, sem chamar a API; chave de produção sem sinalizador: 503', async () => {
  const a = montar();
  a.deps.env = {};
  assert.equal(await status(pedir(a.deps)), 503);
  const b = montar();
  b.deps.env = { ASAAS_API_KEY: '$aact_prod_x', ASAAS_BASE_URL: 'https://api.asaas.com/v3' };
  assert.equal(await status(pedir(b.deps)), 503);
  assert.equal(a.chamadas.length + b.chamadas.length, 0);
});
