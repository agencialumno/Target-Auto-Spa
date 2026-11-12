// POST /api/asaas/webhook: eventos do Checkout do Asaas.
// Regras: token em tempo constante (sem ASAAS_WEBHOOK_TOKEN nada passa), idempotente pelo id do evento,
// nada de CPF, e-mail ou endereço gravado ou registrado em log. Só a lógica; sem rede.
import { createHash, timingSafeEqual } from 'node:crypto';
import { ATOR_SISTEMA, registrarNaTransacao } from './atividades.js';

// O Asaas documenta ids como "evt_05b708f9...&368604920": o "&" faz parte do id (sem ele o evento real virava 400)
export const EVENTO_ID_RE = /^[A-Za-z0-9_&.:=-]{1,128}$/;
const AGENDAMENTO_RE = /^[A-Za-z0-9]{1,64}$/;
const CUSTOMER_RE = /^cus_[A-Za-z0-9]{1,64}$/;
const VAGA_RE = /^[A-Za-z0-9_:-]{1,200}$/;
const CHECKOUT_ID_RE = /^[A-Za-z0-9-]{1,100}$/;

export const EVENTOS_CHECKOUT = ['CHECKOUT_PAID', 'CHECKOUT_EXPIRED', 'CHECKOUT_CANCELED'];

// Compara sem vazar, pelo tempo, onde os valores diferem (hash de tamanho fixo antes de comparar)
export function tokenValido(recebido, esperado) {
  if (typeof esperado !== 'string' || esperado.length === 0) return false;
  const h = (s) => createHash('sha256').update(String(s ?? '')).digest();
  return timingSafeEqual(h(recebido), h(esperado));
}

// Valor do checkout em centavos, se o payload trouxer os itens; null se não der para saber
export function valorDoCheckout(co) {
  const itens = co?.items;
  if (!Array.isArray(itens) || itens.length === 0) return null;
  let total = 0;
  for (const i of itens) {
    if (typeof i?.value !== 'number' || !Number.isFinite(i.value)) return null;
    const qtd = Number.isInteger(i.quantity) && i.quantity > 0 ? i.quantity : 1;
    total += Math.round(i.value * 100) * qtd;
  }
  return total;
}

// checkout.customer pode vir como id ou como objeto; só o id (cus_...) interessa
export function idDoCliente(co) {
  const c = co?.customer;
  const id = typeof c === 'string' ? c : typeof c?.id === 'string' ? c.id : null;
  return id && CUSTOMER_RE.test(id) ? id : null;
}

// Decide o que fazer com o agendamento, sem tocar no banco (função pura)
export function decidir(tipo, ag, { checkoutId, valor, agora }) {
  const p = ag.pagamento ?? {};
  const jaPago = p.status === 'pago' || p.status === 'pago_apos_cancelamento';
  // Pago com valor divergente também é dinheiro recebido: expirar/cancelar nunca pode apagar isso
  const recebido = jaPago || p.status === 'divergente';

  if (tipo === 'CHECKOUT_PAID') {
    if (jaPago) return { resultado: 'ja_pago' };
    if (valor !== null && valor !== ag.total) {
      return { resultado: 'valor_divergente', pagamento: { ...p, status: 'divergente', revisao: true, checkoutId: checkoutId ?? p.checkoutId ?? null } };
    }
    if (ag.status === 'cancelado') {
      // Pagou depois de cancelar: não estorna nem reabre; fica sinalizado para o admin
      return {
        resultado: 'pago_apos_cancelamento',
        pagamento: { ...p, status: 'pago_apos_cancelamento', revisao: true, pagoEm: agora, checkoutId: checkoutId ?? p.checkoutId ?? null },
        registrarCliente: true
      };
    }
    return {
      resultado: 'pago',
      pagamento: { ...p, status: 'pago', pagoEm: agora, checkoutId: checkoutId ?? p.checkoutId ?? null },
      registrarCliente: true
    };
  }

  // EXPIRED / CANCELED
  if (recebido) return { resultado: 'ignorado_pago' };
  // Evento de um Checkout antigo (já trocado por outro): não mexe no agendamento
  if (checkoutId && p.checkoutId && checkoutId !== p.checkoutId) return { resultado: 'ignorado_checkout_antigo' };

  const status = tipo === 'CHECKOUT_EXPIRED' ? 'expirado' : 'cancelado';
  const pagamento = { ...p, status, encerradoEm: agora };
  if (ag.status === 'agendado') {
    return { resultado: 'agendamento_cancelado', pagamento, cancelar: true };
  }
  return { resultado: 'status_atualizado', pagamento };
}

// O que o log de atividades registra para uma decisão (só status e valor em centavos)
export function atividadeDoPagamento(tipo, d, ag, valor) {
  const antes = { status: ag.pagamento?.status ?? null };
  const status = d.pagamento?.status;
  switch (d.resultado) {
    case 'pago':
    case 'pago_apos_cancelamento':
      return { acao: 'pagamento_confirmado', antes, depois: { status, valorCentavos: valor ?? ag.total } };
    case 'valor_divergente':
      return { acao: 'pagamento_divergente', antes, depois: { status, valorCentavos: valor } };
    case 'agendamento_cancelado':
    case 'status_atualizado':
      return { acao: tipo === 'CHECKOUT_EXPIRED' ? 'pagamento_expirado' : 'pagamento_cancelado', antes, depois: { status } };
    default:
      return null;
  }
}

async function acharPorCheckout(db, checkoutId) {
  if (!checkoutId) return null;
  const r = await db.collection('agendamentos').where('pagamento.checkoutId', '==', checkoutId).limit(1).get();
  return r.docs[0]?.id ?? null;
}

// Devolve { status, corpo } para o handler responder
export async function processarWebhook(deps, headers, corpo) {
  const { db, env = process.env, agora = () => new Date() } = deps;

  const esperado = env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado) return { status: 503, corpo: { erro: 'Webhook não configurado.' } };
  if (!tokenValido(headers?.['asaas-access-token'], esperado)) return { status: 401, corpo: { erro: 'Não autorizado.' } };

  // Contrato: depois do token, NUNCA 4xx (15 falhas seguidas pausam a fila do Asaas). Corpo ou evento
  // fora do formato é registrado em log pelo handler e respondido com 200, sem gravar nada.
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return { status: 200, corpo: { ok: true, resultado: 'corpo_invalido' } };
  const eventoId = corpo.id;
  const tipo = corpo.event;
  if (typeof eventoId !== 'string' || !EVENTO_ID_RE.test(eventoId) || typeof tipo !== 'string' || tipo.length > 60) {
    return { status: 200, corpo: { ok: true, resultado: 'evento_invalido' } };
  }

  const co = corpo.checkout && typeof corpo.checkout === 'object' ? corpo.checkout : null;
  const checkoutId = typeof co?.id === 'string' && CHECKOUT_ID_RE.test(co.id) ? co.id : null;
  const eventoRef = db.doc(`eventosAsaas/${eventoId}`);
  const quando = agora();

  // Eventos que não são do Checkout: só guarda o registro (idempotente) e responde 200
  if (!EVENTOS_CHECKOUT.includes(tipo)) {
    const resultado = await db.runTransaction(async (tx) => {
      if ((await tx.get(eventoRef)).exists) return 'duplicado';
      tx.set(eventoRef, { evento: tipo.slice(0, 60), recebidoEm: quando, resultado: 'ignorado' });
      return 'ignorado';
    });
    return { status: 200, corpo: { ok: true, resultado } };
  }

  const refExterna = typeof co?.externalReference === 'string' && AGENDAMENTO_RE.test(co.externalReference) ? co.externalReference : null;
  const agendamentoId = refExterna ?? (await acharPorCheckout(db, checkoutId));
  const valor = valorDoCheckout(co);
  const clienteAsaas = tipo === 'CHECKOUT_PAID' ? idDoCliente(co) : null;

  const resultado = await db.runTransaction(async (tx) => {
    // Leituras primeiro, escritas depois
    if ((await tx.get(eventoRef)).exists) return 'duplicado';
    const agRef = agendamentoId ? db.doc(`agendamentos/${agendamentoId}`) : null;
    const snap = agRef ? await tx.get(agRef) : null;

    if (!snap?.exists) {
      // Sem agendamento: guarda um resumo SEM dados pessoais para revisão e responde 200
      tx.set(eventoRef, {
        evento: tipo,
        recebidoEm: quando,
        resultado: 'sem_agendamento',
        revisar: true,
        checkoutId,
        referencia: typeof co?.externalReference === 'string' ? co.externalReference.slice(0, 80) : null
      });
      return 'sem_agendamento';
    }

    const ag = snap.data();
    const d = decidir(tipo, ag, { checkoutId, valor, agora: quando });
    const registro = { evento: tipo, recebidoEm: quando, resultado: d.resultado, agendamentoId, checkoutId };

    if (d.pagamento) tx.update(agRef, d.pagamento && d.cancelar
      ? { pagamento: d.pagamento, status: 'cancelado', atualizadoEm: quando }
      : { pagamento: d.pagamento });

    if (d.cancelar && typeof ag.vagaId === 'string' && VAGA_RE.test(ag.vagaId)) {
      tx.delete(db.doc(`ocupacao/${ag.vagaId}`));
    }

    // Só o id do cliente do Asaas, e só pelo servidor (coleção negada a qualquer cliente das regras)
    if (d.registrarCliente) {
      registro.customerRecebido = !!clienteAsaas;
      if (clienteAsaas && typeof ag.clienteId === 'string' && AGENDAMENTO_RE.test(ag.clienteId)) {
        tx.set(db.doc(`clientesAsaas/${ag.clienteId}`), { asaasCustomerId: clienteAsaas, atualizadoEm: quando });
      }
    }
    if (d.pagamento?.revisao) registro.revisar = true;

    tx.set(eventoRef, registro);
    // Mesmo commit da mudança: o log só existe se o pagamento foi mesmo gravado
    const atv = atividadeDoPagamento(tipo, d, ag, valor);
    if (atv) registrarNaTransacao(tx, db, { ...ATOR_SISTEMA, em: quando, alvoId: agendamentoId, origem: 'webhook', ...atv });
    return d.resultado;
  });

  return { status: 200, corpo: { ok: true, resultado } };
}
