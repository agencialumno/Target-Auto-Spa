import { describe, it, expect } from 'vitest';
import { rotaInicial } from './rotas';

describe('rotaInicial', () => {
  it.each([
    ['gerente', null, '/gerente'],
    ['funcionario', null, '/funcionario'],
    ['admin', null, '/admin'],
    ['cliente', 'c1', '/cliente'],
    ['cliente', null, '/entrar-condominio']
  ])('%s (condomínio %s) vai para %s', (role, condominioId, rota) => {
    expect(rotaInicial({ role, condominioId })).toBe(rota);
  });

  it('papel desconhecido não redireciona (inclui o antigo "insulfilm", que deixou de existir)', () => {
    expect(rotaInicial({ role: 'root', condominioId: null })).toBeNull();
    expect(rotaInicial({ role: 'insulfilm', condominioId: null })).toBeNull();
  });
});
