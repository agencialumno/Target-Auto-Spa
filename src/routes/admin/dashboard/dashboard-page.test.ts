// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';

const m = vi.hoisted(() => ({
  usuarios: vi.fn(),
  status: vi.fn(),
  fatur: vi.fn(),
  custos: vi.fn(),
  mov: vi.fn()
}));
vi.mock('$lib/firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('$lib/app.svelte', () => ({
  app: { agendamentos: [] },
  rotuloStatus: { agendado: 'Agendado', em_andamento: 'Em atendimento', finalizado: 'Finalizado', cancelado: 'Cancelado' }
}));
vi.mock('$lib/custos-admin', () => ({ listarCustos: () => m.custos() }));
vi.mock('$lib/dashboard-dados', () => ({
  contarUsuarios: () => m.usuarios(),
  contarPorStatus: () => m.status(),
  faturamento: () => m.fatur(),
  agendamentosDoPeriodo: async () => [],
  ultimasMovimentacoes: () => m.mov()
}));
import Pagina from './+page.svelte';

const falha = (code: string) => Promise.reject(Object.assign(new Error(code), { code }));
const bloco = (nome: string) => screen.getByRole('region', { name: new RegExp(nome) });

beforeEach(() => {
  vi.clearAllMocks();
  m.usuarios.mockResolvedValue({ cliente: 7, gerente: 1, funcionario: 2, admin: 1 });
  m.status.mockResolvedValue({ agendado: 3, em_andamento: 1, finalizado: 4, cancelado: 0 });
  m.fatur.mockResolvedValue({ centavos: 10000, pagos: 2 });
  m.custos.mockResolvedValue([]);
  m.mov.mockResolvedValue([]);
});

describe('dashboard: carga', () => {
  it('carrega cada leitura uma única vez (sem laço de recarga)', async () => {
    render(Pagina);
    await waitFor(() => expect(bloco('Usuários')).toHaveTextContent('Clientes'));
    await new Promise((r) => setTimeout(r, 200));
    expect(m.usuarios).toHaveBeenCalledTimes(1);
    expect(m.status).toHaveBeenCalledTimes(1);
    expect(m.fatur).toHaveBeenCalledTimes(1);
    expect(m.custos).toHaveBeenCalledTimes(1);
    expect(m.mov).toHaveBeenCalledTimes(1);
  });

  it('estados: pronto, vazio (movimentações) e nenhum "Carregando" sobra', async () => {
    render(Pagina);
    await waitFor(() => expect(bloco('Últimas movimentações')).toHaveTextContent('Nenhuma atividade registrada ainda.'));
    expect(bloco('Agendamentos no período')).toHaveTextContent('Finalizado');
    expect(screen.queryByText('Carregando...')).toBeNull();
  });

  it('um bloco que nunca resolve não trava os outros', async () => {
    m.usuarios.mockReturnValue(new Promise(() => {}));
    render(Pagina);
    await waitFor(() => expect(bloco('Financeiro')).toHaveTextContent('Faturamento'));
    expect(bloco('Usuários')).toHaveTextContent('Carregando...');
    expect(bloco('Agendamentos no período')).toHaveTextContent('Finalizado');
  });

  it('erro mostra o código do Firestore, os outros blocos seguem e "Tentar de novo" recupera', async () => {
    m.fatur.mockImplementationOnce(() => falha('failed-precondition'));
    render(Pagina);
    await waitFor(() => expect(bloco('Financeiro')).toHaveTextContent('failed-precondition'));
    expect(bloco('Financeiro')).toHaveTextContent('índice');
    expect(bloco('Usuários')).toHaveTextContent('Clientes');
    await fireEvent.click(within(bloco('Financeiro')).getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(bloco('Financeiro')).toHaveTextContent('Faturamento'));
    expect(m.usuarios).toHaveBeenCalledTimes(1);
  });

  it('permission-denied aparece como regra', async () => {
    m.mov.mockImplementationOnce(() => falha('permission-denied'));
    render(Pagina);
    await waitFor(() => expect(bloco('Últimas movimentações')).toHaveTextContent('permission-denied'));
    expect(bloco('Últimas movimentações')).toHaveTextContent('regra');
  });

  it('tempo limite vira erro visível em vez de "carregando" eterno', async () => {
    vi.useFakeTimers();
    try {
      m.status.mockReturnValue(new Promise(() => {}));
      render(Pagina);
      await vi.advanceTimersByTimeAsync(15_100);
      expect(bloco('Agendamentos no período')).toHaveTextContent('timeout');
      expect(within(bloco('Agendamentos no período')).getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
