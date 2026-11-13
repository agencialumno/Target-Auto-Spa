// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import '@testing-library/jest-dom/vitest';

const m = vi.hoisted(() => ({
  auth: { carregando: false, usuario: { uid: 'u1' } as unknown, perfil: { nome: 'Ana', email: 'a@ex.com', role: 'cliente', condominioId: 'c1' } as unknown },
  app: { naoLidasNotif: 0, msgNaoLidasCliente: 0 }
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/auth.svelte', () => ({ authStore: m.auth }));
vi.mock('$lib/firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('$lib/app.svelte', () => ({ app: m.app }));
import Layout from './+layout.svelte';

const conteudo = createRawSnippet(() => ({ render: () => '<p>Conteúdo</p>' }));

beforeEach(() => {
  m.app.naoLidasNotif = 0;
  m.app.msgNaoLidasCliente = 0;
});

describe('menu do cliente: selo de mensagens novas do gerente', () => {
  it('sem não lidas: sem selo no Perfil', () => {
    render(Layout, { children: conteudo });
    const perfil = screen.getByRole('link', { name: /Perfil/ });
    expect(perfil.querySelector('.selo')).toBeNull();
  });

  it('com não lidas: selo com o contador no Perfil', () => {
    m.app.msgNaoLidasCliente = 2;
    render(Layout, { children: conteudo });
    const perfil = screen.getByRole('link', { name: /Perfil/ });
    expect(perfil.querySelector('.selo')).toHaveTextContent('2');
  });
});
