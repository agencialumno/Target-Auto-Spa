// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';

const m = vi.hoisted(() => ({
  app: {
    conversas: [] as any[],
    conversasEstado: 'pronto',
    conversasErro: '',
    conversaAtiva: null as string | null,
    mensagens: [] as any[],
    mensagensEstado: 'pronto',
    mensagensErro: '',
    condominioNome: 'Residencial Sol',
    msgNaoLidasGerente: 0,
    abrirConversa: vi.fn(),
    fecharConversa: vi.fn(),
    ouvirConversas: vi.fn(),
    reabrirConversa: vi.fn(),
    lerMensagens: vi.fn(),
    responder: vi.fn()
  }
}));
vi.mock('$lib/app.svelte', () => ({ app: m.app }));
import Pagina from './+page.svelte';

const conv = (id: string, nome: string, h: Date | null, naoLidas = 0, msg = 'oi') => ({
  id, clienteNome: nome, condominioId: 'c1', ultimaMensagem: msg, ultimaHora: h, naoLidasGerente: naoLidas, naoLidasCliente: 0
});
const hoje = () => { const d = new Date(); d.setHours(9, 5, 0, 0); return d; };
const ontem = () => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(20, 0, 0, 0); return d; };

Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(m.app, { conversas: [], conversasEstado: 'pronto', conversasErro: '', conversaAtiva: null, mensagens: [], mensagensEstado: 'pronto', msgNaoLidasGerente: 0 });
});

describe('gerente: lista de conversas', () => {
  it('mostra nome, condomínio, prévia e hora (hoje) ou data (antes), mais recente primeiro', () => {
    m.app.conversas = [conv('b', 'Bia', ontem(), 0, 'mensagem antiga'), conv('a', 'Ana', hoje(), 0, 'x'.repeat(200))];
    render(Pagina);
    const itens = screen.getAllByRole('button').filter((b) => b.classList.contains('conversa-item'));
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('Ana');
    expect(itens[0]).toHaveTextContent('09:05');
    expect(itens[0]).toHaveTextContent('Residencial Sol');
    expect(itens[0].textContent).toContain('…');
    expect(itens[1]).toHaveTextContent('Bia');
    expect(itens[1].textContent).toMatch(/\d{2}\/\d{2}/);
  });

  it('não lidas ficam em destaque com contador e aviso geral', () => {
    m.app.conversas = [conv('a', 'Ana', hoje(), 3), conv('b', 'Bia', ontem(), 0)];
    m.app.msgNaoLidasGerente = 3;
    render(Pagina);
    const ana = screen.getByRole('button', { name: /Ana/ });
    expect(ana).toHaveClass('nao-lida');
    expect(within(ana).getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bia/ })).not.toHaveClass('nao-lida');
    expect(screen.getByRole('status')).toHaveTextContent('3 mensagens novas');
  });

  it('abrir a conversa chama abrirConversa com o id', async () => {
    m.app.conversas = [conv('a', 'Ana', hoje())];
    render(Pagina);
    await fireEvent.click(screen.getByRole('button', { name: /Ana/ }));
    expect(m.app.abrirConversa).toHaveBeenCalledWith('a');
  });

  it('estados: carregando, vazio e erro com código e "Tentar de novo"', async () => {
    m.app.conversasEstado = 'carregando';
    const r = render(Pagina);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando conversas');
    r.unmount();

    m.app.conversasEstado = 'pronto';
    const r2 = render(Pagina);
    expect(screen.getByText('Nenhum cliente enviou mensagem ainda.')).toBeInTheDocument();
    r2.unmount();

    m.app.conversasEstado = 'erro';
    m.app.conversasErro = 'permission-denied';
    render(Pagina);
    expect(screen.getByRole('alert')).toHaveTextContent('permission-denied');
    await fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(m.app.ouvirConversas).toHaveBeenCalled();
  });
});

describe('gerente: conversa aberta', () => {
  it('marca como lida ao abrir e mostra erro das mensagens com nova tentativa', async () => {
    m.app.conversaAtiva = 'a';
    m.app.conversas = [conv('a', 'Ana', hoje())];
    m.app.mensagensEstado = 'erro';
    m.app.mensagensErro = 'unavailable';
    render(Pagina);
    expect(m.app.lerMensagens).toHaveBeenCalledWith('gerente');
    expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
    await fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(m.app.reabrirConversa).toHaveBeenCalled();
  });
});
