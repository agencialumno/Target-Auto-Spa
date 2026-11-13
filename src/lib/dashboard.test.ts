import { describe, it, expect } from 'vitest';
import { cartoesTempoReal, detalharPeriodo, limitesDoPeriodo, rentabilidade, ticketMedio } from './dashboard';

const ag = (extra: Record<string, unknown>) =>
  ({
    status: 'finalizado',
    data: '2030-06-10',
    inicio: new Date('2030-06-10T12:00:00'),
    itens: [{ nome: 'Banho' }],
    funcionarioId: null,
    funcionarioNome: null,
    avaliacao: null,
    pagamento: null,
    ...extra
  }) as any;

describe('limitesDoPeriodo', () => {
  it('intervalo [início do 1º mês, início do mês seguinte ao último)', () => {
    const l = limitesDoPeriodo('2030-11', '2030-12')!;
    expect(l.inicio.getMonth()).toBe(10);
    expect(l.fim.getFullYear()).toBe(2031);
    expect(l.fim.getMonth()).toBe(0);
    expect(l.fim.getDate()).toBe(1);
  });
  it('recusa período inválido ou invertido', () => {
    expect(limitesDoPeriodo('2030-5', '2030-06')).toBeNull();
    expect(limitesDoPeriodo('2030-06', '2030-05')).toBeNull();
  });
});

describe('rentabilidade', () => {
  it('receita menos custos; margem em %; sem receita não há margem', () => {
    expect(rentabilidade(100000, 40000)).toEqual({ faturamentoCentavos: 100000, custosCentavos: 40000, resultadoCentavos: 60000, margemPct: 60 });
    expect(rentabilidade(0, 5000)).toMatchObject({ resultadoCentavos: -5000, margemPct: null });
  });
  it('ticket médio', () => {
    expect(ticketMedio(10001, 2)).toBe(5001);
    expect(ticketMedio(100, 0)).toBe(0);
  });
});

describe('cartoesTempoReal', () => {
  const agora = new Date('2030-06-10T10:00:00');
  it('conta hoje (sem cancelados), em atendimento, aguardando pagamento e o próximo', () => {
    const r = cartoesTempoReal(
      [
        ag({ status: 'agendado', pagamento: { status: 'pendente' }, inicio: new Date('2030-06-10T14:00:00') }),
        ag({ status: 'em_andamento' }),
        ag({ status: 'cancelado' }),
        ag({ status: 'agendado', data: '2030-06-11', inicio: new Date('2030-06-11T09:00:00'), pagamento: { status: 'pago' } })
      ],
      agora
    );
    expect(r.hoje).toBe(2);
    expect(r.emAtendimento).toBe(1);
    expect(r.aguardandoPagamento).toBe(1);
    expect(r.proximo!.inicio.getHours()).toBe(14);
  });
});

describe('detalharPeriodo', () => {
  it('ranking de serviços e desempenho por funcionário só com finalizados; nota média geral', () => {
    const d = detalharPeriodo([
      ag({ funcionarioId: 'f1', funcionarioNome: 'Ana', avaliacao: { nota: 5 } }),
      ag({ funcionarioId: 'f1', funcionarioNome: 'Ana', avaliacao: { nota: 4 }, itens: [{ nome: 'Cera' }] }),
      ag({ funcionarioId: 'f2', funcionarioNome: 'Bia' }),
      ag({ status: 'cancelado', itens: [{ nome: 'Cera' }, { nome: 'Cera' }] })
    ]);
    expect(d.servicos).toEqual([{ nome: 'Banho', vezes: 2 }, { nome: 'Cera', vezes: 1 }]);
    expect(d.funcionarios).toEqual([
      { id: 'f1', nome: 'Ana', finalizados: 2, notaMedia: 4.5 },
      { id: 'f2', nome: 'Bia', finalizados: 1, notaMedia: null }
    ]);
    expect(d.notaMedia).toBe(4.5);
    expect(d.truncado).toBe(false);
  });
  it('avisa quando atinge o teto de leitura', () => {
    expect(detalharPeriodo(Array.from({ length: 500 }, () => ag({}))).truncado).toBe(true);
  });
});

import { filtrarAgendamentos, lerFiltro, periodoPreset, variacaoPct } from './dashboard';

describe('períodos rápidos e filtros', () => {
  const ref = new Date(2030, 4, 15, 10, 0);
  it('hoje, 7 dias e mês, com o período anterior de mesmo tamanho', () => {
    const h = periodoPreset('hoje', ref);
    expect(h.inicio).toEqual(new Date(2030, 4, 15));
    expect(h.fim).toEqual(new Date(2030, 4, 16));
    expect(h.anteriorInicio).toEqual(new Date(2030, 4, 14));
    const s = periodoPreset('7d', ref);
    expect(s.inicio).toEqual(new Date(2030, 4, 9));
    expect(s.anteriorInicio).toEqual(new Date(2030, 4, 2));
    expect(s.anteriorFim).toEqual(s.inicio);
    const m = periodoPreset('mes', ref);
    expect([m.de, m.ate]).toEqual(['2030-05', '2030-05']);
    expect(m.anteriorInicio).toEqual(new Date(2030, 3, 1));
  });
  it('7 dias que cruzam o mês', () => {
    const s = periodoPreset('7d', new Date(2030, 4, 3));
    expect([s.de, s.ate]).toEqual(['2030-04', '2030-05']);
  });
  it('variação: sem base anterior não há variação', () => {
    expect(variacaoPct(150, 100)).toBe(50);
    expect(variacaoPct(50, 100)).toBe(-50);
    expect(variacaoPct(5, 0)).toBeNull();
  });
  it('lerFiltro ignora valores desconhecidos', () => {
    expect(lerFiltro(new URLSearchParams('status=agendado&pagamento=pago&periodo=hoje'))).toEqual({ status: 'agendado', pagamento: 'pago', periodo: 'hoje' });
    expect(lerFiltro(new URLSearchParams('status=xx&pagamento=yy&periodo=zz'))).toEqual({});
  });
  it('filtrarAgendamentos', () => {
    const a = (id: string, status: string, inicio: Date, pg?: string) => ({ id, status, inicio, pagamento: pg ? { status: pg } : undefined }) as any;
    const ags = [
      a('1', 'agendado', new Date(2030, 4, 15, 9), 'pendente'),
      a('2', 'finalizado', new Date(2030, 4, 15, 11), 'pago'),
      a('3', 'agendado', new Date(2030, 4, 1, 9)),
      a('4', 'cancelado', new Date(2030, 4, 15, 8), 'pendente')
    ];
    const ids = (f: any) => filtrarAgendamentos(ags, f, ref).map((x) => x.id);
    expect(ids({ pagamento: 'pendente' })).toEqual(['1']);
    expect(ids({ pagamento: 'pago' })).toEqual(['2']);
    expect(ids({ status: 'agendado', periodo: 'hoje' })).toEqual(['1']);
    expect(ids({ periodo: 'mes' })).toEqual(['1', '2', '3', '4']);
    expect(ids({})).toHaveLength(4);
  });
});
