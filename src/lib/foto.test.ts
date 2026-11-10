import { describe, it, expect, vi } from 'vitest';
import { ALVO_BYTES, LADO_MAX, comprimirAteAlvo, dimensoesAlvo } from './foto';

const blobDe = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });

describe('dimensoesAlvo', () => {
  it('limita o lado maior a 1600 px mantendo a proporção (paisagem e retrato)', () => {
    expect(dimensoesAlvo(4032, 3024)).toEqual({ w: 1600, h: 1200 });
    expect(dimensoesAlvo(3024, 4032)).toEqual({ w: 1200, h: 1600 });
  });

  it('não amplia foto pequena', () => {
    expect(dimensoesAlvo(800, 600)).toEqual({ w: 800, h: 600 });
  });

  it('aplica a escala extra da compressão', () => {
    expect(dimensoesAlvo(4000, 2000, LADO_MAX, 0.5)).toEqual({ w: 800, h: 400 });
  });

  it('nunca devolve dimensão zero', () => {
    expect(dimensoesAlvo(1, 5000, LADO_MAX, 0.1).w).toBeGreaterThanOrEqual(1);
  });
});

describe('comprimirAteAlvo', () => {
  it('alvo padrão é 500 KB', () => {
    expect(ALVO_BYTES).toBe(500 * 1024);
  });

  it('começa em qualidade 0.7 no tamanho cheio e para na primeira que cabe', async () => {
    const gerar = vi.fn(async () => blobDe(200 * 1024));
    const blob = await comprimirAteAlvo(gerar);
    expect(gerar).toHaveBeenCalledTimes(1);
    expect(gerar).toHaveBeenCalledWith(1, 0.7);
    expect(blob.size).toBe(200 * 1024);
    expect(blob.type).toBe('image/jpeg');
  });

  it('baixa qualidade e tamanho até caber em 500 KB', async () => {
    const tamanhos: Record<string, number> = { '1-0.7': 900, '1-0.6': 700, '1-0.5': 600, '0.85-0.5': 480 };
    const gerar = vi.fn(async (escala: number, qualidade: number) =>
      blobDe((tamanhos[`${escala}-${qualidade}`] ?? 100) * 1024)
    );
    const blob = await comprimirAteAlvo(gerar);
    expect(gerar).toHaveBeenCalledTimes(4);
    expect(blob.size).toBeLessThanOrEqual(ALVO_BYTES);
  });

  it('se nada couber, devolve o menor resultado', async () => {
    const tamanhos = [900, 800, 700, 650, 640, 660];
    let i = 0;
    const blob = await comprimirAteAlvo(async () => blobDe(tamanhos[i++] * 1024));
    expect(i).toBe(6);
    expect(blob.size).toBe(640 * 1024);
  });

  it('propaga o erro se a geração falhar', async () => {
    await expect(comprimirAteAlvo(async () => Promise.reject(new Error('sem canvas')))).rejects.toThrow('sem canvas');
  });
});
