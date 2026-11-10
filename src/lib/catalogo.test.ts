import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn()
}));

import { servicos, getServico, aplicarCatalogo, contratavel, docServico } from './catalogo.svelte';

beforeEach(() => aplicarCatalogo([]));

describe('catálogo', () => {
  it('sem documentos no Firestore nada pode ser contratado', () => {
    expect(servicos.length).toBeGreaterThan(10);
    expect(servicos.some(contratavel)).toBe(false);
  });

  it('o preço do Firestore (centavos) vale sobre o do texto base', () => {
    aplicarCatalogo([{ id: 'eco01', data: { precoCentavos: 7123, duracaoMin: 35, nome: 'Banho Básico', ativo: true } }]);
    const s = getServico('eco01')!;
    expect(s.precoCentavos).toBe(7123);
    expect(s.preco).toBeCloseTo(71.23);
    expect(s.duracao).toBe(35);
    expect(contratavel(s)).toBe(true);
    expect(contratavel(getServico('eco02')!)).toBe(false);
  });

  it('serviço desativado não é contratável', () => {
    aplicarCatalogo([{ id: 'eco01', data: { precoCentavos: 6500, ativo: false } }]);
    expect(contratavel(getServico('eco01')!)).toBe(false);
  });

  it('preço inválido no documento é ignorado', () => {
    const antes = getServico('eco02')!.precoCentavos;
    aplicarCatalogo([{ id: 'eco02', data: { precoCentavos: 'abc', ativo: true } }]);
    expect(getServico('eco02')!.precoCentavos).toBe(antes);
  });

  it('todo serviço do texto base tem preço em centavos inteiros', () => {
    for (const s of servicos) expect(Number.isInteger(s.precoCentavos)).toBe(true);
  });

  it('docServico gera o documento de /servicos com preço em centavos', () => {
    const d = docServico(getServico('eco01')!, 0);
    expect(d).toMatchObject({ nome: 'Banho Básico', precoCentavos: 6500, ativo: true, ordem: 0 });
    expect(Number.isInteger(d.precoCentavos)).toBe(true);
  });
});
