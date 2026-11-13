import { describe, it, expect } from 'vitest';
import { filtrarPorPagamento, filtrarUsuarios, limitesPeriodo, ordenar, paginar, type UsuarioLinha } from './tabela';

const us: UsuarioLinha[] = [
  { uid: '1', nome: 'Ângela', email: 'a@x.com', role: 'cliente', condominioId: 'c1' },
  { uid: '2', nome: 'Bruno', email: 'b@x.com', role: 'gerente', condominioId: 'c1' },
  { uid: '3', nome: 'Carla', email: 'c@y.com', role: 'cliente', condominioId: 'c2' }
];

describe('tabela: ordenar e paginar', () => {
  it('ordena texto, número e data, e deixa vazio no fim', () => {
    expect(ordenar(us, (u) => u.nome, 'desc').map((u) => u.uid)).toEqual(['3', '2', '1']);
    expect(ordenar([{ n: 2 }, { n: null }, { n: 1 }], (x) => x.n, 'asc').map((x) => x.n)).toEqual([1, 2, null]);
    expect(ordenar([{ n: 2 }, { n: null }, { n: 1 }], (x) => x.n, 'desc').map((x) => x.n)).toEqual([2, 1, null]);
    const d = ordenar([{ d: new Date(2) }, { d: new Date(1) }], (x) => x.d, 'asc');
    expect(d[0].d.getTime()).toBe(1);
  });
  it('não altera a lista original', () => {
    const copia = [...us];
    ordenar(us, (u) => u.nome, 'desc');
    expect(us).toEqual(copia);
  });
  it('pagina e limita a página pedida', () => {
    const l = Array.from({ length: 53 }, (_, i) => i);
    expect(paginar(l, 1, 25)).toMatchObject({ paginas: 3, pagina: 1, total: 53 });
    expect(paginar(l, 3, 25).itens).toHaveLength(3);
    expect(paginar(l, 99, 25).pagina).toBe(3);
    expect(paginar(l, 0, 25).pagina).toBe(1);
    expect(paginar([], 1, 25)).toMatchObject({ paginas: 1, itens: [] });
  });
});

describe('tabela: filtros', () => {
  it('busca sem acento por nome ou e-mail', () => {
    expect(filtrarUsuarios(us, { busca: 'angela', papel: '', condominio: '' }).map((u) => u.uid)).toEqual(['1']);
    expect(filtrarUsuarios(us, { busca: '@y.com', papel: '', condominio: '' }).map((u) => u.uid)).toEqual(['3']);
  });
  it('papel e condomínio combinam', () => {
    expect(filtrarUsuarios(us, { busca: '', papel: 'cliente', condominio: 'c1' }).map((u) => u.uid)).toEqual(['1']);
    expect(filtrarUsuarios(us, { busca: '', papel: '', condominio: '' })).toHaveLength(3);
  });
  it('filtra pagamento no navegador', () => {
    const ag = (s?: string) => ({ pagamento: s ? { status: s } : null }) as any;
    const l = [ag('pago'), ag('pendente'), ag('divergente'), ag('pago_apos_cancelamento'), ag()];
    expect(filtrarPorPagamento(l, '')).toHaveLength(5);
    expect(filtrarPorPagamento(l, 'pago')).toHaveLength(1);
    expect(filtrarPorPagamento(l, 'pendente')).toHaveLength(1);
    expect(filtrarPorPagamento(l, 'revisao')).toHaveLength(2);
    expect(filtrarPorPagamento(l, 'sem')).toHaveLength(1);
  });
  it('período: inclusivo no fim, inválido vira null', () => {
    const p = limitesPeriodo('2026-03-01', '2026-03-31')!;
    expect(p.inicio.getDate()).toBe(1);
    expect(p.fim.getMonth()).toBe(3); // 1º de abril, exclusivo
    expect(p.fim.getDate()).toBe(1);
    expect(limitesPeriodo('2026-03-10', '2026-03-01')).toBeNull();
    expect(limitesPeriodo('', '2026-03-01')).toBeNull();
    expect(limitesPeriodo('2026-13-40', '2026-03-01')).toBeNull();
  });
});
