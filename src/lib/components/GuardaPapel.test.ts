// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import '@testing-library/jest-dom/vitest';

const m = vi.hoisted(() => ({
  goto: vi.fn(),
  auth: { carregando: false, usuario: null as unknown, perfil: null as unknown }
}));

vi.mock('$app/navigation', () => ({ goto: m.goto }));
vi.mock('$lib/auth.svelte', () => ({ authStore: m.auth }));

import GuardaPapel from './GuardaPapel.svelte';

const conteudo = createRawSnippet(() => ({ render: () => '<p>Área protegida</p>' }));

function entrar(role: string | null) {
  m.auth.carregando = false;
  m.auth.usuario = role ? { uid: 'u1' } : null;
  m.auth.perfil = role ? { nome: 'x', email: 'x@ex.com', role, condominioId: null } : null;
}

beforeEach(() => vi.clearAllMocks());

describe('GuardaPapel', () => {
  it('funcionário entra na área de funcionário', () => {
    entrar('funcionario');
    render(GuardaPapel, { papel: 'funcionario', children: conteudo });
    expect(screen.getByText('Área protegida')).toBeInTheDocument();
    expect(m.goto).not.toHaveBeenCalled();
  });

  it.each(['cliente', 'gerente', 'admin', 'insulfilm'])(
    '%s NÃO entra na área de funcionário e volta ao login',
    (role) => {
      entrar(role);
      render(GuardaPapel, { papel: 'funcionario', children: conteudo });
      expect(screen.queryByText('Área protegida')).not.toBeInTheDocument();
      expect(m.goto).toHaveBeenCalledWith('/', { replaceState: true });
    }
  );

  it('funcionário NÃO entra na área do gerente nem do admin', () => {
    entrar('funcionario');
    render(GuardaPapel, { papel: 'gerente', children: conteudo });
    expect(screen.queryByText('Área protegida')).not.toBeInTheDocument();
    render(GuardaPapel, { papel: 'admin', children: conteudo });
    expect(screen.queryByText('Área protegida')).not.toBeInTheDocument();
  });

  it('sem login volta ao login', () => {
    entrar(null);
    render(GuardaPapel, { papel: 'funcionario', children: conteudo });
    expect(screen.queryByText('Área protegida')).not.toBeInTheDocument();
    expect(m.goto).toHaveBeenCalledWith('/', { replaceState: true });
  });
});
