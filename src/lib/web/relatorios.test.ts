import { describe, it, expect } from 'vitest';
import {
  agendamentosPorStatus,
  custosPorCategoria,
  desempenhoPorFuncionario,
  faturamentoPorDia,
  faturamentoPorServico
} from './relatorios';

const ag = (o: Record<string, unknown>) =>
  ({
    data: '2026-03-02',
    status: 'finalizado',
    total: 10000,
    itens: [{ servicoId: 's', nome: 'Lavagem', precoCentavos: 10000 }],
    funcionarioId: 'f1',
    funcionarioNome: 'Zé',
    avaliacao: null,
    pagamento: { status: 'pago', pagoEm: new Date(2026, 2, 2, 10) },
    ...o
  }) as any;

const pagosDe = (l: any[]) => l.filter((a) => a.pagamento?.status === 'pago');
const lista = [
  ag({}),
  ag({ data: '2026-03-02', total: 5000, itens: [{ nome: 'Cera', precoCentavos: 5000 }], avaliacao: { nota: 5 } }),
  ag({ data: '2026-03-03', pagamento: { status: 'pendente' }, status: 'agendado' }),
  ag({ data: '2026-03-04', status: 'cancelado', pagamento: null, funcionarioId: null })
];

describe('relatórios', () => {
  it('faturamento por dia usa a data do PAGAMENTO, não a do agendamento', () => {
    expect(faturamentoPorDia(pagosDe(lista))).toEqual([{ rotulo: '2026-03-02', quantidade: 2, centavos: 15000 }]);
  });
  it('pago em outro dia que o agendamento cai no dia do pagamento', () => {
    const a = ag({ data: '2026-03-01', pagamento: { status: 'pago', pagoEm: new Date(2026, 2, 5, 9) } });
    expect(faturamentoPorDia([a]).map((l) => l.rotulo)).toEqual(['2026-03-05']);
  });
  it('por serviço soma os itens dos pagos, maior primeiro', () => {
    expect(faturamentoPorServico(pagosDe(lista)).map((l) => [l.rotulo, l.centavos])).toEqual([['Lavagem', 10000], ['Cera', 5000]]);
  });
  it('por status traz todos os status, inclusive zerados', () => {
    const r = agendamentosPorStatus(lista);
    expect(r.map((l) => l.quantidade)).toEqual([1, 0, 2, 1]);
  });
  it('funcionário: ignora cancelados e sem funcionário; nota média', () => {
    const r = desempenhoPorFuncionario(lista, pagosDe(lista));
    expect(r).toEqual([{ nome: 'Zé', atendimentos: 3, finalizados: 2, centavos: 15000, notaMedia: 5 }]);
  });
  it('custos por categoria no período', () => {
    const c = [
      { id: '1', categoria: 'pessoal', valorCentavos: 100000, competencia: '2026-03-01', tipo: 'avulso', fim: null, escopo: 'geral' },
      { id: '2', categoria: 'produtos', valorCentavos: 30000, competencia: '2026-03-01', tipo: 'avulso', fim: null, escopo: 'geral' },
      { id: '3', categoria: 'produtos', valorCentavos: 99999, competencia: '2026-01-01', tipo: 'avulso', fim: null, escopo: 'geral' }
    ] as any;
    const r = custosPorCategoria(c, '2026-03-05', '2026-03-20');
    expect(r.map((l) => [l.rotulo, l.centavos])).toEqual([['Pessoal', 100000], ['Produtos e insumos', 30000]]);
  });
});
