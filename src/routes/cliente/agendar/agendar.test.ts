// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';

const m = vi.hoisted(() => ({
  horarioLivre: vi.fn(),
  criarAgendamento: vi.fn(),
  prepararPagamento: vi.fn(),
  agendamentos: [] as unknown[]
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('$lib/app.svelte', () => ({
  app: {
    horarioLivre: m.horarioLivre,
    criarAgendamento: m.criarAgendamento,
    prepararPagamento: m.prepararPagamento,
    get agendamentos() {
      return m.agendamentos;
    }
  }
}));
vi.mock('$lib/components/PainelPagamento.svelte', () => ({ default: () => ({}) }));

import { servicos } from '$lib/catalogo.svelte';
import { reserva } from '$lib/reserva.svelte';
import Pagina from './+page.svelte';

// A tela só mostra horários que ainda não passaram (usa new Date()): congela só o Date
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 13, 8, 0, 0)); // hora local: vale em qualquer fuso (o CI roda em UTC)
  vi.clearAllMocks();
  m.horarioLivre.mockReturnValue(true);
  m.criarAgendamento.mockResolvedValue('ag-novo');
  for (const s of servicos) Object.assign(s, { publicado: true, ativo: true });
  reserva.reiniciar();
  reserva.escolher('eco04'); // 90 min
});

afterEach(() => {
  vi.useRealTimers();
});

const preencher = async () => {
  await fireEvent.input(screen.getByPlaceholderText(/Modelo/), { target: { value: 'Gol' } });
  await fireEvent.input(screen.getByPlaceholderText(/Placa/), { target: { value: 'abc1d23' } });
};

describe('agendar: grade por duração', () => {
  it('pergunta ao app, para cada início, se TODOS os horários da duração estão livres', () => {
    render(Pagina);
    expect(m.horarioLivre).toHaveBeenCalled();
    const duracoes = new Set(m.horarioLivre.mock.calls.map((c) => c[2]));
    expect([...duracoes]).toEqual([reserva.duracaoTotal]);
    expect(reserva.duracaoTotal).toBe(90);
  });

  it('só aparece o início que o app diz estar livre para a duração toda', () => {
    m.horarioLivre.mockImplementation((_d: string, hora: string) => hora !== '09:00' && hora !== '09:30');
    render(Pagina);
    expect(screen.queryByRole('button', { name: '09:00' })).toBeNull();
    expect(screen.queryByRole('button', { name: '09:30' })).toBeNull();
    expect(screen.getByRole('button', { name: '10:00' })).toBeInTheDocument();
  });

  it('nenhum horário livre: mensagem para escolher outra data', () => {
    m.horarioLivre.mockReturnValue(false);
    render(Pagina);
    expect(screen.getByText(/Sem horários livres neste dia/)).toBeInTheDocument();
  });
});

describe('agendar: confirmar pelo servidor', () => {
  it('envia chave de idempotência estável: repetir os mesmos dados repete a mesma chave', async () => {
    m.criarAgendamento.mockRejectedValueOnce(new Error('Sem conexão com o servidor. Verifique a internet.'));
    render(Pagina);
    await preencher();
    await fireEvent.click(screen.getByRole('button', { name: '10:00' }));
    await fireEvent.click(screen.getByRole('button', { name: /Confirmar às 10:00/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão'));
    expect(screen.getByRole('alert')).toHaveTextContent('a reserva não é duplicada');
    await fireEvent.click(screen.getByRole('button', { name: /Confirmar às 10:00/ }));
    await waitFor(() => expect(m.criarAgendamento).toHaveBeenCalledTimes(2));
    const [a, b] = m.criarAgendamento.mock.calls.map((c) => c[0].chave);
    expect(a).toBeTruthy();
    expect(a).toBe(b);
    expect(m.criarAgendamento.mock.calls[0][0].servicos).toEqual(['eco04']);
  });

  it('mudar o horário muda a chave', async () => {
    m.criarAgendamento.mockRejectedValue(new Error('Sem conexão com o servidor. Verifique a internet.'));
    render(Pagina);
    await preencher();
    await fireEvent.click(screen.getByRole('button', { name: '10:00' }));
    await fireEvent.click(screen.getByRole('button', { name: /Confirmar às 10:00/ }));
    await waitFor(() => expect(m.criarAgendamento).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await fireEvent.click(screen.getByRole('button', { name: '11:00' }));
    await fireEvent.click(screen.getByRole('button', { name: /Confirmar às 11:00/ }));
    await waitFor(() => expect(m.criarAgendamento).toHaveBeenCalledTimes(2));
    const [a, b] = m.criarAgendamento.mock.calls.map((c) => c[0].chave);
    expect(a).not.toBe(b);
  });

  it('sem vaga: mensagem própria (não é erro), horário desmarcado e botão volta ao normal', async () => {
    m.criarAgendamento.mockRejectedValue(new Error('Horário indisponível: não há vaga às 10:30. Escolha outro horário.'));
    render(Pagina);
    await preencher();
    await fireEvent.click(screen.getByRole('button', { name: '10:00' }));
    await fireEvent.click(screen.getByRole('button', { name: /Confirmar às 10:00/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('acabou de ser reservado'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: /Confirmar agendamento/ })).toBeEnabled();
  });

  it('mostra "Agendando..." enquanto o servidor responde (estado de carregando)', async () => {
    let resolver: (v: string) => void = () => {};
    m.criarAgendamento.mockReturnValue(new Promise<string>((r) => (resolver = r)));
    render(Pagina);
    await preencher();
    await fireEvent.click(screen.getByRole('button', { name: '10:00' }));
    await fireEvent.click(screen.getByRole('button', { name: /Confirmar às 10:00/ }));
    expect(await screen.findByRole('button', { name: /Agendando/ })).toBeDisabled();
    resolver('ag-novo');
    await waitFor(() => expect(m.prepararPagamento).toHaveBeenCalledWith('ag-novo'));
  });
});
