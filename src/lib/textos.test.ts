import { describe, it, expect } from 'vitest';
import { FALE_COM_GERENTE, fraseFaleComGerente } from './textos';
import { servicosBase } from './catalogo-base';

describe('textos', () => {
  it('constante única e versão em minúscula para o meio da frase', () => {
    expect(FALE_COM_GERENTE).toBe('Fale com o gerente');
    expect(fraseFaleComGerente()).toBe('fale com o gerente');
  });

  it('nenhum item do catálogo base fala em soda cáustica junto de biodegradáveis', () => {
    const itens = servicosBase.flatMap((s) => s.inclui);
    expect(itens).toContain('Produtos biodegradáveis');
    expect(itens.some((i) => /soda c/i.test(i))).toBe(false);
  });
});
