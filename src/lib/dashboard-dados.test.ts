import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const m = vi.hoisted(() => ({ consultas: [] as any[][] }));
vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_d: unknown, nome: string) => ({ nome }),
  where: (campo: string, op: string, v: unknown) => ({ t: 'where', campo, op, v }),
  orderBy: (campo: string, dir = 'asc') => ({ t: 'orderBy', campo, dir }),
  limit: (n: number) => ({ t: 'limit', n }),
  query: (c: unknown, ...r: unknown[]) => ({ c, r }),
  sum: () => ({}),
  count: () => ({}),
  getCountFromServer: async (q: any) => (m.consultas.push(q.r), { data: () => ({ count: 1 }) }),
  getAggregateFromServer: async () => ({ data: () => ({ total: 0, pagos: 0 }) }),
  getDocs: async () => ({ docs: [] })
}));
import { contarPorStatus } from './dashboard-dados';

const indices: { collectionGroup: string; fields: { fieldPath: string; order: string }[] }[] = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')).indexes;
const tem = (colecao: string, campos: [string, string][]) =>
  indices.some((i) => i.collectionGroup === colecao && i.fields.length === campos.length && campos.every(([f, o], k) => i.fields[k].fieldPath === f && i.fields[k].order === o));

beforeEach(() => (m.consultas = []));

describe('contarPorStatus casa com o índice (status, inicio desc)', () => {
  it('igualdade em status, intervalo em inicio e orderBy inicio desc, nas 4 contagens', async () => {
    await contarPorStatus(new Date(2030, 0, 1), new Date(2030, 1, 1));
    expect(m.consultas).toHaveLength(4);
    for (const r of m.consultas) {
      expect(r[0]).toMatchObject({ campo: 'status', op: '==' });
      expect(r.filter((x: any) => x.t === 'where' && x.campo === 'inicio').map((x: any) => x.op)).toEqual(['>=', '<']);
      expect(r.find((x: any) => x.t === 'orderBy')).toEqual({ t: 'orderBy', campo: 'inicio', dir: 'desc' });
    }
  });
  it('os índices exigidos existem em firestore.indexes.json', () => {
    expect(tem('agendamentos', [['status', 'ASCENDING'], ['inicio', 'DESCENDING']])).toBe(true);
    expect(tem('agendamentos', [['status', 'ASCENDING'], ['inicio', 'ASCENDING']])).toBe(true);
    expect(tem('agendamentos', [['pagamento.status', 'ASCENDING'], ['pagamento.pagoEm', 'ASCENDING'], ['total', 'ASCENDING']])).toBe(true);
    expect(tem('agendamentos', [['funcionarioId', 'ASCENDING'], ['inicio', 'DESCENDING']])).toBe(true);
    expect(tem('agendamentos', [['funcionarioId', 'ASCENDING'], ['inicio', 'ASCENDING']])).toBe(true);
    expect(tem('agendamentos', [['clienteId', 'ASCENDING'], ['inicio', 'DESCENDING']])).toBe(true);
  });
});
