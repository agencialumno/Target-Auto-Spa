import { describe, it, expect, vi } from 'vitest';

const q = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('firebase/firestore', () => ({
  Timestamp: class {
    constructor(public d: Date) {}
    static fromDate(d: Date) {
      return new this(d);
    }
  },
  collection: vi.fn(),
  getDocs: vi.fn(),
  limit: (n: number) => ['limit', n],
  orderBy: (...a: unknown[]) => ['orderBy', ...a],
  query: vi.fn(),
  where: (...a: unknown[]) => ['where', ...a]
}));
vi.mock('../firebase', () => ({ db: {} }));

import { descreverErro, restricoesAgendamentos, TETO_AGENDAMENTOS } from './consultas';

const campos = (r: any[] | null) => (r ?? []).filter((c) => c[0] === 'where').map((c) => `${c[1]} ${c[2]}`);

describe('consultas do painel web', () => {
  it('só período: filtra por inicio e ordena por inicio desc (índice automático)', () => {
    const r = restricoesAgendamentos({ de: '2026-03-01', ate: '2026-03-31', status: '', condominio: '' })!;
    expect(campos(r)).toEqual(['inicio >=', 'inicio <']);
    expect(r).toContainEqual(['orderBy', 'inicio', 'desc']);
    expect(r).toContainEqual(['limit', TETO_AGENDAMENTOS]);
  });
  it('status e condomínio entram na consulta (índices já existentes)', () => {
    const r = restricoesAgendamentos({ de: '2026-03-01', ate: '2026-03-31', status: 'pago', condominio: 'c1' });
    expect(campos(r)).toEqual(['condominioId ==', 'status ==', 'inicio >=', 'inicio <']);
  });
  it('período inválido não consulta', () => {
    expect(restricoesAgendamentos({ de: '2026-04-01', ate: '2026-03-01', status: '', condominio: '' })).toBeNull();
  });
  it('mensagem de erro traz o código do Firestore', () => {
    expect(descreverErro({ code: 'permission-denied' }, 'os usuários')).toContain('(permission-denied)');
    expect(descreverErro({ code: 'failed-precondition' }, 'x')).toContain('índice');
    expect(descreverErro(new Error('x'), 'x')).toContain('(desconhecido)');
  });
});
