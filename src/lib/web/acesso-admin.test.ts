import { describe, it, expect } from 'vitest';
import { decidirAcesso, listaDeEmails } from './acesso-admin';

describe('acesso do painel web', () => {
  it('só o papel admin entra', () => {
    expect(decidirAcesso({ role: 'admin' }, 'a@x.com', [])).toBe('permitido');
    for (const role of ['cliente', 'gerente', 'funcionario', 'x', undefined]) {
      expect(decidirAcesso({ role }, 'a@x.com', [])).toBe('negado');
    }
  });
  it('sem perfil é negado (login Google de quem nunca se cadastrou)', () => {
    expect(decidirAcesso(null, 'a@x.com', [])).toBe('negado');
  });
  it('lista de e-mails: admin fora da lista é negado, sem diferenciar maiúsculas', () => {
    const l = listaDeEmails(' A@x.com , b@x.com,, ');
    expect(l).toEqual(['a@x.com', 'b@x.com']);
    expect(decidirAcesso({ role: 'admin' }, 'A@X.com', l)).toBe('permitido');
    expect(decidirAcesso({ role: 'admin' }, 'c@x.com', l)).toBe('negado');
    expect(decidirAcesso({ role: 'admin' }, null, l)).toBe('negado');
  });
  it('lista vazia ou ausente não restringe por e-mail', () => {
    expect(listaDeEmails(undefined)).toEqual([]);
    expect(listaDeEmails('')).toEqual([]);
  });
});
