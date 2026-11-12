import { describe, it, expect } from 'vitest';
import { avaliacoesDe, duracaoDoCatalogo, emAbertoPrimeiro, filtrarAgendamentos, linhaDoTempo, pagamentosDe } from './usuario-detalhe';

const d = (s: string) => new Date(s);
const ag = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    status: 'finalizado',
    total: 10000,
    itens: [{ servicoId: 'eco01', nome: 'Banho Básico', precoCentavos: 10000 }],
    pagamento: null,
    avaliacao: null,
    checklist: { fotos: {} },
    criadoEm: null,
    ...extra
  }) as any;

describe('filtros e ordem', () => {
  const lista = [ag('a', { status: 'finalizado' }), ag('b', { status: 'agendado' }), ag('c', { status: 'cancelado' }), ag('d', { status: 'em_andamento' })];
  it('filtra por grupo', () => {
    expect(filtrarAgendamentos(lista, 'abertos').map((a) => a.id)).toEqual(['b', 'd']);
    expect(filtrarAgendamentos(lista, 'concluidos').map((a) => a.id)).toEqual(['a']);
    expect(filtrarAgendamentos(lista, 'cancelados').map((a) => a.id)).toEqual(['c']);
    expect(filtrarAgendamentos(lista, 'todos')).toHaveLength(4);
  });
  it('em aberto vão para o topo e mantêm a ordem relativa', () => {
    expect(emAbertoPrimeiro(lista).map((a) => a.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('pagamentos e avaliações', () => {
  it('só agendamentos com cobrança; valor = total; data do pagamento', () => {
    const r = pagamentosDe([ag('a'), ag('b', { pagamento: { status: 'pago', pagoEm: d('2030-01-02') }, total: 6500 }), ag('c', { pagamento: { status: 'pendente' } })]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ agendamentoId: 'b', valorCentavos: 6500, status: 'pago', servicos: 'Banho Básico' });
    expect(r[0].pagoEm).toEqual(d('2030-01-02'));
    expect(r[1].pagoEm).toBeNull();
  });
  it('avaliações com nota, indicação 0 a 10, comentário e serviço', () => {
    const r = avaliacoesDe([ag('a'), ag('b', { avaliacao: { nota: 5, nps: 9, comentario: 'ótimo', em: d('2030-01-03') } }), ag('c', { avaliacao: { nota: 3, comentario: '' } })]);
    expect(r).toEqual([
      { agendamentoId: 'b', nota: 5, nps: 9, comentario: 'ótimo', servicos: 'Banho Básico', em: d('2030-01-03') },
      { agendamentoId: 'c', nota: 3, nps: null, comentario: '', servicos: 'Banho Básico', em: null }
    ]);
  });
});

describe('duração e linha do tempo', () => {
  it('duração vem do catálogo; serviço desconhecido => null', () => {
    expect(duracaoDoCatalogo(ag('a'))).toBe(30);
    expect(duracaoDoCatalogo(ag('a', { itens: [{ servicoId: 'nao-existe' }] }))).toBeNull();
  });
  it('linha do tempo usa só as datas registradas, em ordem', () => {
    const t = linhaDoTempo(
      ag('a', {
        criadoEm: d('2030-01-01T10:00:00Z'),
        pagamento: { status: 'pago', pagoEm: d('2030-01-01T10:05:00Z') },
        checklist: { fotos: { antes_frente: { em: d('2030-01-02T09:10:00Z') }, antes_tras: { em: d('2030-01-02T09:05:00Z') }, depois_frente: { em: d('2030-01-02T09:40:00Z') }, depois_tras: { em: d('2030-01-02T09:50:00Z') } } },
        avaliacao: { nota: 5, em: d('2030-01-03T08:00:00Z') },
        atualizadoEm: d('2030-01-02T09:55:00Z')
      })
    );
    expect(t.map((m) => m.texto)).toEqual([
      'Agendamento criado',
      'Pagamento confirmado',
      'Primeira foto do antes (atendimento começou)',
      'Última foto do depois',
      'Última atualização do agendamento',
      'Avaliado pelo cliente'
    ]);
    expect(t[2].em).toEqual(d('2030-01-02T09:05:00Z'));
    expect(t[3].em).toEqual(d('2030-01-02T09:50:00Z'));
    expect(linhaDoTempo(ag('x'))).toEqual([]);
  });
});
