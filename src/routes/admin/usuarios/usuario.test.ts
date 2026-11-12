// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';

const m = vi.hoisted(() => ({
  params: { uid: 'c1' } as Record<string, string>,
  perfil: null as any,
  pagina: vi.fn(),
  contar: vi.fn(),
  chamarApi: vi.fn(),
  agendamento: vi.fn()
}));

vi.mock('$app/state', () => ({ page: { params: m.params } }));
vi.mock('$lib/firebase', () => ({ db: {}, auth: {} }));
vi.mock('$lib/api', () => ({ chamarApi: m.chamarApi }));
vi.mock('$lib/usuario-dados', () => ({
  POR_PAGINA: 25,
  campoDoPapel: (r: string) => (r === 'cliente' ? 'clienteId' : r === 'funcionario' ? 'funcionarioId' : null),
  carregarPerfil: async () => m.perfil,
  nomeDoCondominio: async (id: string | null) => (id ? 'Torre 10' : ''),
  carregarPagina: m.pagina,
  contarAgendamentos: m.contar,
  carregarAgendamento: m.agendamento
}));

import Usuario from './[uid]/+page.svelte';
import Agendamento from './[uid]/agendamento/[id]/+page.svelte';

const ag = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  clienteId: 'c1',
  clienteNome: 'Ana',
  condominioId: 'torre-10',
  itens: [{ servicoId: 'eco01', nome: 'Banho Básico', precoCentavos: 6500 }],
  total: 6500,
  data: '2030-06-10',
  hora: '09:00',
  inicio: new Date('2030-06-10T12:00:00Z'),
  status: 'finalizado',
  funcionarioId: null,
  funcionarioNome: null,
  veiculo: { modelo: 'Gol', placa: 'ABC1D23' },
  observacoes: '',
  checklist: { fotos: {} },
  avaliacao: null,
  pagamento: null,
  externo: false,
  vagaId: '',
  criadoEm: null,
  ...extra
});

beforeEach(() => {
  vi.clearAllMocks();
  m.params.uid = 'c1';
  m.perfil = { nome: 'Ana', email: 'ana@ex.com', role: 'cliente', condominioId: 'torre-10', especialidade: null };
  m.chamarApi.mockResolvedValue({ criadoEm: '2030-01-01T10:00:00.000Z', ultimoAcesso: null });
  m.contar.mockResolvedValue(3);
  m.pagina.mockResolvedValue({
    itens: [
      ag('a1', {
        status: 'finalizado',
        pagamento: { status: 'pago', venceEm: null, revisao: false, pagoEm: new Date('2030-06-10T10:00:00Z') },
        avaliacao: { nota: 5, nps: 9, comentario: 'ótimo', em: new Date('2030-06-11T10:00:00Z') }
      }),
      ag('a2', { status: 'agendado', pagamento: { status: 'pendente', venceEm: null, revisao: false } }),
      ag('a3', { status: 'cancelado' })
    ],
    cursor: null,
    temMais: false
  });
});

describe('tela do usuário (admin)', () => {
  it('mostra identidade, cadastro, resumo (só pagos) e os agendamentos com os em aberto no topo', async () => {
    render(Usuario);
    expect(await screen.findByText('ana@ex.com')).toBeInTheDocument();
    expect(m.chamarApi).toHaveBeenCalledWith('detalhe', { uid: 'c1' });
    await waitFor(() => expect(screen.getByText('Torre 10')).toBeInTheDocument());
    expect(screen.getByText('Total gasto (pagos)').nextElementSibling).toHaveTextContent('R$ 65,00');
    const itens = await screen.findAllByRole('link', { name: /Banho Básico/ });
    expect(itens).toHaveLength(3);
    expect(itens[0]).toHaveAttribute('href', '/admin/usuarios/c1/agendamento/a2');
  });

  it('filtro "Em aberto" e seções Pagamentos e Avaliações abrem o agendamento', async () => {
    render(Usuario);
    await screen.findAllByRole('link', { name: /Banho Básico/ });
    await fireEvent.click(screen.getByRole('button', { name: 'Em aberto' }));
    expect(screen.getAllByRole('link', { name: /Banho Básico/ })).toHaveLength(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Pagamentos' }));
    expect(screen.getAllByRole('link', { name: /R\$\s65,00/ })).toHaveLength(2);
    await fireEvent.click(screen.getByRole('button', { name: 'Avaliações' }));
    expect(screen.getByText('ótimo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver agendamento' })).toHaveAttribute('href', '/admin/usuarios/c1/agendamento/a1');
  });

  it('vazio e erro de carregamento ficam visíveis', async () => {
    m.pagina.mockResolvedValueOnce({ itens: [], cursor: null, temMais: false });
    const r = render(Usuario);
    expect(await screen.findByText('Nenhum agendamento ainda.')).toBeInTheDocument();
    r.unmount();

    m.pagina.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    render(Usuario);
    expect(await screen.findByText(/Não foi possível carregar os agendamentos/)).toBeInTheDocument();
  });

  it('paginação: Carregar mais pede a próxima página e junta os itens', async () => {
    m.pagina.mockResolvedValueOnce({ itens: [ag('p1')], cursor: { id: 'c' }, temMais: true });
    m.pagina.mockResolvedValueOnce({ itens: [ag('p2')], cursor: null, temMais: false });
    render(Usuario);
    await screen.findAllByRole('link', { name: /Banho Básico/ });
    expect(screen.getByText(/Resumo parcial/)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: /Carregar mais/ }));
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Banho Básico/ })).toHaveLength(2));
    expect(screen.queryByText(/Resumo parcial/)).not.toBeInTheDocument();
  });

  it('aviso visível quando cadastro e último acesso falham; usuário inexistente mostra mensagem', async () => {
    m.chamarApi.mockRejectedValueOnce(new Error('Servidor fora do ar.'));
    const r = render(Usuario);
    expect(await screen.findByText('Servidor fora do ar.')).toBeInTheDocument();
    r.unmount();
    m.perfil = null;
    render(Usuario);
    expect(await screen.findByText(/Usuário não encontrado/)).toBeInTheDocument();
  });

  it('gerente: só identidade; funcionário: atendimentos, sem pagamentos nem avaliações', async () => {
    m.perfil = { nome: 'Gui', email: 'gui@ex.com', role: 'gerente', condominioId: null, especialidade: null };
    const r = render(Usuario);
    expect(await screen.findByText(/só a identidade/)).toBeInTheDocument();
    expect(m.pagina).not.toHaveBeenCalled();
    r.unmount();
    m.perfil = { nome: 'Fun', email: 'f@ex.com', role: 'funcionario', condominioId: null, especialidade: null };
    render(Usuario);
    expect(await screen.findByRole('button', { name: 'Atendimentos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagamentos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Avaliações' })).not.toBeInTheDocument();
  });
});

describe('tela do agendamento (admin)', () => {
  it('mostra itens com preço do momento, total, veículo, condomínio, pagamento e avaliação', async () => {
    m.params.id = 'a1';
    m.agendamento.mockResolvedValue(
      ag('a1', {
        funcionarioNome: 'Fran',
        pagamento: { status: 'pago', venceEm: null, revisao: false, pagoEm: new Date('2030-06-10T10:00:00Z') },
        avaliacao: { nota: 4, nps: 8, comentario: 'bom', em: new Date('2030-06-11T10:00:00Z') },
        criadoEm: new Date('2030-06-01T10:00:00Z')
      })
    );
    render(Agendamento);
    expect(await screen.findByText('Gol · ABC1D23')).toBeInTheDocument();
    expect(screen.getByText('Fran')).toBeInTheDocument();
    expect(screen.getByText('30 min (catálogo atual)')).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s65,00/).length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(screen.getByText('Torre 10')).toBeInTheDocument());
    expect(screen.getByText('Pago')).toBeInTheDocument();
    expect(screen.getByText('bom')).toBeInTheDocument();
    expect(screen.getByText('Agendamento criado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voltar ao usuário/ })).toHaveAttribute('href', '/admin/usuarios/c1');
  });

  it('não encontrado e erro de rede mostram mensagem com tentar de novo', async () => {
    m.params.id = 'x';
    m.agendamento.mockResolvedValueOnce(null);
    const r = render(Agendamento);
    expect(await screen.findByText('Agendamento não encontrado.')).toBeInTheDocument();
    r.unmount();
    m.agendamento.mockRejectedValueOnce(new Error('rede'));
    render(Agendamento);
    expect(await screen.findByText(/Não foi possível carregar o agendamento/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });
});
