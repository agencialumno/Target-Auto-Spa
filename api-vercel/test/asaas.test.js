import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centavosParaReais, configAsaas, criarCheckoutAsaas, montarCheckout } from '../_lib/asaas.js';
import { ErroHttp } from '../_lib/usuarios.js';

const CHAVE_SANDBOX = '$aact_hmlg_exemplo-falso';
const CHAVE_PROD = '$aact_prod_exemplo-falso';
const SANDBOX = 'https://api-sandbox.asaas.com/v3';
const PRODUCAO = 'https://api.asaas.com/v3';

const codigo = (fn) => {
  try {
    fn();
    return 0;
  } catch (e) {
    return e instanceof ErroHttp ? e.status : -1;
  }
};

test('centavos -> reais sem erro de ponto flutuante', () => {
  const casos = { 0: 0, 1: 0.01, 10: 0.1, 99: 0.99, 100: 1, 1999: 19.99, 6500: 65, 29789: 297.89, 229789: 2297.89, 100001: 1000.01 };
  for (const [c, r] of Object.entries(casos)) assert.equal(centavosParaReais(Number(c)), r, `${c} centavos`);
  // a soma em centavos e a soma dos reais convertidos conferem (o erro clássico seria 0,1 + 0,2)
  assert.equal(centavosParaReais(10) + centavosParaReais(20) === 0.30000000000000004, true);
  assert.equal(centavosParaReais(10 + 20), 0.3);
});

test('centavos inválidos são recusados', () => {
  for (const v of [1.5, -1, '10', NaN, null]) assert.throws(() => centavosParaReais(v));
});

test('config: sem chave, não configura', () => {
  assert.equal(codigo(() => configAsaas({})), 503);
  assert.equal(codigo(() => configAsaas({ ASAAS_API_KEY: '  ' })), 503);
});

test('config: sandbox é o padrão', () => {
  const c = configAsaas({ ASAAS_API_KEY: CHAVE_SANDBOX });
  assert.equal(c.base, SANDBOX);
  assert.equal(c.producao, false);
});

test('config: chave de produção é recusada sem URL de produção E sem o sinalizador', () => {
  assert.equal(codigo(() => configAsaas({ ASAAS_API_KEY: CHAVE_PROD })), 503, 'chave prod + URL sandbox');
  assert.equal(codigo(() => configAsaas({ ASAAS_API_KEY: CHAVE_PROD, ASAAS_BASE_URL: PRODUCAO })), 503, 'sem sinalizador');
  assert.equal(codigo(() => configAsaas({ ASAAS_API_KEY: CHAVE_PROD, ASAAS_BASE_URL: PRODUCAO, ASAAS_PERMITIR_PRODUCAO: 'talvez' })), 503);
  assert.equal(codigo(() => configAsaas({ ASAAS_API_KEY: CHAVE_PROD, ASAAS_PERMITIR_PRODUCAO: 'sim' })), 503, 'sinalizador sozinho não basta');
});

test('config: produção só com URL de produção, chave de produção e sinalizador explícito', () => {
  const c = configAsaas({ ASAAS_API_KEY: CHAVE_PROD, ASAAS_BASE_URL: PRODUCAO, ASAAS_PERMITIR_PRODUCAO: 'sim' });
  assert.equal(c.producao, true);
  assert.equal(c.base, PRODUCAO);
});

test('config: URL de produção com chave de sandbox (e vice-versa) é erro', () => {
  assert.equal(codigo(() => configAsaas({ ASAAS_API_KEY: CHAVE_SANDBOX, ASAAS_BASE_URL: PRODUCAO, ASAAS_PERMITIR_PRODUCAO: 'sim' })), 503);
});

test('config: URL fora da lista do Asaas é recusada', () => {
  for (const url of ['https://evil.example.com/v3', 'http://api-sandbox.asaas.com/v3', 'https://api-sandbox.asaas.com.evil.com/v3']) {
    assert.equal(codigo(() => configAsaas({ ASAAS_API_KEY: CHAVE_SANDBOX, ASAAS_BASE_URL: url })), 503, url);
  }
});

test('config: endereço público das páginas de retorno precisa ser https', () => {
  assert.equal(codigo(() => configAsaas({ ASAAS_API_KEY: CHAVE_SANDBOX, API_PUBLICA_URL: 'http://x.com' })), 503);
  assert.equal(configAsaas({ ASAAS_API_KEY: CHAVE_SANDBOX, API_PUBLICA_URL: 'https://api.exemplo.com/' }).publica, 'https://api.exemplo.com');
});

test('montarCheckout: PIX e cartão, 15 min, externalReference, callbacks https e itens em reais', () => {
  const p = montarCheckout({
    agendamentoId: 'ag123',
    itens: [
      { nome: 'Banho Básico', precoCentavos: 6500 },
      { nome: 'Insulfilm Poliéster com Garantia (Traseira e Laterais)', precoCentavos: 35099 }
    ],
    publica: 'https://api.exemplo.com'
  });
  assert.deepEqual(p.billingTypes, ['PIX', 'CREDIT_CARD']);
  assert.deepEqual(p.chargeTypes, ['DETACHED']);
  assert.equal(p.minutesToExpire, 15);
  assert.equal(p.externalReference, 'ag123');
  assert.equal(p.callback.successUrl, 'https://api.exemplo.com/api/retorno/pago');
  assert.equal(p.callback.cancelUrl, 'https://api.exemplo.com/api/retorno/cancelado');
  assert.equal(p.callback.expiredUrl, 'https://api.exemplo.com/api/retorno/expirado');
  for (const u of Object.values(p.callback)) assert.match(u, /^https:\/\//);
  assert.deepEqual(p.items.map((i) => i.value), [65, 350.99]);
  assert.ok(p.items.every((i) => i.name.length <= 30 && i.quantity === 1));
  assert.equal('customer' in p, false);
  assert.equal('customerData' in p, false);
});

test('montarCheckout: com cliente conhecido passa "customer", nunca customerData', () => {
  const p = montarCheckout({ agendamentoId: 'a', itens: [{ nome: 'x', precoCentavos: 100 }], publica: 'https://a.com', customerId: 'cus_000005' });
  assert.equal(p.customer, 'cus_000005');
  assert.equal('customerData' in p, false);
});

function respostaFalsa(status, corpo) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });
}
const cfg = { base: SANDBOX, chave: CHAVE_SANDBOX, publica: 'https://a.com' };

test('criarCheckoutAsaas: devolve o id e o link que a API retornou', async () => {
  const r = await criarCheckoutAsaas(cfg, {}, respostaFalsa(200, { id: 'chk-1', link: 'https://sandbox.asaas.com/000/checkoutSession/show/chk-1' }));
  assert.deepEqual(r, { id: 'chk-1', link: 'https://sandbox.asaas.com/000/checkoutSession/show/chk-1' });
});

test('criarCheckoutAsaas: envia a chave só no cabeçalho access_token', async () => {
  let visto;
  await criarCheckoutAsaas(cfg, { a: 1 }, async (url, init) => {
    visto = { url, init };
    return { ok: true, status: 200, json: async () => ({ id: 'c', link: 'https://asaas.com/x' }) };
  });
  assert.equal(visto.url, `${SANDBOX}/checkouts`);
  assert.equal(visto.init.headers.access_token, CHAVE_SANDBOX);
  assert.ok(visto.init.headers['User-Agent']);
  assert.equal(visto.init.body.includes(CHAVE_SANDBOX), false);
});

test('criarCheckoutAsaas: erro da API vira 502 sem vazar a chave nem o corpo', async () => {
  const e = await criarCheckoutAsaas(cfg, {}, respostaFalsa(400, { errors: [{ description: 'segredo interno' }] })).catch((x) => x);
  assert.equal(e.status, 502);
  assert.equal(e.message.includes('segredo'), false);
  assert.equal(e.message.includes(CHAVE_SANDBOX), false);
});

test('criarCheckoutAsaas: falha de rede vira 502; link fora do Asaas ou http é recusado', async () => {
  assert.equal((await criarCheckoutAsaas(cfg, {}, async () => { throw new Error('rede'); }).catch((x) => x)).status, 502);
  for (const link of ['https://evil.com/x', 'http://asaas.com/x', 'https://asaas.com.evil.com/x', 'javascript:alert(1)']) {
    assert.equal((await criarCheckoutAsaas(cfg, {}, respostaFalsa(200, { id: 'c', link })).catch((x) => x)).status, 502, link);
  }
  assert.equal((await criarCheckoutAsaas(cfg, {}, respostaFalsa(200, { id: 'c' })).catch((x) => x)).status, 502);
});
