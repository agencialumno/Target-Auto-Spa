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
