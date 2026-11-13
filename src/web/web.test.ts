// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import '@testing-library/jest-dom/vitest';

const m = vi.hoisted(() => ({
  auth: { carregando: false, usuario: null as unknown, perfil: null as unknown },
  sairWeb: vi.fn(),
  conversas: vi.fn(),
  mensagens: vi.fn()
}));

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('$lib/auth.svelte', () => ({ authStore: m.auth }));
vi.mock('$lib/web/auth-web', () => ({ entrarComGoogleWeb: vi.fn(), sairWeb: m.sairWeb }));
vi.mock('$lib/web/consultas', async (orig) => ({
  ...(await orig<typeof import('$lib/web/consultas')>()),
  listarConversas: m.conversas,
  listarMensagens: m.mensagens
}));

import Tabela from './Tabela.svelte';
import type { Coluna } from '$lib/web/tabela';
import Entrada from './Entrada.svelte';
import Mensagens from './telas/Mensagens.svelte';

const filho = createRawSnippet(() => ({ render: () => '<p>CONTEUDO-ADMIN</p>' }));

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.carregando = false;
  m.auth.usuario = null;
  m.auth.perfil = null;
});

describe('Tabela', () => {
  type L = { nome: string; v: number };
  const colunas: Coluna<L>[] = [
    { id: 'nome', titulo: 'Nome', texto: (l: L) => l.nome, chave: (l: L) => l.nome },
    { id: 'v', titulo: 'Valor', texto: (l: L) => String(l.v), chave: (l: L) => l.v }
  ];

  it('desenha cabeçalho e linhas, e escapa texto (sem HTML)', () => {
    render(Tabela as any, { colunas, linhas: [{ nome: '<b>x</b>', v: 1 }, { nome: 'Ana', v: 2 }] });
    expect(screen.getByRole('columnheader', { name: /Nome/ })).toBeInTheDocument();
    expect(screen.getByText('<b>x</b>')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('ordena ao clicar na coluna', async () => {
    render(Tabela as any, { colunas, linhas: [{ nome: 'B', v: 1 }, { nome: 'A', v: 2 }] });
    await fireEvent.click(screen.getByRole('button', { name: /Nome/ }));
    const celulas = screen.getAllByRole('cell').map((c) => c.textContent);
    expect(celulas[0]).toBe('A');
    await fireEvent.click(screen.getByRole('button', { name: /Nome/ }));
    expect(screen.getAllByRole('cell')[0].textContent).toBe('B');
  });

  it('pagina', async () => {
    const linhas = Array.from({ length: 30 }, (_, i) => ({ nome: `N${i}`, v: i }));
    render(Tabela as any, { colunas, linhas, porPagina: 10 });
    expect(screen.getAllByRole('row')).toHaveLength(11);
    expect(screen.getByText(/página 1 de 3/)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(screen.getByText(/página 2 de 3/)).toBeInTheDocument();
  });

  it('mostra carregando, vazio e erro com o código', async () => {
    const r = render(Tabela as any, { colunas, linhas: [], carregando: true });
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    await r.rerender({ colunas, linhas: [], carregando: false, vazio: 'Nada aqui.' });
    expect(screen.getByText('Nada aqui.')).toBeInTheDocument();
    const retry = vi.fn();
    await r.rerender({ colunas, linhas: [], erro: 'Não foi possível carregar x (permission-denied).', aoTentarDeNovo: retry });
    expect(screen.getByRole('alert')).toHaveTextContent('permission-denied');
    await fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(retry).toHaveBeenCalled();
  });
});

describe('Entrada (acesso ao painel web)', () => {
  it('admin vê o conteúdo', () => {
    m.auth.usuario = { email: 'a@x.com' };
    m.auth.perfil = { role: 'admin' };
    render(Entrada, { children: filho });
    expect(screen.getByText('CONTEUDO-ADMIN')).toBeInTheDocument();
  });

  it.each(['cliente', 'gerente', 'funcionario'])('%s: acesso negado, sem conteúdo e desconectado', async (role) => {
    m.auth.usuario = { email: 'a@x.com' };
    m.auth.perfil = { role };
    render(Entrada, { children: filho });
    expect(screen.queryByText('CONTEUDO-ADMIN')).not.toBeInTheDocument();
    await waitFor(() => expect(m.sairWeb).toHaveBeenCalled());
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('sem sessão mostra só o botão do Google', () => {
    render(Entrada, { children: filho });
    expect(screen.queryByText('CONTEUDO-ADMIN')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeInTheDocument();
  });
});

describe('Mensagens (somente leitura)', () => {
  it('lista, abre a conversa e não oferece nenhum campo de envio', async () => {
    m.conversas.mockResolvedValue([{ id: 'c1', clienteNome: 'Ana', condominioId: 'k', ultimaMensagem: 'oi', ultimaHora: null }]);
    m.mensagens.mockResolvedValue([{ id: 'm1', de: 'cliente', texto: 'olá', criadoEm: null }]);
    const { container } = render(Mensagens);
    await fireEvent.click(await screen.findByRole('button', { name: /Ana/ }));
    expect(await screen.findByText('olá')).toBeInTheDocument();
    expect(m.mensagens).toHaveBeenCalledWith('c1');
    expect(container.querySelector('textarea, input, form')).toBeNull();
    expect(screen.queryByRole('button', { name: /enviar|marcar/i })).toBeNull();
  });

  it('mostra erro do Firestore com o código e permite tentar de novo', async () => {
    m.conversas.mockRejectedValue({ code: 'permission-denied' });
    render(Mensagens);
    expect(await screen.findByRole('alert')).toHaveTextContent('permission-denied');
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('estado vazio', async () => {
    m.conversas.mockResolvedValue([]);
    render(Mensagens);
    expect(await screen.findByText('Nenhuma conversa ainda.')).toBeInTheDocument();
  });
});

import CartaoLogin from './CartaoLogin.svelte';

describe('Tela de login (identidade visual)', () => {
  it('mostra o logo oficial com texto alternativo e o botão dourado do app', () => {
    render(CartaoLogin, { aoEntrar: vi.fn() });
    expect(screen.getByRole('img', { name: 'Grupo Target Auto Spa' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Painel administrativo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar com Google' })).toHaveClass('btn-primario');
  });
  it('ocupado: botão desabilitado com "Aguarde..."; erro aparece como alerta', () => {
    render(CartaoLogin, { aoEntrar: vi.fn(), ocupado: true, erro: 'Falhou' });
    expect(screen.getByRole('button', { name: 'Aguarde...' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou');
  });
});
