// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import '@testing-library/jest-dom/vitest';

const m = vi.hoisted(() => ({
  goto: vi.fn(),
  sair: vi.fn(),
  auth: { carregando: false, usuario: null as unknown, perfil: null as unknown, sair: undefined as unknown },
  agendamentos: [] as any[],
  servicos: [] as any[]
}));

vi.mock('$app/navigation', () => ({ goto: m.goto }));
vi.mock('$lib/auth.svelte', () => ({
  authStore: new Proxy(m.auth, {
    get: (t, k) => (k === 'sair' ? m.sair : (t as any)[k])
  })
}));
vi.mock('$lib/firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('$lib/app.svelte', () => ({
  app: {
    get agendamentos() {
      return m.agendamentos;
    },
    get avaliados() {
      return m.agendamentos.filter((a) => a.avaliacao);
    },
    get receita() {
      return 12345;
    },
    get notaMedia() {
      return 4.5;
    }
  },
  rotuloStatus: { agendado: 'Agendado', em_andamento: 'Em atendimento', finalizado: 'Finalizado', cancelado: 'Cancelado' }
}));
vi.mock('$lib/catalogo.svelte', () => ({
  get servicos() {
    return m.servicos;
  },
  alternarServico: vi.fn(),
  publicarCatalogoInicial: vi.fn(),
  salvarPrecoServico: vi.fn()
}));
vi.mock('$lib/admin-resumo', () => ({
  contarUsuarios: async () => 5,
  contarCondominios: async () => 2,
  plural: (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`
}));
// Seções que reaproveitam componentes existentes: só as dependências deles são trocadas
vi.mock('$lib/custos-admin', () => ({ listarCustos: async () => [] }));
vi.mock('$lib/dashboard-dados', () => ({
  contarUsuarios: async () => ({ cliente: 1, gerente: 0, funcionario: 0, admin: 1 }),
  contarPorStatus: async () => ({ agendado: 1, em_andamento: 0, finalizado: 1, cancelado: 0 }),
  faturamento: async () => ({ centavos: 0, pagos: 0 }),
  agendamentosDoPeriodo: async () => [],
  ultimasMovimentacoes: async () => []
}));
vi.mock('$lib/api', () => ({ chamarApi: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nome: string) => ({ nome }),
  getDocs: async () => ({ docs: [] })
}));
vi.mock('$lib/condominios-admin', () => ({
  listarCondominios: async () => [],
  criarCondominio: vi.fn(),
  renomearCondominio: vi.fn(),
  removerCondominio: vi.fn(),
  definirCapacidade: vi.fn(),
  lerCapacidadeInsulfilm: async () => 1,
  salvarCapacidadeInsulfilm: vi.fn(),
  CAPACIDADE_MAX: 20,
  capacidadeValida: (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 20
}));

import Home from './+page.svelte';
import Layout from './+layout.svelte';
import Agendamentos from './agendamentos/+page.svelte';
import Precos from './precos/+page.svelte';
import Avaliacoes from './avaliacoes/+page.svelte';
import Usuarios from './usuarios/+page.svelte';
import Condominios from './condominios/+page.svelte';
import DashboardAntigo from './dashboard/+page.svelte';
import { page } from '$app/state';

const ag = (id: string, extra = {}) => ({
  id,
  itens: [{ servicoId: 's1', nome: 'Banho', precoCentavos: 6500 }],
  data: '2030-01-01',
  inicio: new Date(2030, 0, 1, 9, 0),
  hora: '09:00',
  veiculo: { modelo: 'Gol', placa: 'ABC1D23' },
  total: 6500,
  status: 'agendado',
  externo: false,
  avaliacao: null,
  ...extra
});

beforeEach(() => {
  vi.clearAllMocks();
  m.agendamentos = [ag('a1'), ag('a2', { status: 'finalizado', avaliacao: { nota: 5, nps: 10, comentario: 'Ótimo' } })];
  m.servicos = Array.from({ length: 11 }, (_, i) => ({
    id: `s${i}`, nome: `Serviço ${i}`, duracao: 30, avulso: false, publicado: true, ativo: true, preco: 65, precoCentavos: 6500
  }));
  m.auth.carregando = false;
  m.auth.usuario = { uid: 'adm' };
  m.auth.perfil = { nome: 'Admin', email: 'adm@ex.com', role: 'admin', condominioId: null };
});

describe('tela inicial do admin', () => {
it('o dashboard é a página inicial: período, cartões e blocos, já abertos', async () => {    render(Home);    expect(screen.getByRole('group', { name: 'Período' })).toBeInTheDocument();    expect(screen.getByRole('region', { name: 'Agora' })).toBeInTheDocument();    await waitFor(() => expect(screen.getByRole('region', { name: 'Financeiro' })).toHaveTextContent('Faturamento'));    expect(screen.getByRole('region', { name: 'Usuários' })).toBeInTheDocument();  });

  it('não tem mais abas horizontais', () => {
    render(Home);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it.each([
    ['Agendamentos', '/admin/agendamentos', '2 agendamentos'],
    ['Serviços e preços', '/admin/precos', '11 serviços'],
    ['Avaliações', '/admin/avaliacoes', '1 avaliação'],
    ['Usuários', '/admin/usuarios', '5 usuários'],
    ['Condomínios', '/admin/condominios', '2 condomínios']
  ])('cartão %s leva a %s e mostra "%s"', async (titulo, href, contexto) => {
    render(Home);
    const nav = screen.getByRole('navigation', { name: 'Seções do painel' });
    const cartao = Array.from(nav.querySelectorAll('a')).find((a) => a.textContent?.includes(titulo))!;
    expect(cartao).toBeTruthy();
    expect(cartao).toHaveAttribute('href', href);
    await waitFor(() => expect(cartao).toHaveTextContent(contexto));
  });

  it('são exatamente 7 cartões de gestão (sem Dashboard, que é a própria página)', () => {
    render(Home);
    expect(screen.getByRole('navigation', { name: 'Seções do painel' }).querySelectorAll('a')).toHaveLength(7);
  });

  it('não tem entrada para mensagens (o cliente fala com o gerente, não com o admin)', () => {
    const { container } = render(Home);
    expect(container.querySelector('a[href="/gerente/chat"]')).toBeNull();
    expect(screen.queryByRole('link', { name: /conversas|mensagens/i })).toBeNull();
  });

  it('não tem card Dashboard', () => {
    render(Home);
    const nav = screen.getByRole('navigation', { name: 'Seções do painel' });
    expect(nav.querySelector('a[href="/admin/dashboard"]')).toBeNull();
  });

  it('tem o botão de sair', () => {
    render(Home);
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });
});

describe('seções (rotas próprias com voltar para /admin)', () => {
  it.each([
    ['Agendamentos', Agendamentos],
    ['Preços', Precos],
    ['Avaliações', Avaliacoes],
    ['Usuários', Usuarios],
    ['Condomínios', Condominios]
  ])('%s: título e botão de voltar para /admin', (titulo, Pagina) => {
    render(Pagina as any);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(titulo);
    const voltar = screen.getByRole('link', { name: 'Voltar ao painel' });
    expect(voltar).toHaveAttribute('href', '/admin');
  });

  it('agendamentos lista os agendamentos e cada um abre o detalhe', () => {
    render(Agendamentos);
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/admin/agendamentos/'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/admin/agendamentos/a1', '/admin/agendamentos/a2']);
  });

  it('avaliações mostra só os agendamentos avaliados', () => {
    render(Avaliacoes);
    expect(screen.getByText('“Ótimo”')).toBeInTheDocument();
    expect(screen.getByText(/Nota 5\/5/)).toBeInTheDocument();
  });

  it('preços lista os serviços do catálogo', () => {
    render(Precos);
    expect(screen.getByText('Serviço 0')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(11);
  });

  it('condomínios: o campo do insulfilm fica num cartão próprio, com rótulo claro e Salvar', async () => {
    render(Condominios);
    const cartao = screen.getByRole('region', { name: 'Insulfilm' });
    expect(cartao).toHaveTextContent('Vagas por horário');
    expect(cartao.querySelector('input')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Novo condomínio' })).toBeInTheDocument();
    expect(cartao.contains(screen.getByRole('button', { name: 'Novo condomínio' }))).toBe(false);
  });
});

describe('rota antiga /admin/dashboard', () => {
  it('redireciona para /admin', async () => {
    render(DashboardAntigo);
    await waitFor(() => expect(m.goto).toHaveBeenCalledWith('/admin', { replaceState: true }));
  });
});

describe('lista de agendamentos filtrada pelos cartões', () => {
  it('?status= filtra e mostra o aviso com opção de ver todos', () => {
    (page as any).url = new URL('http://localhost/admin/agendamentos?status=finalizado');
    try {
      render(Agendamentos);
      const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/admin/agendamentos/'));
      expect(links.map((a) => a.getAttribute('href'))).toEqual(['/admin/agendamentos/a2']);
      expect(screen.getByRole('link', { name: 'Ver todos' })).toBeInTheDocument();
    } finally {
      (page as any).url = new URL('http://localhost/');
    }
  });
});

describe('acesso: só admin', () => {
  const conteudo = createRawSnippet(() => ({ render: () => '<p>Painel</p>' }));

  it('admin entra', () => {
    render(Layout, { children: conteudo });
    expect(screen.getByText('Painel')).toBeInTheDocument();
    expect(m.goto).not.toHaveBeenCalled();
  });

  it.each(['cliente', 'gerente', 'funcionario'])('%s é barrado e volta ao login', (role) => {
    m.auth.perfil = { nome: 'x', email: 'x@ex.com', role, condominioId: null };
    render(Layout, { children: conteudo });
    expect(screen.queryByText('Painel')).not.toBeInTheDocument();
    expect(m.goto).toHaveBeenCalledWith('/', { replaceState: true });
  });

  it('sem login é barrado', () => {
    m.auth.usuario = null;
    m.auth.perfil = null;
    render(Layout, { children: conteudo });
    expect(screen.queryByText('Painel')).not.toBeInTheDocument();
    expect(m.goto).toHaveBeenCalledWith('/', { replaceState: true });
  });
});
