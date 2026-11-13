// POST /api/agendamentos/criar: cria o agendamento e TODAS as vagas de 30 min que a duração cobre,
// numa única transação do Admin SDK. Preço, total e duração vêm do catálogo (nunca do app); a vaga é
// escolhida dentro da transação, então dois clientes disputando o mesmo horário nunca ficam com a mesma vaga.
//
// Compatível com as builds antigas: usa os mesmos documentos de /ocupacao ({cond}_{data}_{hora}_{n} ou
// ext_{data}_{hora}_{n}) e o mesmo formato de agendamento (vagaId = vaga do horário inicial). Reservas
// feitas direto pelo Firestore por builds antigas ocupam 1 vaga e são respeitadas aqui.
import { createHash } from 'node:crypto';
import { ErroHttp } from './usuarios.js';
import { exigirUsuario } from './pagamento.js';

export const GRADE_MIN = 30;
export const ABERTURA_MIN = 8 * 60; // 08:00
export const FECHAMENTO_MIN = 18 * 60; // 18:00
export const HORARIOS_INSULFILM = ['09:00', '11:00', '14:00', '16:00'];
export const ANTECEDENCIA_INSULFILM_H = 36;
export const ANTECEDENCIA_LAVAGEM_MIN = 0; // o início precisa ser depois de "agora" (como a grade do app)
export const JANELA_DIAS = 14;
export const CAPACIDADE_MAX = 20;
const FUSO_MIN = -3 * 60; // Brasil (sem horário de verão)

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const CHAVE_RE = /^[A-Za-z0-9_-]{8,64}$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01]\d|2[0-3]):(00|30)$/;

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const paraMin = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));

// "2030-05-10" + "09:00" em horário de Brasília -> Date (instante real)
export function inicioDe(data, hora) {
  const d = new Date(`${data}T${hora}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Data de hoje no fuso de Brasília (AAAA-MM-DD)
export const hojeLocal = (agora) => new Date(agora.getTime() + FUSO_MIN * 60_000).toISOString().slice(0, 10);

export const idVaga = (v, n) => (v.externo ? `ext_${v.data}_${v.hora}_${n}` : `${v.condominioId}_${v.data}_${v.hora}_${n}`);

// Horários de 30 min que o serviço cobre: duração 90 às 09:00 -> 09:00, 09:30, 10:00
export function slotsCobertos(hora, duracaoMin) {
  const n = Math.ceil(duracaoMin / GRADE_MIN);
  const ini = paraMin(hora);
  return Array.from({ length: n }, (_, k) => hhmm(ini + k * GRADE_MIN));
}

export const idAgendamento = (uid, chave) => createHash('sha256').update(`${uid}:${chave}`).digest('hex').slice(0, 20);

const capacidadeValida = (v) => (Number.isInteger(v) && v >= 1 && v <= CAPACIDADE_MAX ? v : 1);

function lerCorpo(corpo) {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new ErroHttp(400, 'Corpo inválido.');
  const servicos = corpo.servicos;
  if (!Array.isArray(servicos) || servicos.length < 1 || servicos.length > 5 || !servicos.every((s) => typeof s === 'string' && ID_RE.test(s))) {
    throw new ErroHttp(400, 'Escolha de 1 a 5 serviços.');
  }
  if (new Set(servicos).size !== servicos.length) throw new ErroHttp(400, 'Há serviços repetidos.');
  const data = typeof corpo.data === 'string' ? corpo.data : '';
  const hora = typeof corpo.hora === 'string' ? corpo.hora : '';
  if (!DATA_RE.test(data) || !HORA_RE.test(hora)) throw new ErroHttp(400, 'Data ou horário inválido.');
  const v = corpo.veiculo;
  const modelo = typeof v?.modelo === 'string' ? v.modelo.trim() : '';
  const placa = typeof v?.placa === 'string' ? v.placa.trim().toUpperCase() : '';
  if (modelo.length > 60 || !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa)) throw new ErroHttp(400, 'Informe a placa do veículo (ex.: ABC1D23).');
  const observacoes = typeof corpo.observacoes === 'string' ? corpo.observacoes.slice(0, 500) : '';
  const chave = typeof corpo.chave === 'string' ? corpo.chave : null;
  if (chave !== null && !CHAVE_RE.test(chave)) throw new ErroHttp(400, 'Chave de reserva inválida.');
  return { servicos, data, hora, veiculo: { modelo, placa }, observacoes, chave };
}

export async function criarAgendamento(deps, authorization, corpo) {
  const { db, agora = () => new Date() } = deps;
  const uid = await exigirUsuario(deps, authorization);
  const entrada = lerCorpo(corpo);
  const agoraD = agora();

  // Papel e condomínio vêm do perfil gravado no servidor, nunca do pedido
  const perfil = await db.doc(`users/${uid}`).get();
  if (!perfil.exists || perfil.data().role !== 'cliente') throw new ErroHttp(403, 'Só clientes podem agendar.');
  const condominioId = perfil.data().condominioId;
  if (typeof condominioId !== 'string' || !ID_RE.test(condominioId)) {
    throw new ErroHttp(403, 'Seu perfil não está ligado a um condomínio. Entre com o código do condomínio.');
  }
  const condo = await db.doc(`condominios/${condominioId}`).get();
  if (!condo.exists) throw new ErroHttp(403, 'Condomínio não encontrado.');

  // Catálogo: preço, nome, categoria e duração do servidor
  const snaps = await Promise.all(entrada.servicos.map((id) => db.doc(`servicos/${id}`).get()));
  const itens = [];
  let duracaoMin = 0;
  let nExternos = 0;
  snaps.forEach((s, i) => {
    const d = s.exists ? s.data() : null;
    if (!d || d.ativo !== true) throw new ErroHttp(409, 'Serviço indisponível no momento.');
    if (!Number.isInteger(d.precoCentavos) || d.precoCentavos <= 0 || typeof d.nome !== 'string') {
      throw new ErroHttp(409, 'Serviço sem preço válido. Tente novamente mais tarde.');
    }
    if (!Number.isInteger(d.duracaoMin) || d.duracaoMin <= 0) throw new ErroHttp(409, 'Serviço sem duração configurada.');
    itens.push({ servicoId: entrada.servicos[i], nome: d.nome, precoCentavos: d.precoCentavos });
    duracaoMin += d.duracaoMin;
    if (d.categoria === 'insulfilm') nExternos++;
  });
  const externo = nExternos === itens.length;
  if (!externo && nExternos > 0) throw new ErroHttp(409, 'Insulfilm precisa ser agendado separado dos outros serviços.');
  const total = itens.reduce((s, i) => s + i.precoCentavos, 0);

  // Janela de horários e antecedência
  const inicio = inicioDe(entrada.data, entrada.hora);
  if (!inicio) throw new ErroHttp(400, 'Data ou horário inválido.');
  const hoje = hojeLocal(agoraD);
  // A grade do app mostra hoje + 13 dias (14 dias no total)
  const limiteDia = hojeLocal(new Date(agoraD.getTime() + (JANELA_DIAS - 1) * 86_400_000));
  if (entrada.data < hoje || entrada.data > limiteDia) {
    throw new ErroHttp(400, `Escolha uma data entre hoje e os próximos ${JANELA_DIAS} dias.`);
  }
  if (externo) {
    if (!HORARIOS_INSULFILM.includes(entrada.hora)) throw new ErroHttp(400, 'Horário fora da agenda do insulfilm.');
    if (inicio.getTime() < agoraD.getTime() + ANTECEDENCIA_INSULFILM_H * 3_600_000) {
      throw new ErroHttp(400, `O insulfilm precisa de pelo menos ${ANTECEDENCIA_INSULFILM_H} h de antecedência.`);
    }
  } else {
    const ini = paraMin(entrada.hora);
    if (ini < ABERTURA_MIN || ini + duracaoMin > FECHAMENTO_MIN) {
      throw new ErroHttp(400, 'Esse serviço não cabe no horário de funcionamento (08:00 às 18:00) a partir deste horário.');
    }
    if (inicio.getTime() <= agoraD.getTime() + ANTECEDENCIA_LAVAGEM_MIN * 60_000) {
      throw new ErroHttp(400, 'Esse horário já passou. Escolha outro.');
    }
  }

  const agId = entrada.chave ? idAgendamento(uid, entrada.chave) : db.collection('agendamentos').doc().id;
  const slots = slotsCobertos(entrada.hora, duracaoMin);
  const alvo = { externo, condominioId, data: entrada.data };

  return db.runTransaction(async (tx) => {
    const agRef = db.doc(`agendamentos/${agId}`);
    const cfgRef = externo ? db.doc('config/insulfilm') : db.doc(`condominios/${condominioId}`);

    // ---- todas as leituras primeiro ----
    const [agSnap, cfgSnap] = await Promise.all([tx.get(agRef), tx.get(cfgRef)]);

    // Idempotência: mesma chave = mesma reserva (o app pode repetir após timeout sem duplicar)
    if (agSnap.exists) {
      const a = agSnap.data();
      const mesmo = a.clienteId === uid && a.data === entrada.data && a.hora === entrada.hora && a.itens?.map((i) => i.servicoId).join(',') === entrada.servicos.join(',');
      if (!mesmo) throw new ErroHttp(409, 'Esta chave de reserva já foi usada para outro agendamento.');
      return { id: agId, vagasIds: a.vagasIds ?? [a.vagaId], total: a.total, jaExistia: true };
    }

    const capacidade = capacidadeValida(cfgSnap.exists ? cfgSnap.data().capacidade : 1);
    const candidatas = slots.map((hora) => Array.from({ length: capacidade }, (_, k) => idVaga({ ...alvo, hora }, k + 1)));
    const refs = candidatas.flat().map((id) => db.doc(`ocupacao/${id}`));
    const vagasSnap = await Promise.all(refs.map((r) => tx.get(r)));
    const porId = new Map(refs.map((r, i) => [r.id, vagasSnap[i]]));

    // Vaga que sobrou de reserva já cancelada (ex.: o pagamento expirou) conta como livre
    const donos = [...new Set(vagasSnap.filter((s) => s.exists).map((s) => s.data().agendamentoId).filter((x) => typeof x === 'string' && ID_RE.test(x)))];
    const donosSnap = await Promise.all(donos.map((id) => tx.get(db.doc(`agendamentos/${id}`))));
    const cancelado = new Set(donos.filter((id, i) => !donosSnap[i].exists || donosSnap[i].data().status === 'cancelado'));
    const livre = (id) => {
      const s = porId.get(id);
      return !s.exists || cancelado.has(s.data().agendamentoId);
    };

    // ---- escolhe, por horário, a menor vaga livre; se algum horário não tem, ninguém é reservado ----
    const escolhidas = [];
    for (let i = 0; i < slots.length; i++) {
      const id = candidatas[i].find(livre);
      if (!id) throw new ErroHttp(409, `Horário indisponível: não há vaga às ${slots[i]}. Escolha outro horário.`);
      escolhidas.push(id);
    }

    // ---- escritas ----
    escolhidas.forEach((id, i) => {
      tx.set(db.doc(`ocupacao/${id}`), { condominioId, data: entrada.data, hora: slots[i], externo, agendamentoId: agId });
    });
    tx.set(agRef, {
      clienteId: uid,
      clienteNome: String(perfil.data().nome ?? 'Cliente').slice(0, 100) || 'Cliente',
      condominioId,
      itens,
      total,
      data: entrada.data,
      hora: entrada.hora,
      inicio,
      status: 'agendado',
      funcionarioId: null,
      funcionarioNome: null,
      veiculo: entrada.veiculo,
      observacoes: entrada.observacoes,
      checklist: { fotos: {} },
      avaliacao: null,
      externo,
      vagaId: escolhidas[0],
      vagasIds: escolhidas,
      duracaoMin,
      criadoEm: agoraD
    });
    return { id: agId, vagasIds: escolhidas, total, jaExistia: false };
  });
}
