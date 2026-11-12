// Cliente mínimo da API do Asaas. Nunca registra a chave, o corpo das respostas nem dado pessoal.
import { ErroHttp } from './usuarios.js';

const SANDBOX = 'https://api-sandbox.asaas.com/v3';
const PRODUCAO = 'https://api.asaas.com/v3';

export const MINUTOS_PARA_PAGAR = 15;
export const API_PUBLICA_PADRAO = 'https://target-auto-spa-api.vercel.app';

// Lê e valida a configuração. A chave de produção só é aceita com a URL de produção E o sinalizador
// explícito ASAAS_PERMITIR_PRODUCAO=sim; sandbox é o padrão. Nada disso é registrado em log.
export function configAsaas(env = process.env) {
  const chave = (env.ASAAS_API_KEY ?? '').trim();
  if (!chave) throw new ErroHttp(503, 'Pagamento não configurado.');

  const base = (env.ASAAS_BASE_URL ?? SANDBOX).trim().replace(/\/+$/, '');
  if (base !== SANDBOX && base !== PRODUCAO) throw new ErroHttp(503, 'Pagamento não configurado.');

  const urlProducao = base === PRODUCAO;
  const chaveProducao = chave.startsWith('$aact_prod_');
  const liberado = env.ASAAS_PERMITIR_PRODUCAO === 'sim';

  // Chave de produção em sandbox, ou o contrário, é erro de configuração: recusa
  if (chaveProducao !== urlProducao) throw new ErroHttp(503, 'Pagamento não configurado.');
  // Produção só com o sinalizador explícito
  if ((urlProducao || chaveProducao) && !liberado) throw new ErroHttp(503, 'Pagamento não configurado.');

  const publica = (env.API_PUBLICA_URL ?? API_PUBLICA_PADRAO).trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^\s/]+$/.test(publica)) throw new ErroHttp(503, 'Pagamento não configurado.');

  return { chave, base, producao: urlProducao, publica };
}

// Centavos inteiros -> reais, sem erro de ponto flutuante (nada de centavos / 100 * algo)
export function centavosParaReais(centavos) {
  if (!Number.isInteger(centavos) || centavos < 0) throw new Error('valor inválido');
  const reais = Math.trunc(centavos / 100);
  const resto = String(centavos % 100).padStart(2, '0');
  return Number(`${reais}.${resto}`);
}

// Payload do Checkout: PIX e cartão, cobrança única, 15 minutos (nunca 0), externalReference = agendamento
export function montarCheckout({ agendamentoId, itens, publica, customerId }) {
  return {
    billingTypes: ['PIX', 'CREDIT_CARD'],
    chargeTypes: ['DETACHED'],
    minutesToExpire: MINUTOS_PARA_PAGAR,
    externalReference: agendamentoId,
    callback: {
      successUrl: `${publica}/api/retorno/pago`,
      cancelUrl: `${publica}/api/retorno/cancelado`,
      expiredUrl: `${publica}/api/retorno/expirado`
    },
    items: itens.map((i) => ({
      name: String(i.nome).slice(0, 30),
      description: String(i.nome).slice(0, 150),
      quantity: 1,
      value: centavosParaReais(i.precoCentavos)
    })),
    // "customer" e "customerData" nunca vão juntos: aqui só o id do cliente, se já existir
    ...(customerId ? { customer: customerId } : {})
  };
}

export async function criarCheckoutAsaas(cfg, payload, fetchImpl = fetch) {
  let resposta;
  try {
    resposta = await fetchImpl(`${cfg.base}/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: cfg.chave,
        'User-Agent': 'target-auto-spa-api'
      },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new ErroHttp(502, 'Não foi possível iniciar o pagamento. Tente novamente.');
  }
  if (!resposta.ok) {
    // Só o status vai para o log; o corpo pode ter dados e a chave nunca é impressa
    console.error('asaas checkout recusado:', resposta.status);
    throw new ErroHttp(502, 'Não foi possível iniciar o pagamento. Tente novamente.');
  }
  const dados = await resposta.json().catch(() => ({}));
  if (typeof dados.id !== 'string' || typeof dados.link !== 'string') {
    throw new ErroHttp(502, 'Resposta inesperada do serviço de pagamento.');
  }
  // O link vem da API; só aceitamos https de um domínio do Asaas
  let host = '';
  try {
    const u = new URL(dados.link);
    host = u.protocol === 'https:' ? u.hostname : '';
  } catch {
    host = '';
  }
  if (!/(^|\.)asaas\.com$/.test(host)) throw new ErroHttp(502, 'Resposta inesperada do serviço de pagamento.');
  return { id: dados.id, link: dados.link };
}

// Cobranças geradas por um Checkout (filtro documentado checkoutSession). Devolve só o que interessa:
// situação, valor em centavos e id do cliente. Nunca registra o corpo da resposta.
export async function listarPagamentosDoCheckout(cfg, checkoutId, fetchImpl = fetch) {
  let resposta;
  try {
    resposta = await fetchImpl(`${cfg.base}/payments?checkoutSession=${encodeURIComponent(checkoutId)}&limit=10`, {
      method: 'GET',
      headers: { access_token: cfg.chave, 'User-Agent': 'target-auto-spa-api' }
    });
  } catch {
    throw new ErroHttp(502, 'Não foi possível consultar o pagamento. Tente novamente.');
  }
  if (!resposta.ok) {
    console.error('asaas consulta recusada:', resposta.status);
    throw new ErroHttp(502, 'Não foi possível consultar o pagamento. Tente novamente.');
  }
  const dados = await resposta.json().catch(() => ({}));
  const lista = Array.isArray(dados.data) ? dados.data : [];
  return lista.map((p) => ({
    status: typeof p?.status === 'string' ? p.status : '',
    centavos: typeof p?.value === 'number' && Number.isFinite(p.value) ? Math.round(p.value * 100) : null,
    customer: typeof p?.customer === 'string' ? p.customer : null
  }));
}
