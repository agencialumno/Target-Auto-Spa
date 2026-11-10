// POST /api/pagamento/criar { agendamentoId }: cria (ou devolve) o Checkout do Asaas de um agendamento.
// Recebe auth, db e o resto por parâmetro para poder ser testado sem rede.
import { ErroHttp } from './usuarios.js';
import { MINUTOS_PARA_PAGAR, configAsaas, criarCheckoutAsaas, montarCheckout } from './asaas.js';

const ID_RE = /^[A-Za-z0-9]{1,64}$/;
const CUSTOMER_RE = /^cus_[A-Za-z0-9]{1,64}$/;

// Valida o ID token do Firebase e devolve o uid de quem chama
export async function exigirUsuario({ auth }, authorization) {
  const m = /^Bearer (.+)$/.exec(authorization ?? '');
  if (!m) throw new ErroHttp(401, 'Faça login para continuar.');
  try {
    return (await auth.verifyIdToken(m[1], true)).uid;
  } catch {
    throw new ErroHttp(401, 'Sessão inválida ou expirada. Entre novamente.');
  }
}

const paraData = (v) => (v?.toDate ? v.toDate() : v instanceof Date ? v : null);

export async function criarPagamento(deps, authorization, corpo) {
  const { db, env = process.env, agora = () => new Date() } = deps;
  const fetchImpl = deps.fetch ?? fetch;

  const uid = await exigirUsuario(deps, authorization);
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new ErroHttp(400, 'Corpo inválido.');
  const agendamentoId = typeof corpo.agendamentoId === 'string' ? corpo.agendamentoId.trim() : '';
  if (!ID_RE.test(agendamentoId)) throw new ErroHttp(400, 'Agendamento inválido.');

  const cfg = configAsaas(env);

  const ref = db.doc(`agendamentos/${agendamentoId}`);
  const snap = await ref.get();
  // Agendamento de outra pessoa responde igual a "não existe": não revela quem tem o quê
  if (!snap.exists || snap.data().clienteId !== uid) throw new ErroHttp(404, 'Agendamento não encontrado.');
  const ag = snap.data();

  if (ag.status !== 'agendado') throw new ErroHttp(409, 'Este agendamento não está mais aberto para pagamento.');
  const situacao = ag.pagamento?.status;
  if (situacao === 'pago' || situacao === 'pago_apos_cancelamento') {
    throw new ErroHttp(409, 'Este agendamento já foi pago.');
  }

  // O total vem do DOCUMENTO (centavos inteiros), nunca do app; precisa bater com os itens
  const itens = ag.itens;
  const somaOk =
    Array.isArray(itens) &&
    itens.length >= 1 &&
    itens.length <= 5 &&
    itens.every((i) => typeof i?.nome === 'string' && Number.isInteger(i.precoCentavos) && i.precoCentavos > 0) &&
    itens.reduce((s, i) => s + i.precoCentavos, 0) === ag.total;
  if (!Number.isInteger(ag.total) || ag.total <= 0 || !somaOk) {
    throw new ErroHttp(409, 'Os valores deste agendamento não conferem.');
  }

  // Idempotente: Checkout ainda aberto => devolve o mesmo, sem criar outro
  const p = ag.pagamento;
  const vence = paraData(p?.venceEm);
  if (p?.status === 'pendente' && typeof p.checkoutId === 'string' && typeof p.link === 'string' && vence && vence > agora()) {
    return { link: p.link, venceEm: vence.toISOString(), reutilizado: true };
  }

  // Cliente já conhecido do Asaas (gravado só pelo servidor): passa "customer", nunca customerData
  const cli = await db.doc(`clientesAsaas/${uid}`).get();
  const customerId = cli.exists && CUSTOMER_RE.test(String(cli.data().asaasCustomerId ?? '')) ? cli.data().asaasCustomerId : null;

  const checkout = await criarCheckoutAsaas(
    cfg,
    montarCheckout({ agendamentoId, itens, publica: cfg.publica, customerId }),
    fetchImpl
  );

  const venceEm = new Date(agora().getTime() + MINUTOS_PARA_PAGAR * 60_000);
  await ref.update({
    pagamento: { status: 'pendente', checkoutId: checkout.id, link: checkout.link, venceEm, criadoEm: agora() }
  });
  return { link: checkout.link, venceEm: venceEm.toISOString(), reutilizado: false };
}
