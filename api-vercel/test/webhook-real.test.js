// Payloads no formato documentado do Asaas (id do evento com "&", checkout com items/customer) e a rota
// /api/pagamento/status (rede de segurança quando o webhook falha).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processarWebhook } from '../_lib/webhook-asaas.js';
import { endpointWebhook, linhaLogWebhook } from '../_lib/http.js';
import { consultarStatus } from '../_lib/pagamento.js';
import { criarAuth, criarBanco, bearer, status } from './_falso.js';

const TOKEN = 'segredo-do-webhook-de-teste';
const AGORA = new Date('2030-01-01T12:00:00Z');
const cab = (t = TOKEN) => ({ 'asaas-access-token': t });

function montar(ag = {}) {
  const db = criarBanco({
    'agendamentos/ag1': {
      clienteId: 'ana',
      status: 'agendado',
      total: 26499,
      vagaId: 'c1_2030-01-02_09:00_1',
      pagamento: { status: 'pendente', checkoutId: 'chk-1', venceEm: new Date(AGORA.getTime() + 600_000) },
      ...ag
    },
    'ocupacao/c1_2030-01-02_09:00_1': { agendamentoId: 'ag1' }
  });
  return { db, deps: { db, env: { ASAAS_WEBHOOK_TOKEN: TOKEN }, agora: () => AGORA } };
}

// Formato do doc "Events for Checkout": id com "&", account, checkout com items e customer
const checkoutPago = (extra = {}, id = 'evt_37260be8159d4472b4458d3de13efc2d&15370') => ({
  id,
  event: 'CHECKOUT_PAID',
  dateCreated: '2030-01-01 12:00:00',
  account: { id: 'acc-1', ownerId: 'own-1' },
  checkout: {
    id: 'chk-1',
    link: 'https://sandbox.asaas.com/checkoutSession/show/chk-1',
    status: 'PAID',
    minutesToExpire: 15,
    billingTypes: ['PIX', 'CREDIT_CARD'],
    chargeTypes: ['DETACHED'],
    externalReference: 'ag1',
    items: [{ name: 'Banho', description: 'Banho', quantity: 1, value: 264.99 }],
    customer: 'cus_000123456789',
    ...extra
  }
});

test('id real do Asaas (com "&") é aceito: antes virava 400 e pausava a fila', async () => {
  const { db, deps } = montar();
  const r = await processarWebhook(deps, cab(), checkoutPago());
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado, 'pago');
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'pago');
  assert.ok(db.docs.has('eventosAsaas/evt_37260be8159d4472b4458d3de13efc2d&15370'));
});

test('pago por cartão e por Pix: o mesmo CHECKOUT_PAID, sem diferença de tratamento', async () => {
  for (const tipo of [['CREDIT_CARD'], ['PIX']]) {
    const { db, deps } = montar();
    const r = await processarWebhook(deps, cab(), checkoutPago({ billingTypes: tipo }, `evt_${tipo[0]}&1`));
    assert.equal(r.corpo.resultado, 'pago', tipo[0]);
    assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'pago');
  }
});

test('PAYMENT_RECEIVED (cobrança) responde 200 e só registra; o pago vem do CHECKOUT_PAID ou da consulta', async () => {
  const { db, deps } = montar();
  const r = await processarWebhook(deps, cab(), {
    id: 'evt_05b708f961d739ea7eba7e4db318f621&368604920',
    event: 'PAYMENT_RECEIVED',
    dateCreated: '2030-01-01 12:00:00',
    payment: { id: 'pay_1', value: 264.99, externalReference: null, billingType: 'PIX', status: 'RECEIVED' }
  });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado, 'ignorado');
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'pendente');
});

test('evento repetido (entrega "at least once"): segundo é duplicado e nada muda', async () => {
  const { db, deps } = montar();
  await processarWebhook(deps, cab(), checkoutPago());
  const antes = JSON.stringify(db.docs.get('agendamentos/ag1'));
  const r = await processarWebhook(deps, cab(), checkoutPago());
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado, 'duplicado');
  assert.equal(JSON.stringify(db.docs.get('agendamentos/ag1')), antes);
});

test('fora de ordem: EXPIRED chegando depois do PAID não desfaz o pagamento; PAID de novo com outro id é ja_pago', async () => {
  const { db, deps } = montar();
  await processarWebhook(deps, cab(), checkoutPago());
  const exp = await processarWebhook(deps, cab(), { ...checkoutPago({ status: 'EXPIRED' }, 'evt_exp&2'), event: 'CHECKOUT_EXPIRED' });
  assert.equal(exp.corpo.resultado, 'ignorado_pago');
  const outro = await processarWebhook(deps, cab(), checkoutPago({}, 'evt_outro&3'));
  assert.equal(outro.corpo.resultado, 'ja_pago');
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'pago');
  assert.equal(db.docs.get('agendamentos/ag1').status, 'agendado');
});

test('fora de ordem: CHECKOUT_CREATED (id com "&") responde 200', async () => {
  const { deps } = montar();
  const r = await processarWebhook(deps, cab(), { ...checkoutPago({ status: 'ACTIVE' }, 'evt_c&1'), event: 'CHECKOUT_CREATED' });
  assert.equal(r.status, 200);
});

test('token errado: 401 e nada gravado', async () => {
  const { db, deps } = montar();
  const r = await processarWebhook(deps, cab('errado'), checkoutPago());
  assert.equal(r.status, 401);
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'pendente');
});

test('agendamento inexistente: 200 com revisão (nunca 4xx/5xx, para o Asaas não pausar a fila)', async () => {
  const { db, deps } = montar();
  const r = await processarWebhook(deps, cab(), checkoutPago({ id: 'chk-x', externalReference: 'naoExiste' }));
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado, 'sem_agendamento');
  assert.equal(db.docs.get('eventosAsaas/evt_37260be8159d4472b4458d3de13efc2d&15370').revisar, true);
});

test('log: uma linha por requisição, com id, tipo, resultado e HTTP; sem token, CPF ou pagador', async () => {
  const { deps } = montar();
  const linhas = [];
  const h = endpointWebhook({ obterDeps: () => ({ db: deps.db }), env: deps.env, log: (l) => linhas.push(l) });
  const res = { setHeader() {}, status(c) { this.codigo = c; return this; }, json() { return this; } };
  const corpo = checkoutPago({ customerData: { name: 'Maria', cpfCnpj: '12345678909', email: 'maria@exemplo.com' } });
  await h({ method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': TOKEN }, body: corpo }, res);
  await h({ method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': 'errado' }, body: corpo }, res);
  assert.equal(linhas.length, 2);
  assert.equal(linhas[0], 'webhook evento=evt_37260be8159d4472b4458d3de13efc2d&15370 tipo=CHECKOUT_PAID resultado=pago http=200');
  assert.match(linhas[1], /resultado=token_invalido http=401$/);
  const tudo = linhas.join('\n');
  for (const proibido of [TOKEN, 'errado', '12345678909', 'maria', 'Maria', 'cus_']) assert.equal(tudo.includes(proibido), false, proibido);
  assert.equal(linhaLogWebhook({ id: 'x\ny', event: 'a b' }, 400, 'x'), 'webhook evento=- tipo=- resultado=x http=400');
});

// ---------- /api/pagamento/status ----------
const ENV = { ASAAS_API_KEY: '$aact_hmlg_exemplo-falso', ASAAS_BASE_URL: 'https://api-sandbox.asaas.com/v3' };
const itens = [{ servicoId: 's1', nome: 'Banho', precoCentavos: 26499 }];

function montarStatus(pagamentos, ag = {}) {
  const base = montar({ itens, ...ag });
  const chamadas = [];
  const deps = {
    ...base.deps,
    auth: criarAuth(),
    env: ENV,
    fetch: async (url, init) => {
      chamadas.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ data: pagamentos }) };
    }
  };
  return { db: base.db, deps, chamadas };
}
const consultar = (deps, token = 'tok-ana') => consultarStatus(deps, bearer(token), { agendamentoId: 'ag1' });

test('status: pago no Asaas e pendente no app => grava pago; consulta por checkoutSession', async () => {
  const { db, deps, chamadas } = montarStatus([{ status: 'RECEIVED', value: 264.99, customer: 'cus_000123' }]);
  const r = await consultar(deps);
  assert.deepEqual(r, { status: 'pago', atualizado: true });
  assert.match(chamadas[0].url, /\/payments\?checkoutSession=chk-1/);
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'pago');
  assert.equal(db.docs.get('clientesAsaas/ana').asaasCustomerId, 'cus_000123');
});

test('status: idempotente (segunda chamada e depois do webhook não alteram nada e nem consultam o Asaas)', async () => {
  const { db, deps, chamadas } = montarStatus([{ status: 'CONFIRMED', value: 264.99 }]);
  await consultar(deps);
  const antes = JSON.stringify(db.docs.get('agendamentos/ag1'));
  const r = await consultar(deps);
  assert.deepEqual(r, { status: 'pago', atualizado: false });
  assert.equal(chamadas.length, 1);
  assert.equal(JSON.stringify(db.docs.get('agendamentos/ag1')), antes);
});

test('status: ainda não pago no Asaas => continua pendente', async () => {
  const { db, deps } = montarStatus([{ status: 'PENDING', value: 264.99 }]);
  assert.deepEqual(await consultar(deps), { status: 'pendente', atualizado: false });
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'pendente');
});

test('status: valor divergente não vira pago', async () => {
  const { db, deps } = montarStatus([{ status: 'RECEIVED', value: 1 }]);
  const r = await consultar(deps);
  assert.equal(r.status, 'divergente');
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.revisao, true);
});

test('status: só o dono (outro usuário e anônimo recebem 404/401) e id inválido é 400', async () => {
  const { deps } = montarStatus([{ status: 'RECEIVED', value: 264.99 }]);
  assert.equal(await status(consultar(deps, 'tok-bia')), 404);
  assert.equal(await status(consultar(deps, 'invalido')), 401);
  assert.equal(await status(consultarStatus(deps, bearer('tok-ana'), { agendamentoId: '../x' })), 400);
  assert.equal(await status(consultarStatus(deps, bearer('tok-ana'), { agendamentoId: 'naoExiste' })), 404);
});

test('status: erro do Asaas vira 502 sem vazar detalhes', async () => {
  const { deps } = montarStatus([]);
  deps.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  assert.equal(await status(consultar(deps)), 502);
});

test('contrato: autenticado => 200 em corpo ilegível (JSON quebrado), tipo desconhecido, repetido e id estranho; 5xx só se a gravação falhar', async () => {
  const { deps } = montar();
  const linhas = [];
  const h = endpointWebhook({ obterDeps: () => ({ db: deps.db }), env: deps.env, log: (l) => linhas.push(l) });
  const novoRes = () => ({ setHeader() {}, status(c) { this.codigo = c; return this; }, json(b) { this.corpo = b; return this; } });
  const cabs = { 'content-type': 'application/json', 'asaas-access-token': TOKEN };
  const quebrado = { method: 'POST', headers: cabs, get body() { throw new SyntaxError('Invalid JSON'); } };
  for (const req of [
    quebrado,
    { method: 'POST', headers: cabs, body: { id: 'evt_1&2', event: 'ALGO_NOVO_DO_ASAAS' } },
    { method: 'POST', headers: cabs, body: { id: 'a/b', event: 'CHECKOUT_PAID' } },
    { method: 'POST', headers: cabs, body: 'texto' }
  ]) {
    const res = novoRes();
    await h(req, res);
    assert.equal(res.codigo, 200, JSON.stringify(res.corpo));
  }
  const falha = endpointWebhook({ obterDeps: () => ({}), env: deps.env, log() {}, processar: async () => { throw new Error('firestore indisponível'); } });
  const res = novoRes();
  await falha({ method: 'POST', headers: cabs, body: checkoutPago() }, res);
  assert.equal(res.codigo, 500);
  assert.equal(linhas.length, 4);
});

test('expirar/cancelar nunca desfaz pagamento confirmado nem valor divergente (dinheiro recebido)', async () => {
  for (const st of ['pago', 'pago_apos_cancelamento', 'divergente']) {
    const { db, deps } = montar({ pagamento: { status: st, checkoutId: 'chk-1' } });
    for (const ev of ['CHECKOUT_EXPIRED', 'CHECKOUT_CANCELED']) {
      const r = await processarWebhook(deps, cab(), { ...checkoutPago({}, `evt_${st}${ev}&1`), event: ev });
      assert.equal(r.status, 200);
      assert.equal(db.docs.get('agendamentos/ag1').status, 'agendado', st);
      assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, st);
    }
  }
});

// ---------- log de atividades nos pagamentos ----------
const atvs = (db) => [...db.docs.entries()].filter(([k]) => k.startsWith('atividades/')).map(([, v]) => v);

test('atividades: CHECKOUT_PAID grava pagamento_confirmado no mesmo commit; repetido não duplica', async () => {
  const { db, deps } = montar();
  await processarWebhook(deps, cab(), checkoutPago());
  await processarWebhook(deps, cab(), checkoutPago());
  const log = atvs(db);
  assert.equal(log.length, 1);
  assert.equal(log[0].acao, 'pagamento_confirmado');
  assert.equal(log[0].atorPapel, 'sistema:asaas');
  assert.equal(log[0].alvoId, 'ag1');
  assert.deepEqual(log[0].antes, { status: 'pendente' });
  assert.deepEqual(log[0].depois, { status: 'pago', valorCentavos: 26499 });
  assert.equal(log[0].origem, 'webhook');
});

test('atividades: divergente, expirado e cancelado; evento ignorado não gera log', async () => {
  let { db, deps } = montar();
  await processarWebhook(deps, cab(), checkoutPago({ items: [{ name: 'x', quantity: 1, value: 1 }] }));
  assert.equal(atvs(db)[0].acao, 'pagamento_divergente');
  ({ db, deps } = montar());
  await processarWebhook(deps, cab(), { ...checkoutPago({}, 'evt_e&1'), event: 'CHECKOUT_EXPIRED' });
  assert.equal(atvs(db)[0].acao, 'pagamento_expirado');
  ({ db, deps } = montar({ pagamento: { status: 'pago', checkoutId: 'chk-1' } }));
  await processarWebhook(deps, cab(), { ...checkoutPago({}, 'evt_e&2'), event: 'CHECKOUT_EXPIRED' });
  await processarWebhook(deps, cab(), { id: 'evt_p&1', event: 'PAYMENT_RECEIVED', payment: {} });
  assert.equal(atvs(db).length, 0);
});

test('atividades: consulta de status grava o log com o cliente como autor', async () => {
  const { db, deps } = montarStatus([{ status: 'RECEIVED', value: 264.99 }]);
  await consultar(deps);
  await consultar(deps);
  const log = atvs(db);
  assert.equal(log.length, 1);
  assert.deepEqual([log[0].acao, log[0].atorUid, log[0].atorPapel, log[0].origem], ['pagamento_confirmado', 'ana', 'cliente', 'consulta']);
});
