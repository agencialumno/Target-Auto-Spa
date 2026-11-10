// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';

const m = vi.hoisted(() => ({ pagar: vi.fn() }));
vi.mock('$lib/app.svelte', () => ({ app: { pagar: m.pagar } }));

import PainelPagamento from './PainelPagamento.svelte';

const ag = (extra: Record<string, unknown> = {}) => ({
  id: 'ag1',
  status: 'agendado',
  pagamento: null,
  ...extra
});
const pag = (status: string, venceEm: Date | null = null) => ({ status, venceEm, revisao: false });
const daqui = (min: number) => new Date(Date.now() + min * 60_000);

beforeEach(() => vi.clearAllMocks());

describe('PainelPagamento', () => {
  it('agendado sem Checkout ainda: selo "Pagamento pendente" e botão Pagar', () => {
    render(PainelPagamento, { ag: ag() as any });
    expect(screen.getByText('Pagamento pendente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagar' })).toBeInTheDocument();
  });

  it('Pagar abre o pagamento pelo app (navegador do sistema) para o agendamento certo', async () => {
    m.pagar.mockResolvedValue(undefined);
    render(PainelPagamento, { ag: ag() as any });
    await fireEvent.click(screen.getByRole('button', { name: 'Pagar' }));
    await waitFor(() => expect(m.pagar).toHaveBeenCalledWith('ag1'));
  });

  it('aguardando pagamento: mostra até que horas e o botão', () => {
    render(PainelPagamento, { ag: ag({ pagamento: pag('pendente', daqui(10)) }) as any });
    expect(screen.getByText('Aguardando pagamento')).toBeInTheDocument();
    expect(screen.getByText(/Pague até as \d{2}:\d{2}/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagar' })).toBeInTheDocument();
  });

  it('pago: confirma e esconde o botão', () => {
    render(PainelPagamento, { ag: ag({ pagamento: pag('pago') }) as any });
    expect(screen.getByText('Pago')).toBeInTheDocument();
    expect(screen.getByText(/Pagamento confirmado/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagar' })).not.toBeInTheDocument();
  });

  it('expirou: mensagem clara de prazo, agendamento cancelado e horário liberado, sem botão', () => {
    render(PainelPagamento, { ag: ag({ status: 'cancelado', pagamento: pag('expirado') }) as any });
    expect(screen.getByText('Prazo expirado')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/prazo de 15 minutos/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/cancelado/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/liberado/i);
    expect(screen.queryByRole('button', { name: 'Pagar' })).not.toBeInTheDocument();
  });

  it('prazo vencido, antes do servidor cancelar: avisa e não deixa pagar', () => {
    render(PainelPagamento, { ag: ag({ pagamento: pag('pendente', daqui(-1)) }) as any });
    expect(screen.getByText('Prazo vencido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagar' })).not.toBeInTheDocument();
  });

  it('pago após cancelamento: "em análise", sem pedir pagamento de novo', () => {
    render(PainelPagamento, { ag: ag({ status: 'cancelado', pagamento: pag('pago_apos_cancelamento') }) as any });
    expect(screen.getByText('Pagamento em análise')).toBeInTheDocument();
    expect(screen.getByText(/não precisa pagar de novo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagar' })).not.toBeInTheDocument();
  });

  it('erro ao abrir o pagamento aparece na tela', async () => {
    m.pagar.mockRejectedValue(new Error('Sem conexão com o servidor. Verifique a internet.'));
    render(PainelPagamento, { ag: ag() as any });
    await fireEvent.click(screen.getByRole('button', { name: 'Pagar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Sem conexão/);
  });

  it('agendamento em andamento ou finalizado sem pagamento: nada a mostrar', () => {
    const { container } = render(PainelPagamento, { ag: ag({ status: 'em_andamento' }) as any });
    expect(container.querySelector('section')).toBeNull();
  });
});
