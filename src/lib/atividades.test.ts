import { describe, it, expect } from 'vitest';
import { montarAtividadeApp } from './atividades';

describe('montarAtividadeApp', () => {
  it('status: só o status entra, com alvo agendamento e origem app', () => {
    const a = montarAtividadeApp(
      { acao: 'status_agendamento', alvoId: 'ag1', antes: { status: 'agendado', precoCentavos: 1 } as any, depois: { status: 'em_andamento' } },
      'u1',
      'gerente',
      'T'
    );
    expect(a).toEqual({
      em: 'T',
      atorUid: 'u1',
      atorPapel: 'gerente',
      acao: 'status_agendamento',
      alvoTipo: 'agendamento',
      alvoId: 'ag1',
      antes: { status: 'agendado' },
      depois: { status: 'em_andamento' },
      origem: 'app'
    });
  });

  it('preço: só centavos; login de admin: sem antes nem depois', () => {
    const p = montarAtividadeApp({ acao: 'preco_alterado', alvoId: 's1', antes: { precoCentavos: 6500 }, depois: { precoCentavos: 7000, status: 'x' } as any }, 'u1', 'admin', 'T');
    expect(p.alvoTipo).toBe('servico');
    expect(p.depois).toEqual({ precoCentavos: 7000 });
    const l = montarAtividadeApp({ acao: 'login_admin', alvoId: 'u1', depois: { status: 'x' } as any }, 'u1', 'admin', 'T');
    expect('antes' in l || 'depois' in l).toBe(false);
  });
});
