// O faturamento do relatório web TEM que bater com o do dashboard para o mesmo período.
// Um Firestore em memória interpreta where/orderBy/limit e as agregações; as duas consultas
// REAIS (faturamento() do dashboard e listarPagos() do relatório) rodam sobre os mesmos documentos.
import { describe, it, expect, vi } from 'vitest';

const banco = vi.hoisted(() => ({ docs: [] as Record<string, any>[] }));

vi.mock('firebase/firestore', () => {
  const ms = (v: any) => (v instanceof Date ? v.getTime() : typeof v?.toDate === 'function' ? v.toDate().getTime() : v);
  const pega = (o: any, caminho: string) => caminho.split('.').reduce((x, k) => x?.[k], o);
  class Timestamp {
    constructor(private d: Date) {}
    toDate() {
      return this.d;
    }
    static fromDate(d: Date) {
      return new Timestamp(d);
    }
  }
  const aplicar = (q: any) => {
    let r = banco.docs.filter((d) =>
      q.wheres.every((w: any) => {
        const v = ms(pega(d.data, w.campo));
        const x = ms(w.valor);
        return w.op === '==' ? v === x : w.op === '>=' ? v !== undefined && v >= x : v !== undefined && v < x;
      })
    );
    for (const o of [...q.ordens].reverse()) r = [...r].sort((a, b) => (ms(pega(a.data, o)) < ms(pega(b.data, o)) ? -1 : 1));
    return q.max ? r.slice(0, q.max) : r;
  };
  return {
    Timestamp,
    collection: () => ({}),
    where: (campo: string, op: string, valor: unknown) => ({ t: 'w', campo, op, valor }),
    orderBy: (campo: string) => ({ t: 'o', campo }),
    limit: (n: number) => ({ t: 'l', n }),
    sum: (campo: string) => ({ sum: campo }),
    count: () => ({ count: true }),
    query: (_c: unknown, ...cs: any[]) => ({
      wheres: cs.filter((c) => c.t === 'w'),
      ordens: cs.filter((c) => c.t === 'o').map((c) => c.campo),
      max: cs.find((c) => c.t === 'l')?.n
    }),
    getDocs: async (q: any) => {
      const r = aplicar(q);
      return { size: r.length, docs: r.map((d: any) => ({ id: d.id, data: () => d.data })) };
    },
    getAggregateFromServer: async (q: any) => {
      const r = aplicar(q);
      return { data: () => ({ total: r.reduce((s: number, d: any) => s + d.data.total, 0), pagos: r.length }) };
    },
    getCountFromServer: vi.fn()
  };
});
vi.mock('../firebase', () => ({ db: {} }));

import { faturamento } from '../dashboard-dados';
import { listarPagos } from './consultas';
import { faturamentoPorDia, faturamentoPorServico, totalFaturamento } from './relatorios';

const d = (m: number, dia: number, h = 12) => new Date(2026, m - 1, dia, h);
const ag = (id: string, total: number, status: string, pagoEm: Date | null, inicio: Date, nome = 'Lavagem') => ({
  id,
  data: {
    total,
    status: 'finalizado',
    inicio,
    data: '2026-03-01',
    hora: '10:00',
    itens: [{ servicoId: 's', nome, precoCentavos: total }],
    pagamento: { status, ...(pagoEm ? { pagoEm } : {}) }
  }
});

describe('faturamento: relatório = dashboard', () => {
  it('mesmo período, mesmos documentos, mesmo total (inclui bordas e casos de contorno)', async () => {
    banco.docs = [
      ag('a', 10000, 'pago', d(3, 10), d(3, 10)),
      ag('b', 5050, 'pago', d(3, 31, 23), d(3, 20)), // último dia, noite
      ag('c', 7000, 'pago', d(3, 15), d(2, 20)), // agendado em fevereiro, pago em março: ENTRA
      ag('d', 9000, 'pago', d(4, 1, 0), d(3, 31)), // pago à meia-noite de 1º/abr: fora (fim exclusivo)
      ag('e', 4000, 'pago', d(2, 28, 23), d(3, 5)), // agendado em março, pago em fevereiro: FORA
      ag('f', 3000, 'pendente', null, d(3, 12)),
      ag('g', 6000, 'pago_apos_cancelamento', d(3, 12), d(3, 12)),
      ag('h', 2500, 'pago', d(3, 1, 0), d(3, 1)) // meia-noite de 1º/mar: início inclusivo
    ];
    const inicio = new Date(2026, 2, 1);
    const fim = new Date(2026, 3, 1);
    const dash = await faturamento(inicio, fim);
    const { itens, cortado } = await listarPagos('2026-03-01', '2026-03-31');

    expect(cortado).toBe(false);
    expect(dash.centavos).toBe(10000 + 5050 + 7000 + 2500);
    expect(totalFaturamento(itens)).toBe(dash.centavos);
    expect(itens.length).toBe(dash.pagos);
    // As quebras do relatório somam o mesmo total
    expect(faturamentoPorDia(itens).reduce((s, l) => s + l.centavos, 0)).toBe(dash.centavos);
    expect(faturamentoPorServico(itens).reduce((s, l) => s + l.centavos, 0)).toBe(dash.centavos);
  });

  it('período vazio: os dois dão zero', async () => {
    banco.docs = [ag('a', 10000, 'pendente', null, d(3, 10))];
    const dash = await faturamento(new Date(2026, 2, 1), new Date(2026, 3, 1));
    const { itens } = await listarPagos('2026-03-01', '2026-03-31');
    expect(dash.centavos).toBe(0);
    expect(totalFaturamento(itens)).toBe(0);
  });
});
