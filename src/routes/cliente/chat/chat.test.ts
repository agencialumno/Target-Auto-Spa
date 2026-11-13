// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';

const m = vi.hoisted(() => ({
  app: {
    agendamentos: [] as any[],
    mensagens: [] as any[],
    mensagensEstado: 'pronto',
    mensagensErro: '',
    lerMensagens: vi.fn(),
    enviar: vi.fn(),
    reabrirConversa: vi.fn()
  }
}));
vi.mock('$lib/app.svelte', () => ({ app: m.app, rotuloStatus: {} }));
vi.mock('$lib/auth.svelte', () => ({ authStore: { usuario: { uid: 'u1' }, perfil: { condominioId: 'c1' } } }));
import Pagina from './+page.svelte';

const msg = (id: string, de: string, lida: boolean, hora = '10:00') => ({ id, de, texto: `texto ${id}`, hora, lida, criadoEm: new Date() });

Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(m.app, { mensagens: [], mensagensEstado: 'pronto', mensagensErro: '' });
});

describe('cliente: chat com o gerente', () => {
  it('resposta não lida do gerente: aviso com a hora e marca "Nova"; marca como lida ao abrir', () => {
    m.app.mensagens = [msg('1', 'cliente', true), msg('2', 'gerente', false, '10:07')];
    render(Pagina);
    expect(screen.getByRole('status')).toHaveTextContent('O gerente respondeu às 10:07');
    expect(screen.getByText('Nova')).toBeInTheDocument();
    expect(screen.getByText(/Lida/)).toBeInTheDocument();
    expect(m.app.lerMensagens).toHaveBeenCalledWith('cliente');
  });

  it('sem respostas novas não há aviso', () => {
    m.app.mensagens = [msg('1', 'gerente', true)];
    render(Pagina);
    expect(screen.queryByText('Nova')).toBeNull();
    expect(screen.queryByText(/O gerente respondeu/)).toBeNull();
  });

  it('estados: carregando e erro com código e nova tentativa', () => {
    m.app.mensagensEstado = 'carregando';
    const r = render(Pagina);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando mensagens');
    r.unmount();
    m.app.mensagensEstado = 'erro';
    m.app.mensagensErro = 'permission-denied';
    render(Pagina);
    expect(screen.getByRole('alert')).toHaveTextContent('permission-denied');
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });
});
