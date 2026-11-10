import { describe, it, expect, vi, afterEach } from 'vitest';
import { criteriosSenha, emailValido, mensagemSenha, rolarAte, senhaForte } from './validacao';

describe('senha', () => {
  it.each([
    ['', 'Senha precisa de pelo menos 8 caracteres'],
    ['Abc1!', 'Senha precisa de pelo menos 8 caracteres'],
    ['abcdefg1!', 'Senha precisa de uma letra maiúscula'],
    ['ABCDEFG1!', 'Senha precisa de uma letra minúscula'],
    ['Abcdefgh!', 'Senha precisa de um número'],
    ['Abcdefg12', 'Senha precisa de um caractere especial (como !@#$%)']
  ])('"%s" falta: %s', (senha, mensagem) => {
    expect(mensagemSenha(senha)).toBe(mensagem);
    expect(senhaForte(senha)).toBe(false);
  });

  it('senha forte não tem mensagem', () => {
    expect(mensagemSenha('Abcdef1!x')).toBeNull();
    expect(senhaForte('Abcdef1!x')).toBe(true);
  });

  it('criteriosSenha marca cada requisito (tempo real)', () => {
    const c = criteriosSenha('Abcdefgh');
    expect(c.map((x) => [x.id, x.atendido])).toEqual([
      ['tamanho', true],
      ['maiuscula', true],
      ['minuscula', true],
      ['numero', false],
      ['especial', false]
    ]);
  });
});

describe('e-mail', () => {
  it.each(['a@b.co', ' ana@ex.com ', 'a.b+c@dominio.com.br'])('%s é válido', (e) => expect(emailValido(e)).toBe(true));
  it.each(['', 'sem-arroba', 'a@b', '@b.com', 'a b@c.com'])('"%s" é inválido', (e) => expect(emailValido(e)).toBe(false));
});

describe('rolarAte', () => {
  afterEach(() => vi.useRealTimers());

  it('foca sem rolar na hora e rola para o centro depois que o teclado sobe', () => {
    vi.useFakeTimers();
    const el = { focus: vi.fn(), scrollIntoView: vi.fn() } as unknown as HTMLElement;
    rolarAte(el);
    expect(el.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(el.scrollIntoView).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });

  it('não quebra sem elemento ou sem scrollIntoView', () => {
    vi.useFakeTimers();
    expect(() => rolarAte(undefined)).not.toThrow();
    expect(() => {
      rolarAte({ focus: () => {} } as unknown as HTMLElement);
      vi.advanceTimersByTime(400);
    }).not.toThrow();
  });
});
