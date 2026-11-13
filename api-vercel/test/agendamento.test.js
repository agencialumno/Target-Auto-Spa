import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAgendamento, slotsCobertos, idAgendamento, inicioDe } from '../_lib/agendamento.js';
import { criarAuth, criarBanco, bearer, status } from './_falso.js';

// 2030-01-01 12:00 UTC = 09:00 em Brasília
const AGORA = new Date('2030-01-01T12:00:00Z');
const AMANHA = '2030-01-02';
const VEICULO = { modelo: 'Gol', placa: 'ABC1D23' };

const servico = (extra = {}) => ({ nome: 'Banho', precoCentavos: 6500, duracaoMin: 30, ativo: true, categoria: 'lavagem', ...extra });

function montar({ capacidade = 1, extra = {}, usuarios = ['ana', 'bia', 'caio'] } = {}) {
  const docs = {
    'condominios/c1': { nome: 'Sol', capacidade },
    'servicos/curto': servico(),
    'servicos/medio': servico({ nome: 'Polimento', precoCentavos: 19999, duracaoMin: 90 }),
    'servicos/longo': servico({ nome: 'Higienização', precoCentavos: 40000, duracaoMin: 240 }),
    'servicos/inativo': servico({ ativo: false }),
    'servicos/ins1': servico({ nome: 'Insulfilm', precoCentavos: 35000, duracaoMin: 90, categoria: 'insulfilm' }),
    'config/insulfilm': { capacidade: 1 },
    ...extra
  };
  for (const u of usuarios) docs[`users/${u}`] = { role: 'cliente', condominioId: 'c1', nome: u.toUpperCase() };
  const db = criarBanco(docs);
  const tokens = Object.fromEntries(usuarios.map((u) => [`tok-${u}`, u]));
  const deps = { auth: criarAuth(tokens), db, agora: () => AGORA };
  const chamar = (quem, corpo, depsExtra = {}) =>
    criarAgendamento({ ...deps, ...depsExtra }, bearer(`tok-${quem}`), { servicos: ['curto'], data: AMANHA, hora: '09:00', veiculo: VEICULO, ...corpo });
  const vagas = () => [...db.docs.keys()].filter((k) => k.startsWith('ocupacao/')).sort();
  const ags = () => [...db.docs.keys()].filter((k) => k.startsWith('agendamentos/'));
  return { db, deps, chamar, vagas, ags };
}

test('slotsCobertos: a duração define quantos horários de 30 min são segurados', () => {
  assert.deepEqual(slotsCobertos('09:00', 30), ['09:00']);
  assert.deepEqual(slotsCobertos('09:00', 90), ['09:00', '09:30', '10:00']);
  assert.deepEqual(slotsCobertos('09:00', 45), ['09:00', '09:30']);
  assert.deepEqual(slotsCobertos('13:30', 120), ['13:30', '14:00', '14:30', '15:00']);
});

test('serviço de 90 min segura 09:00, 09:30 e 10:00 numa transação; preço e total vêm do catálogo', async () => {
  const t = montar();
  const r = await t.chamar('ana', { servicos: ['medio'], precoCentavos: 1, total: 1 });
  assert.equal(r.total, 19999);
  assert.deepEqual(r.vagasIds, ['c1_2030-01-02_09:00_1', 'c1_2030-01-02_09:30_1', 'c1_2030-01-02_10:00_1']);
  assert.deepEqual(t.vagas(), r.vagasIds.map((v) => `ocupacao/${v}`).sort());
  const ag = t.db.docs.get(`agendamentos/${r.id}`);
  assert.equal(ag.vagaId, 'c1_2030-01-02_09:00_1');
  assert.deepEqual(ag.vagasIds, r.vagasIds);
  assert.equal(ag.clienteId, 'ana');
  assert.equal(ag.status, 'agendado');
  assert.equal(ag.duracaoMin, 90);
  assert.equal(ag.itens[0].precoCentavos, 19999);
  assert.equal(ag.inicio.toISOString(), '2030-01-02T12:00:00.000Z');
  assert.equal(t.db.docs.get(`ocupacao/${r.vagasIds[1]}`).agendamentoId, r.id);
});

test('serviço curto (30 min) segura só um horário', async () => {
  const t = montar();
  const r = await t.chamar('ana', {});
  assert.equal(r.vagasIds.length, 1);
});

test('corrida: dois clientes pelo mesmo horário (capacidade 1) -> um agenda, o outro recebe "indisponível"', async () => {
  const t = montar();
  const res = await Promise.allSettled([t.chamar('ana', { servicos: ['medio'] }), t.chamar('bia', { servicos: ['medio'] })]);
  const ok = res.filter((r) => r.status === 'fulfilled');
  const falha = res.filter((r) => r.status === 'rejected');
  assert.equal(ok.length, 1);
  assert.equal(falha.length, 1);
  assert.equal(falha[0].reason.status, 409);
  assert.match(falha[0].reason.message, /indispon/i);
  assert.equal(t.ags().length, 1);
  assert.equal(t.vagas().length, 3);
});

test('corrida com capacidade 2 e três clientes: dois agendam, o terceiro não; vagas 1 e 2 sem repetir', async () => {
  const t = montar({ capacidade: 2 });
  const res = await Promise.allSettled(['ana', 'bia', 'caio'].map((q) => t.chamar(q, { servicos: ['medio'] })));
  assert.equal(res.filter((r) => r.status === 'fulfilled').length, 2);
  assert.equal(res.filter((r) => r.status === 'rejected' && r.reason.status === 409).length, 1);
  assert.equal(t.vagas().length, 6);
  assert.equal(new Set(t.vagas()).size, 6);
});

test('sobreposição parcial: serviço longo das 09:00 às 10:30 bloqueia 10:00, mas 10:30 fica livre', async () => {
  const t = montar();
  await t.chamar('ana', { servicos: ['medio'] });
  assert.equal(await status(t.chamar('bia', { hora: '10:00' })), 409);
  assert.equal(await status(t.chamar('bia', { hora: '09:30' })), 409);
  assert.equal(await status(t.chamar('bia', { hora: '10:30' })), 0);
});

test('um horário no meio do serviço ocupado impede o serviço longo inteiro (nada é gravado)', async () => {
  const t = montar({ extra: { 'ocupacao/c1_2030-01-02_10:00_1': { condominioId: 'c1', data: AMANHA, hora: '10:00', externo: false, agendamentoId: 'antigo' }, 'agendamentos/antigo': { status: 'agendado' } } });
  assert.equal(await status(t.chamar('ana', { servicos: ['medio'] })), 409);
  assert.deepEqual(t.vagas(), ['ocupacao/c1_2030-01-02_10:00_1']);
  assert.equal(t.ags().length, 1); // só o "antigo"
});

test('reserva feita por build antiga (1 vaga no Firestore) é respeitada; capacidade 2 usa a vaga 2 só onde precisa', async () => {
  const t = montar({ capacidade: 2, extra: { 'ocupacao/c1_2030-01-02_09:30_1': { condominioId: 'c1', data: AMANHA, hora: '09:30', externo: false, agendamentoId: 'antigo' }, 'agendamentos/antigo': { status: 'agendado' } } });
  const r = await t.chamar('ana', { servicos: ['medio'] });
  assert.deepEqual(r.vagasIds, ['c1_2030-01-02_09:00_1', 'c1_2030-01-02_09:30_2', 'c1_2030-01-02_10:00_1']);
});

test('vaga que sobrou de agendamento cancelado conta como livre', async () => {
  const t = montar({ extra: { 'ocupacao/c1_2030-01-02_09:30_1': { condominioId: 'c1', data: AMANHA, hora: '09:30', externo: false, agendamentoId: 'velho' }, 'agendamentos/velho': { status: 'cancelado' } } });
  const r = await t.chamar('ana', { servicos: ['medio'] });
  assert.equal(r.vagasIds[1], 'c1_2030-01-02_09:30_1');
  assert.equal(t.db.docs.get('ocupacao/c1_2030-01-02_09:30_1').agendamentoId, r.id);
});

test('idempotente: repetir com a mesma chave devolve o mesmo agendamento, sem duplicar vagas', async () => {
  const t = montar();
  const a = await t.chamar('ana', { servicos: ['medio'], chave: 'chave-aleatoria-1' });
  const b = await t.chamar('ana', { servicos: ['medio'], chave: 'chave-aleatoria-1' });
  assert.equal(a.id, b.id);
  assert.equal(a.jaExistia, false);
  assert.equal(b.jaExistia, true);
  assert.equal(t.ags().length, 1);
  assert.equal(t.vagas().length, 3);
  assert.equal(a.id, idAgendamento('ana', 'chave-aleatoria-1'));
});

test('idempotente na corrida: duas chamadas simultâneas com a mesma chave criam um só', async () => {
  const t = montar();
  const [a, b] = await Promise.all([t.chamar('ana', { chave: 'chave-aleatoria-2' }), t.chamar('ana', { chave: 'chave-aleatoria-2' })]);
  assert.equal(a.id, b.id);
  assert.equal(t.ags().length, 1);
});

test('a mesma chave com outro horário é recusada', async () => {
  const t = montar();
  await t.chamar('ana', { chave: 'chave-aleatoria-3' });
  assert.equal(await status(t.chamar('ana', { chave: 'chave-aleatoria-3', hora: '11:00' })), 409);
});

test('a chave de um cliente não colide com a de outro', async () => {
  const t = montar({ capacidade: 2 });
  const a = await t.chamar('ana', { chave: 'chave-comum-12' });
  const b = await t.chamar('bia', { chave: 'chave-comum-12' });
  assert.notEqual(a.id, b.id);
});

test('janela: 18:00 de fechamento, passado, antecedência e 14 dias', async () => {
  const t = montar();
  assert.equal(await status(t.chamar('ana', { servicos: ['longo'], hora: '16:00' })), 400); // 4 h a partir das 16:00 passa das 18:00
  assert.equal(await status(t.chamar('ana', { servicos: ['longo'], hora: '14:00' })), 0); // termina às 18:00 em ponto
  assert.equal(await status(t.chamar('ana', { data: '2030-01-01', hora: '08:30' })), 400); // já passou (agora = 09:00)
  assert.equal(await status(t.chamar('ana', { data: '2030-01-01', hora: '09:00' })), 400); // exatamente agora: não é depois
  assert.equal(await status(t.chamar('bia', { data: '2030-01-01', hora: '09:30' })), 0);
  assert.equal(await status(t.chamar('ana', { data: '2029-12-31' })), 400);
  assert.equal(await status(t.chamar('ana', { data: '2030-01-20' })), 400);
  assert.equal(await status(t.chamar('ana', { data: '2030-01-14' })), 0); // hoje + 13 = último dia da grade (14 dias)
  assert.equal(await status(t.chamar('bia', { data: '2030-01-15' })), 400); // hoje + 14: a grade não mostra
  assert.equal(await status(t.chamar('ana', { hora: '07:30' })), 400);
  assert.equal(await status(t.chamar('ana', { hora: '09:15' })), 400); // fora da grade de 30 min
});

test('validações do pedido: placa, serviços, data', async () => {
  const t = montar();
  assert.equal(await status(t.chamar('ana', { veiculo: { modelo: 'X', placa: '123' } })), 400);
  assert.equal(await status(t.chamar('ana', { servicos: [] })), 400);
  assert.equal(await status(t.chamar('ana', { servicos: ['curto', 'curto'] })), 400);
  assert.equal(await status(t.chamar('ana', { servicos: ['../x'] })), 400);
  assert.equal(await status(t.chamar('ana', { data: 'amanhã' })), 400);
  assert.equal(await status(t.chamar('ana', { chave: 'curta' })), 400);
});

test('serviço inativo ou inexistente: 409; insulfilm misturado: 409', async () => {
  const t = montar();
  assert.equal(await status(t.chamar('ana', { servicos: ['inativo'] })), 409);
  assert.equal(await status(t.chamar('ana', { servicos: ['nao-existe'] })), 409);
  assert.equal(await status(t.chamar('ana', { servicos: ['curto', 'ins1'], hora: '09:00' })), 409);
});

test('papel e condomínio: só cliente com condomínio; token inválido é 401', async () => {
  const t = montar({ extra: { 'users/adm': { role: 'admin', condominioId: null }, 'users/sem': { role: 'cliente', condominioId: null } } });
  t.deps.auth = criarAuth({ 'tok-adm': 'adm', 'tok-sem': 'sem', 'tok-ana': 'ana' });
  const chamarComo = (tok, corpo = {}) => status(criarAgendamento(t.deps, bearer(tok), { servicos: ['curto'], data: AMANHA, hora: '09:00', veiculo: VEICULO, ...corpo }));
  assert.equal(await chamarComo('tok-adm'), 403);
  assert.equal(await chamarComo('tok-sem'), 403);
  assert.equal(await chamarComo('tok-ruim'), 401);
  assert.equal(await chamarComo('tok-ana'), 0);
});

test('o condomínio vem do perfil, nunca do pedido', async () => {
  const t = montar();
  const r = await t.chamar('ana', { condominioId: 'outro' });
  assert.equal(t.db.docs.get(`agendamentos/${r.id}`).condominioId, 'c1');
  assert.ok(r.vagasIds[0].startsWith('c1_'));
});

test('insulfilm: horário fixo, 36 h de antecedência, vaga ext_ e capacidade de config/insulfilm', async () => {
  const t = montar();
  const livre = '2030-01-04'; // > 36 h depois de 2030-01-01 09:00
  assert.equal(await status(t.chamar('ana', { servicos: ['ins1'], data: livre, hora: '10:00' })), 400); // fora da agenda
  assert.equal(await status(t.chamar('ana', { servicos: ['ins1'], data: '2030-01-02', hora: '09:00' })), 400); // < 36 h
  const r = await t.chamar('ana', { servicos: ['ins1'], data: livre, hora: '09:00' });
  assert.deepEqual(r.vagasIds, ['ext_2030-01-04_09:00_1', 'ext_2030-01-04_09:30_1', 'ext_2030-01-04_10:00_1']);
  assert.equal(t.db.docs.get(`agendamentos/${r.id}`).externo, true);
  // a agenda do insulfilm é única: outro cliente (de qualquer condomínio) não pega o mesmo horário
  assert.equal(await status(t.chamar('bia', { servicos: ['ins1'], data: livre, hora: '09:00' })), 409);
});

test('inicioDe usa o horário de Brasília', () => {
  assert.equal(inicioDe('2030-05-10', '09:00').toISOString(), '2030-05-10T12:00:00.000Z');
});
