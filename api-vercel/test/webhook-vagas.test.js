import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processarWebhook, vagasDoAgendamento } from '../_lib/webhook-asaas.js';
import { criarBanco } from './_falso.js';

const TOKEN = 'segredo-do-webhook-de-teste';
const AGORA = new Date('2030-01-01T12:00:00Z');
const cab = { 'asaas-access-token': TOKEN };

const V1 = 'c1_2030-01-02_09:00_1';
const V2 = 'c1_2030-01-02_09:30_1';
const V3 = 'c1_2030-01-02_10:00_1';

const pendente = () => ({ status: 'pendente', checkoutId: 'chk-1', venceEm: new Date(AGORA.getTime() + 600_000) });

// Reserva nova: 3 vagas (vagasIds). Reserva antiga: só vagaId.
function montar({ ag = {}, extra = {}, nova = true } = {}) {
  const db = criarBanco({
    'agendamentos/ag1': {
      clienteId: 'ana',
      status: 'agendado',
      total: 26499,
      vagaId: V1,
      ...(nova ? { vagasIds: [V1, V2, V3] } : {}),
      pagamento: pendente(),
      ...ag
    },
    [`ocupacao/${V1}`]: { agendamentoId: 'ag1' },
    ...(nova ? { [`ocupacao/${V2}`]: { agendamentoId: 'ag1' }, [`ocupacao/${V3}`]: { agendamentoId: 'ag1' } } : {}),
    ...extra
  });
  return { db, deps: { db, env: { ASAAS_WEBHOOK_TOKEN: TOKEN }, agora: () => AGORA } };
}

const evento = (event, id = 'evt_1') => ({ id, event, checkout: { id: 'chk-1', externalReference: 'ag1' } });
const enviar = (deps, corpo) => processarWebhook(deps, cab, corpo);
const vagas = (db) => [...db.docs.keys()].filter((k) => k.startsWith('ocupacao/')).sort();

test('reserva de 3 vagas expirada libera as 3, junto com o cancelamento', async () => {
  const { db, deps } = montar();
  const r = await enviar(deps, evento('CHECKOUT_EXPIRED'));
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado, 'agendamento_cancelado');
  assert.deepEqual(vagas(db), []);
  assert.equal(db.docs.get('agendamentos/ag1').status, 'cancelado');
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'expirado');
});

test('cancelado (CHECKOUT_CANCELED) também libera as 3', async () => {
  const { db, deps } = montar();
  await enviar(deps, evento('CHECKOUT_CANCELED'));
  assert.deepEqual(vagas(db), []);
});

test('reserva antiga (só vagaId) libera a única vaga, como antes', async () => {
  const { db, deps } = montar({ nova: false });
  const r = await enviar(deps, evento('CHECKOUT_EXPIRED'));
  assert.equal(r.corpo.resultado, 'agendamento_cancelado');
  assert.deepEqual(vagas(db), []);
});

test('reserva antiga sem o documento da vaga: cancela e não falha', async () => {
  const { db, deps } = montar({ nova: false });
  db.docs.delete(`ocupacao/${V1}`);
  const r = await enviar(deps, evento('CHECKOUT_EXPIRED'));
  assert.equal(r.status, 200);
  assert.equal(db.docs.get('agendamentos/ag1').status, 'cancelado');
});

test('evento repetido: a segunda entrega é "duplicado" e não apaga a vaga que outra reserva pegou depois', async () => {
  const { db, deps } = montar();
  await enviar(deps, evento('CHECKOUT_EXPIRED', 'evt_x'));
  assert.deepEqual(vagas(db), []);
  db.docs.set(`ocupacao/${V2}`, { agendamentoId: 'outra' }); // outra reserva ocupou a vaga liberada
  const r = await enviar(deps, evento('CHECKOUT_EXPIRED', 'evt_x'));
  assert.equal(r.corpo.resultado, 'duplicado');
  assert.deepEqual(vagas(db), [`ocupacao/${V2}`]);
});

test('evento com id novo para agendamento já cancelado não apaga vaga de outra reserva', async () => {
  const { db, deps } = montar();
  await enviar(deps, evento('CHECKOUT_EXPIRED', 'evt_a'));
  db.docs.set(`ocupacao/${V3}`, { agendamentoId: 'outra' });
  await enviar(deps, evento('CHECKOUT_CANCELED', 'evt_b'));
  assert.deepEqual(vagas(db), [`ocupacao/${V3}`]);
});

test('só apaga vaga que ainda é DESTE agendamento (vaga reaproveitada por outro fica)', async () => {
  const { db, deps } = montar({ extra: { [`ocupacao/${V2}`]: { agendamentoId: 'outra' } } });
  await enviar(deps, evento('CHECKOUT_EXPIRED'));
  assert.deepEqual(vagas(db), [`ocupacao/${V2}`]);
  assert.equal(db.docs.get(`ocupacao/${V2}`).agendamentoId, 'outra');
});

test('fora de ordem (1): pago chega primeiro, expirado depois: nada é liberado', async () => {
  const { db, deps } = montar();
  const pago = await enviar(deps, evento('CHECKOUT_PAID', 'evt_p'));
  assert.equal(pago.corpo.resultado, 'pago');
  const exp = await enviar(deps, evento('CHECKOUT_EXPIRED', 'evt_e'));
  assert.equal(exp.corpo.resultado, 'ignorado_pago');
  assert.equal(vagas(db).length, 3);
  assert.equal(db.docs.get('agendamentos/ag1').status, 'agendado');
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.status, 'pago');
});

test('fora de ordem (2): expirado primeiro, pago depois: vagas já liberadas, pagamento sinalizado, nada é reocupado', async () => {
  const { db, deps } = montar();
  await enviar(deps, evento('CHECKOUT_EXPIRED', 'evt_e'));
  const pago = await enviar(deps, evento('CHECKOUT_PAID', 'evt_p'));
  assert.equal(pago.corpo.resultado, 'pago_apos_cancelamento');
  assert.deepEqual(vagas(db), []);
  assert.equal(db.docs.get('agendamentos/ag1').status, 'cancelado');
  assert.equal(db.docs.get('agendamentos/ag1').pagamento.revisao, true);
});

test('pago e depois expirado ou cancelado (qualquer número de vezes) não libera nenhuma vaga', async () => {
  const { db, deps } = montar({ ag: { pagamento: { ...pendente(), status: 'pago', pagoEm: AGORA } } });
  for (const [tipo, id] of [['CHECKOUT_EXPIRED', 'e1'], ['CHECKOUT_CANCELED', 'e2'], ['CHECKOUT_EXPIRED', 'e3']]) {
    const r = await enviar(deps, evento(tipo, id));
    assert.equal(r.status, 200);
    assert.equal(r.corpo.resultado, 'ignorado_pago');
  }
  assert.equal(vagas(db).length, 3);
});

test('pago com valor divergente (dinheiro recebido) também não libera vagas', async () => {
  const { db, deps } = montar({ ag: { pagamento: { ...pendente(), status: 'divergente', revisao: true } } });
  const r = await enviar(deps, evento('CHECKOUT_EXPIRED'));
  assert.equal(r.corpo.resultado, 'ignorado_pago');
  assert.equal(vagas(db).length, 3);
});

test('agendamento em andamento não é cancelado nem perde vagas por checkout expirado', async () => {
  const { db, deps } = montar({ ag: { status: 'em_andamento' } });
  const r = await enviar(deps, evento('CHECKOUT_EXPIRED'));
  assert.equal(r.corpo.resultado, 'status_atualizado');
  assert.equal(vagas(db).length, 3);
});

test('checkout antigo (já trocado) não libera nada', async () => {
  const { db, deps } = montar();
  const r = await enviar(deps, { id: 'evt_old', event: 'CHECKOUT_EXPIRED', checkout: { id: 'chk-antigo', externalReference: 'ag1' } });
  assert.equal(r.corpo.resultado, 'ignorado_checkout_antigo');
  assert.equal(vagas(db).length, 3);
});

test('liberação e mudança de status são atômicas: falha de gravação lança (vira 5xx) e nada fica pela metade', async () => {
  const { db, deps } = montar();
  const original = db.runTransaction.bind(db);
  db.runTransaction = (fn) =>
    original(async (tx) => {
      const r = await fn(tx);
      throw new Error('falha de gravação simulada'); // o commit não chega a acontecer
    });
  await assert.rejects(enviar(deps, evento('CHECKOUT_EXPIRED')), /falha de gravação/);
  assert.equal(db.docs.get('agendamentos/ag1').status, 'agendado');
  assert.equal(vagas(db).length, 3);
  assert.equal([...db.docs.keys()].some((k) => k.startsWith('eventosAsaas/')), false, 'o evento não foi marcado como processado: o Asaas pode reenviar');
});

test('vagasIds malformados ou estranhos são ignorados; o vagaId continua valendo', () => {
  assert.deepEqual(vagasDoAgendamento({ vagaId: V1, vagasIds: [V1, V2, 7, null, '../x', 'a b'] }), [V1, V2]);
  assert.deepEqual(vagasDoAgendamento({ vagaId: V1 }), [V1]);
  assert.deepEqual(vagasDoAgendamento({ vagasIds: [V2] }), [V2]);
  assert.deepEqual(vagasDoAgendamento({}), []);
  assert.equal(vagasDoAgendamento({ vagasIds: Array.from({ length: 100 }, (_, i) => `v${i}`) }).length, 40);
});

test('depois de liberar, uma nova reserva consegue as mesmas vagas (fim a fim com a API de criar)', async () => {
  const { criarAgendamento } = await import('../_lib/agendamento.js');
  const { criarAuth } = await import('./_falso.js');
  const { db, deps } = montar({
    extra: {
      'condominios/c1': { capacidade: 1 },
      'servicos/medio': { nome: 'Polimento', precoCentavos: 19999, duracaoMin: 90, ativo: true, categoria: 'lavagem' },
      'users/bia': { role: 'cliente', condominioId: 'c1', nome: 'Bia' }
    }
  });
  const criar = () =>
    criarAgendamento({ db, auth: criarAuth({ 'tok-bia': 'bia' }), agora: () => AGORA }, 'Bearer tok-bia', {
      servicos: ['medio'], data: '2030-01-02', hora: '09:00', veiculo: { modelo: 'Gol', placa: 'ABC1D23' }
    });
  await assert.rejects(criar(), (e) => e.status === 409); // ocupado pelo ag1
  await enviar(deps, evento('CHECKOUT_EXPIRED'));
  const r = await criar();
  assert.deepEqual(r.vagasIds, [V1, V2, V3]);
});
