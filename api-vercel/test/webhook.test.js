import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processarWebhook, tokenValido, valorDoCheckout } from '../_lib/webhook-asaas.js';
import { endpointWebhook } from '../_lib/http.js';
import { paginaRetorno, TIPOS_RETORNO } from '../_lib/retorno.js';
import { criarBanco } from './_falso.js';

const TOKEN = 'segredo-do-webhook-de-teste';
const AGORA = new Date('2030-01-01T12:00:00Z');
const cab = (t = TOKEN) => ({ 'asaas-access-token': t });

const pendente = (extra = {}) => ({ status: 'pendente', checkoutId: 'chk-1', venceEm: new Date(AGORA.getTime() + 600_000), ...extra });

function montar(ag = {}, extraDocs = {}) {
  const db = criarBanco({
    'agendamentos/ag1': {
      clienteId: 'ana',
      status: 'agendado',
      total: 26499,
      vagaId: 'c1_2030-01-02_09:00_1',
      pagamento: pendente(),
      ...ag
    },
    'ocupacao/c1_2030-01-02_09:00_1': { agendamentoId: 'ag1' },
    ...extraDocs
  });
  return { db, deps: { db, env: { ASAAS_WEBHOOK_TOKEN: TOKEN }, agora: () => AGORA } };
}

const evento = (event, checkout = {}, id = 'evt_1') => ({
  id,
  event,
  dateCreated: '2030-01-01 12:00:00',
  checkout: { id: 'chk-1', status: 'PAID', externalReference: 'ag1', ...checkout }
});

const enviar = (deps, corpo, cabecalhos = cab()) => processarWebhook(deps, cabecalhos, corpo);
const itens = (reais) => reais.map((v) => ({ name: 'x', quantity: 1, value: v }));

test('token: sem a variável recusa tudo; token errado ou ausente é 401', async () => {
  const { deps } = montar();
  assert.equal((await enviar({ ...deps, env: {} }, evento('CHECKOUT_PAID'))).status, 503);
  assert.equal((await enviar({ ...deps, env: { ASAAS_WEBHOOK_TOKEN: '' } }, evento('CHECKOUT_PAID'))).status, 503);
  assert.equal((await enviar(deps, evento('CHECKOUT_PAID'), cab('errado'))).status, 401);
  assert.equal((await enviar(deps, evento('CHECKOUT_PAID'), {})).status, 401);
  assert.equal((await enviar(deps, evento('CHECKOUT_PAID'), cab(TOKEN + 'x'))).status, 401);
  assert.equal(deps.db.docs.get('agendamentos/ag1').pagamento.status, 'pendente');
  assert.equal([...deps.db.docs.keys()].some((k) => k.startsWith('eventosAsaas/')), false);
});

test('tokenValido: comparação segura para tamanhos diferentes e valores vazios', () => {
  assert.equal(tokenValido('abc', 'abc'), true);
  assert.equal(tokenValido('abc', 'abd'), false);
  assert.equal(tokenValido('a', 'abc'), false);
  assert.equal(tokenValido('', ''), false);
  assert.equal(tokenValido(undefined, 'abc'), false);
  assert.equal(tokenValido('abc', undefined), false);
});

test('corpo inválido: 400', async () => {
  const { deps } = montar();
  for (const c of [null, [], 'x', {}, { id: '../x', event: 'CHECKOUT_PAID' }, { id: 'e1' }, { id: 'e1', event: 5 }]) {
    assert.equal((await enviar(deps, c)).status, 400, JSON.stringify(c));
  }
});

test('CHECKOUT_PAID marca o pagamento como pago', async () => {
  const { db, deps } = montar();
  const r = await enviar(deps, evento('CHECKOUT_PAID'));
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado, 'pago');
  const ag = db.docs.get('agendamentos/ag1');
  assert.equal(ag.pagamento.status, 'pago');
  assert.equal(ag.pagamento.pagoEm.getTime(), AGORA.getTime());
  assert.equal(ag.status, 'agendado');
  assert.ok(db.docs.has('ocupacao/c1_2030-01-02_09:00_1'), 'a vaga continua reservada');
});

test('duplicado: o mesmo id de evento não é aplicado duas vezes', async () => {
  const { db, deps } = montar();
  assert.equal((await enviar(deps, evento('CHECKOUT_PAID'))).corpo.resultado, 'pago');
  db.docs.set('agendamentos/ag1', { ...db.docs.get('agendamentos/ag1'), pagamento: pendente() });
  const r = await enviar(deps, evento('CHECKOUT_PAID'));
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado, 'duplicado');
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'pendente', 'o duplicado não reaplicou');
});

test('valor divergente: não marca pago, marca "divergente" para revisão', async () => {
  const { db, deps } = montar();
  const r = await enviar(deps, evento('CHECKOUT_PAID', { items: itens([100, 50]) })); // 15000 != 26499
  assert.equal(r.corpo.resultado, 'valor_divergente');
  const p = db.docs.get('agendamentos/ag1').pagamento;
  assert.equal(p.status, 'divergente');
  assert.equal(p.revisao, true);
  assert.equal(db.docs.get('eventosAsaas/evt_1').revisar, true);
});

test('valor que confere (itens somando o total) é aceito; valorDoCheckout soma em centavos', async () => {
  assert.equal(valorDoCheckout({ items: itens([65, 199.99]) }), 26499);
  assert.equal(valorDoCheckout({ items: [{ value: 10, quantity: 3 }] }), 3000);
  assert.equal(valorDoCheckout({}), null);
  assert.equal(valorDoCheckout({ items: [{ value: 'x' }] }), null);
  const { db, deps } = montar();
  assert.equal((await enviar(deps, evento('CHECKOUT_PAID', { items: itens([65, 199.99]) }))).corpo.resultado, 'pago');
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'pago');
});

test('CHECKOUT_EXPIRED ainda não pago: cancela o agendamento e apaga a vaga', async () => {
  const { db, deps } = montar();
  const r = await enviar(deps, evento('CHECKOUT_EXPIRED', { status: 'EXPIRED' }));
  assert.equal(r.corpo.resultado, 'agendamento_cancelado');
  const ag = db.docs.get('agendamentos/ag1');
  assert.equal(ag.status, 'cancelado');
  assert.equal(ag.pagamento.status, 'expirado');
  assert.equal(db.docs.has('ocupacao/c1_2030-01-02_09:00_1'), false, 'vaga liberada');
});

test('CHECKOUT_CANCELED ainda não pago: cancela e libera a vaga', async () => {
  const { db, deps } = montar();
  await enviar(deps, evento('CHECKOUT_CANCELED', { status: 'CANCELED' }));
  const ag = db.docs.get('agendamentos/ag1');
  assert.equal(ag.status, 'cancelado');
  assert.equal(ag.pagamento.status, 'cancelado');
  assert.equal(db.docs.has('ocupacao/c1_2030-01-02_09:00_1'), false);
});

test('expirado/cancelado DEPOIS de pago: ignorado (nada muda)', async () => {
  for (const tipo of ['CHECKOUT_EXPIRED', 'CHECKOUT_CANCELED']) {
    const { db, deps } = montar({ pagamento: { status: 'pago', checkoutId: 'chk-1' } });
    const r = await enviar(deps, evento(tipo));
    assert.equal(r.corpo.resultado, 'ignorado_pago');
    assert.equal(db.docs.get('agendamentos/ag1').status, 'agendado');
    assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'pago');
    assert.ok(db.docs.has('ocupacao/c1_2030-01-02_09:00_1'));
  }
});

test('pago DEPOIS de cancelado: grava pago_apos_cancelamento, sinaliza o admin, não reabre nem estorna', async () => {
  const { db, deps } = montar({ status: 'cancelado', pagamento: pendente({ status: 'expirado' }) });
  const r = await enviar(deps, evento('CHECKOUT_PAID'));
  assert.equal(r.corpo.resultado, 'pago_apos_cancelamento');
  const ag = db.docs.get('agendamentos/ag1');
  assert.equal(ag.pagamento.status, 'pago_apos_cancelamento');
  assert.equal(ag.pagamento.revisao, true);
  assert.equal(ag.status, 'cancelado', 'o agendamento não é reaberto');
  assert.equal(db.docs.get('eventosAsaas/evt_1').revisar, true);
});

test('evento de um Checkout antigo (já trocado por outro) não cancela o agendamento', async () => {
  const { db, deps } = montar({ pagamento: pendente({ checkoutId: 'chk-2' }) });
  const r = await enviar(deps, evento('CHECKOUT_EXPIRED', { id: 'chk-1' }));
  assert.equal(r.corpo.resultado, 'ignorado_checkout_antigo');
  assert.equal(db.docs.get('agendamentos/ag1').status, 'agendado');
});

test('pago em um Checkout antigo ainda vale (o dinheiro entrou)', async () => {
  const { db, deps } = montar({ pagamento: pendente({ checkoutId: 'chk-2' }) });
  assert.equal((await enviar(deps, evento('CHECKOUT_PAID', { id: 'chk-1' }))).corpo.resultado, 'pago');
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.checkoutId, 'chk-1');
});

test('agendamento já cancelado + expirado: só atualiza o status do pagamento', async () => {
  const { db, deps } = montar({ status: 'cancelado' });
  await enviar(deps, evento('CHECKOUT_EXPIRED'));
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'expirado');
});

test('agendamento em andamento não é cancelado por checkout expirado', async () => {
  const { db, deps } = montar({ status: 'em_andamento' });
  const r = await enviar(deps, evento('CHECKOUT_EXPIRED'));
  assert.equal(r.corpo.resultado, 'status_atualizado');
  assert.equal(db.docs.get('agendamentos/ag1').status, 'em_andamento');
  assert.ok(db.docs.has('ocupacao/c1_2030-01-02_09:00_1'));
});

test('sem agendamento: guarda o evento para revisão e responde 200', async () => {
  const { db, deps } = montar();
  const r = await enviar(deps, evento('CHECKOUT_PAID', { externalReference: 'naoexiste', id: 'chk-zzz' }));
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado, 'sem_agendamento');
  const ev = db.docs.get('eventosAsaas/evt_1');
  assert.equal(ev.revisar, true);
  assert.equal(ev.referencia, 'naoexiste');
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'pendente');
});

test('sem externalReference: acha o agendamento pelo id do Checkout', async () => {
  const { db, deps } = montar();
  const r = await enviar(deps, { id: 'evt_9', event: 'CHECKOUT_PAID', checkout: { id: 'chk-1' } });
  assert.equal(r.corpo.resultado, 'pago');
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'pago');
});

test('eventos que não são do Checkout (ex.: PAYMENT_RECEIVED) são só registrados', async () => {
  const { db, deps } = montar();
  const r = await enviar(deps, { id: 'evt_p', event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1', value: 10 } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado, 'ignorado');
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'pendente');
  assert.equal((await enviar(deps, { id: 'evt_p', event: 'PAYMENT_RECEIVED' })).corpo.resultado, 'duplicado');
});

test('CHECKOUT_PAID com checkout.customer (id) grava asaasCustomerId só no servidor, em clientesAsaas', async () => {
  const { db, deps } = montar();
  const r = await enviar(deps, evento('CHECKOUT_PAID', { customer: 'cus_000005' }));
  assert.equal(r.corpo.resultado, 'pago');
  assert.equal(db.docs.get('clientesAsaas/ana').asaasCustomerId, 'cus_000005');
  assert.equal(db.docs.get('eventosAsaas/evt_1').customerRecebido, true);
});

test('checkout.customer como objeto: só o id é aproveitado', async () => {
  const { db, deps } = montar();
  await enviar(deps, evento('CHECKOUT_PAID', { customer: { id: 'cus_000007', name: 'Fulano', cpfCnpj: '12345678909', email: 'f@ex.com' } }));
  assert.deepEqual(Object.keys(db.docs.get('clientesAsaas/ana')).sort(), ['asaasCustomerId', 'atualizadoEm']);
  assert.equal(db.docs.get('clientesAsaas/ana').asaasCustomerId, 'cus_000007');
});

test('payload sem id de cliente: não inventa nada e registra customerRecebido=false', async () => {
  const { db, deps } = montar();
  await enviar(deps, evento('CHECKOUT_PAID'));
  assert.equal(db.docs.has('clientesAsaas/ana'), false);
  assert.equal(db.docs.get('eventosAsaas/evt_1').customerRecebido, false);
});

test('id de cliente com formato estranho é ignorado', async () => {
  const { db, deps } = montar();
  await enviar(deps, evento('CHECKOUT_PAID', { customer: '../../x' }));
  assert.equal(db.docs.has('clientesAsaas/ana'), false);
});

test('nenhum dado pessoal do payload é gravado (CPF, e-mail, nome, celular, endereço)', async () => {
  const { db, deps } = montar();
  await enviar(deps, evento('CHECKOUT_PAID', {
    customer: { id: 'cus_000005', name: 'Maria Silva', cpfCnpj: '12345678909', email: 'maria@exemplo.com', mobilePhone: '11999998888', address: 'Rua das Flores 10' }
  }));
  await enviar(deps, evento('CHECKOUT_PAID', { externalReference: 'naoexiste', customer: { name: 'Maria Silva', cpfCnpj: '12345678909', email: 'maria@exemplo.com' } }, 'evt_2'));
  const tudo = JSON.stringify([...db.docs.entries()]);
  for (const pii of ['12345678909', 'maria@exemplo.com', 'Maria Silva', '11999998888', 'Rua das Flores']) {
    assert.equal(tudo.includes(pii), false, `não deve guardar "${pii}"`);
  }
});

test('o handler nunca registra o corpo do evento em log', async () => {
  const logs = [];
  const original = console.error;
  console.error = (...a) => logs.push(a.join(' '));
  try {
    const res = fakeRes();
    const h = endpointWebhook({
      obterDeps: () => ({}),
      env: { ASAAS_WEBHOOK_TOKEN: TOKEN },
      processar: async () => {
        throw Object.assign(new Error('cpf 12345678909 maria@exemplo.com'), { name: 'ErroDeTeste' });
      }
    });
    await h(fakeReq({ id: 'e', event: 'CHECKOUT_PAID', checkout: { customer: { cpfCnpj: '12345678909' } } }, { 'asaas-access-token': TOKEN }), res);
    assert.equal(res.codigo, 500);
    assert.equal(logs.join('\n').includes('12345678909'), false);
    assert.equal(logs.join('\n').includes('maria@'), false);
    assert.deepEqual(res.corpo, { erro: 'Erro interno.' });
  } finally {
    console.error = original;
  }
});

function fakeRes() {
  const r = { codigo: 0, cabecalhos: {}, corpo: undefined };
  r.setHeader = (k, v) => void (r.cabecalhos[k] = v);
  r.status = (c) => ((r.codigo = c), r);
  r.json = (c) => ((r.corpo = c), r);
  r.end = () => r;
  return r;
}
const fakeReq = (corpo, extra = {}) => ({ method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9', ...extra }, body: corpo });

test('handler: só POST com JSON; resposta traz o resultado', async () => {
  const { deps } = montar();
  const h = endpointWebhook({ obterDeps: () => ({ db: deps.db }), env: deps.env });
  let res = fakeRes();
  await h({ method: 'GET', headers: {} }, res);
  assert.equal(res.codigo, 405);
  res = fakeRes();
  await h(fakeReq(evento('CHECKOUT_PAID'), { 'content-type': 'text/plain' }), res);
  assert.equal(res.codigo, 415);
  res = fakeRes();
  await h(fakeReq(evento('CHECKOUT_PAID'), { 'asaas-access-token': 'errado' }), res);
  assert.equal(res.codigo, 401);
  res = fakeRes();
  await h(fakeReq(evento('CHECKOUT_PAID'), { 'asaas-access-token': TOKEN }), res);
  assert.equal(res.codigo, 200);
  assert.equal(res.corpo.resultado, 'pago');
});

test('páginas de retorno: pago, cancelado e expirado; informativas, sem script e sem dados', () => {
  assert.deepEqual(TIPOS_RETORNO.sort(), ['cancelado', 'expirado', 'pago']);
  for (const t of TIPOS_RETORNO) {
    const html = paginaRetorno(t);
    assert.match(html, /<html lang="pt-BR">/);
    assert.equal(/<script|http:\/\/|src=|href=/i.test(html), false, 'sem script nem recursos externos');
  }
  assert.match(paginaRetorno('expirado'), /15 minutos/);
  assert.equal(paginaRetorno('qualquer'), null);
  assert.equal(paginaRetorno('__proto__'), null);
});

test('sem credencial, os endpoints respondem 401/503 sem iniciar o Firebase Admin (config quebrada não vira 500)', async () => {
  const quebrado = () => {
    throw new SyntaxError('credencial do Admin SDK inválida');
  };
  // Webhook: sem token configurado 503; token errado 401; nenhum chama obterDeps
  const w = endpointWebhook({ obterDeps: quebrado, env: { ASAAS_WEBHOOK_TOKEN: TOKEN } });
  let res = fakeRes();
  await w(fakeReq({ id: 'e', event: 'CHECKOUT_PAID' }, { 'asaas-access-token': 'errado' }), res);
  assert.equal(res.codigo, 401);
  res = fakeRes();
  await w(fakeReq({ id: 'e', event: 'CHECKOUT_PAID' }), res);
  assert.equal(res.codigo, 401);
  res = fakeRes();
  await endpointWebhook({ obterDeps: quebrado, env: {} })(fakeReq({ id: 'e', event: 'CHECKOUT_PAID' }), res);
  assert.equal(res.codigo, 503);

  // Endpoints autenticados: sem "Authorization: Bearer" 401, sem chamar obterDeps
  const { endpoint } = await import('../_lib/http.js');
  const h = endpoint(async () => ({ ok: true }), { obterDeps: quebrado, env: {} });
  for (const auth of [undefined, '', 'Basic abc', 'Bearer']) {
    res = fakeRes();
    await h({ method: 'POST', headers: { 'content-type': 'application/json', ...(auth === undefined ? {} : { authorization: auth }), 'x-forwarded-for': '7.7.7.7' }, body: {} }, res);
    assert.equal(res.codigo, 401, String(auth));
    assert.equal(typeof res.corpo.erro, 'string');
  }
});
