import { describe, it, expect } from 'vitest';
import { resumoCliente, resumoFuncionario } from './usuario-resumo';

const hoje = new Date('2030-06-01T12:00:00');
const ag = (extra: Record<string, unknown>) =>
  ({
    status: 'finalizado',
    total: 10000,
    data: '2030-05-20',
    itens: [{ servicoId: 's1', nome: 'Banho', precoCentavos: 10000 }],
    pagamento: null,
    avaliacao: null,
    ...extra
  }) as any;

describe('resumoCliente', () => {
  it('conta por status, soma só pagamentos confirmados e ignora cancelados nos mais usados', () => {
    const r = resumoCliente(
      [
        ag({ pagamento: { status: 'pago' } }),
        ag({ status: 'agendado', pagamento: { status: 'pendente' } }),
        ag({ status: 'cancelado', pagamento: { status: 'cancelado' }, itens: [{ nome: 'Cera' }] }),
        ag({ pagamento: { status: 'pago_apos_cancelamento' } }),
        ag({ pagamento: { status: 'divergente' } })
      ],
      hoje
    );
    expect(r.porStatus).toEqual({ agendado: 1, em_andamento: 0, finalizado: 3, cancelado: 1 });
    expect(r.total).toBe(5);
    expect(r.pagoCentavos).toBe(10000);
    expect(r.maisUsados).toEqual([{ nome: 'Banho', vezes: 4 }]);
  });

  it('avaliações: quantidade e média; sem avaliações a média é null', () => {
    expect(resumoCliente([ag({})], hoje).avaliacoes).toEqual({ quantidade: 0, media: null });
    const r = resumoCliente([ag({ avaliacao: { nota: 5 } }), ag({ avaliacao: { nota: 4 } })], hoje);
    expect(r.avaliacoes).toEqual({ quantidade: 2, media: 4.5 });
  });

  it('nível segue a regra do cliente: finalizados dos últimos 90 dias', () => {
    expect(resumoCliente([], hoje).nivel).toBe('Bronze');
    const quatro = [1, 2, 3, 4].map(() => ag({ total: 25000 })); // R$ 1000 em 90 dias
    expect(resumoCliente(quatro, hoje).nivel).toBe('Ouro');
    expect(resumoCliente(quatro.map((a) => ({ ...a, data: '2029-01-01' })), hoje).nivel).toBe('Bronze');
  });
});

describe('resumoFuncionario', () => {
  it('conta finalizados e em andamento', () => {
    expect(
      resumoFuncionario([ag({}), ag({}), ag({ status: 'em_andamento' }), ag({ status: 'agendado' })])
    ).toEqual({ finalizados: 2, emAndamento: 1 });
  });
});
