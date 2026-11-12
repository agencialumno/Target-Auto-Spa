// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';

const m = vi.hoisted(() => ({
  usuarios: [] as { id: string; data: Record<string, unknown> }[],
  condominios: [] as { id: string; data: Record<string, unknown> }[],
  chamarApi: vi.fn()
}));

vi.mock('$lib/firebase', () => ({ db: {}, auth: {} }));
vi.mock('$lib/api', () => ({ chamarApi: m.chamarApi }));
vi.mock('$lib/auth.svelte', () => ({ authStore: { usuario: { uid: 'adm' } } }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nome: string) => ({ nome }),
  getDocs: async (c: { nome: string }) => ({
    docs: (c.nome === 'users' ? m.usuarios : m.condominios).map((d) => ({ id: d.id, data: () => d.data }))
  })
}));

import GerenciarUsuarios from './GerenciarUsuarios.svelte';

beforeEach(() => {
  vi.clearAllMocks();
  m.usuarios = [
    { id: 'adm', data: { nome: 'Admin', email: 'adm@ex.com', role: 'admin', condominioId: null } },
    { id: 'c1', data: { nome: 'Ana', email: 'ana@ex.com', role: 'cliente', condominioId: 'torre-10' } },
    { id: 'g1', data: { nome: 'Gui', email: 'gui@ex.com', role: 'gerente', condominioId: null } },
    { id: 'i1', data: { nome: 'Ivo', email: 'ivo@ex.com', role: 'funcionario', especialidade: 'insulfilm', condominioId: null } }
  ];
  m.condominios = [
    { id: 'torre-10', data: { nome: 'Torre 10' } },
    { id: 'sol', data: { nome: 'Edifício Sol' } }
  ];
  m.chamarApi.mockResolvedValue({ ok: true });
});

async function abrir() {
  render(GerenciarUsuarios);
  await screen.findByText('Ana');
}

describe('vínculo com condomínio', () => {
  it('botão só para cliente e gerente (não para admin nem funcionário)', async () => {
    await abrir();
    expect(screen.getByRole('button', { name: 'Condomínio de Ana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Condomínio de Gui' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Condomínio de Ivo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Condomínio de Admin' })).not.toBeInTheDocument();
  });

  it('mostra o nome do condomínio (não o id) na lista', async () => {
    await abrir();
    await waitFor(() => expect(screen.getByText(/Torre 10/)).toBeInTheDocument());
  });

  it('admin vincula um gerente a um condomínio pela API', async () => {
    await abrir();
    await fireEvent.click(screen.getByRole('button', { name: 'Condomínio de Gui' }));
    const caixa = screen.getByRole('dialog', { name: 'Condomínio do usuário' });
    await fireEvent.change(await within(caixa).findByRole('combobox'), { target: { value: 'sol' } });
    await fireEvent.click(within(caixa).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(m.chamarApi).toHaveBeenCalledWith('condominio', { uid: 'g1', condominioId: 'sol' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('admin troca o condomínio de um cliente', async () => {
    await abrir();
    await fireEvent.click(screen.getByRole('button', { name: 'Condomínio de Ana' }));
    const caixa = screen.getByRole('dialog');
    const select = (await within(caixa).findByRole('combobox')) as HTMLSelectElement;
    expect(select.value).toBe('torre-10');
    await fireEvent.change(select, { target: { value: 'sol' } });
    await fireEvent.click(within(caixa).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(m.chamarApi).toHaveBeenCalledWith('condominio', { uid: 'c1', condominioId: 'sol' }));
  });

  it('"Sem condomínio" envia null', async () => {
    await abrir();
    await fireEvent.click(screen.getByRole('button', { name: 'Condomínio de Ana' }));
    const caixa = screen.getByRole('dialog');
    await fireEvent.change(await within(caixa).findByRole('combobox'), { target: { value: '' } });
    await fireEvent.click(within(caixa).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(m.chamarApi).toHaveBeenCalledWith('condominio', { uid: 'c1', condominioId: null }));
  });

  it('erro da API aparece e a janela continua aberta', async () => {
    m.chamarApi.mockRejectedValue(new Error('Apenas administradores podem fazer isso.'));
    await abrir();
    await fireEvent.click(screen.getByRole('button', { name: 'Condomínio de Gui' }));
    await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Apenas administradores podem fazer isso.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('criar usuário (o toque no botão sempre responde)', () => {
  const SENHA_OK = 'Abcdef1!x';

  async function abrirForm() {
    await abrir();
    await fireEvent.click(screen.getByRole('button', { name: 'Novo usuário' }));
    return screen.getByRole('dialog', { name: 'Novo usuário' });
  }

  type Campos = { nome?: string; email?: string; senha?: string; papel?: string; especialidade?: string; condominio?: string };

  async function preencher(caixa: HTMLElement, campos: Campos) {
    const c = { nome: 'Novo Nome', email: 'novo@ex.com', senha: SENHA_OK, ...campos };
    await fireEvent.input(within(caixa).getByLabelText('Nome'), { target: { value: c.nome } });
    await fireEvent.input(within(caixa).getByLabelText('E-mail'), { target: { value: c.email } });
    await fireEvent.input(within(caixa).getByLabelText(/Senha temporária/), { target: { value: c.senha } });
    if (c.papel) await fireEvent.change(within(caixa).getByLabelText('Papel'), { target: { value: c.papel } });
    if (c.especialidade) await fireEvent.change(within(caixa).getByLabelText('Especialidade'), { target: { value: c.especialidade } });
    if (c.condominio) await fireEvent.input(within(caixa).getByLabelText(/Condomínio \(id\)/), { target: { value: c.condominio } });
  }

  const tocar = (caixa: HTMLElement) => fireEvent.click(within(caixa).getByRole('button', { name: /Criar usuário|Criando/ }));

  // Cada papel com cada regra inválida: a mensagem aparece, o campo fica vermelho e a API NÃO é chamada
  const PAPEIS: [string, Campos][] = [
    ['cliente', { papel: 'cliente' }],
    ['gerente', { papel: 'gerente' }],
    ['funcionário', { papel: 'funcionario' }],
    ['funcionário insulfilm', { papel: 'funcionario', especialidade: 'insulfilm' }],
    ['admin', { papel: 'admin' }]
  ];

  const REGRAS: [string, Campos, RegExp, string][] = [
    ['sem nome', { nome: '  ' }, /Informe o nome\./, 'Nome'],
    ['nome grande demais', { nome: 'x'.repeat(101) }, /no máximo 100 caracteres/, 'Nome'],
    ['sem e-mail', { email: '' }, /Informe o e-mail\./, 'E-mail'],
    ['e-mail inválido', { email: 'sem-arroba' }, /e-mail parece inválido/i, 'E-mail'],
    ['sem senha', { senha: '' }, /Informe uma senha temporária\./, 'Senha temporária'],
    ['senha curta', { senha: 'Ab1!' }, /Senha precisa de pelo menos 8 caracteres/, 'Senha temporária'],
    ['senha sem maiúscula', { senha: 'abcdef1!x' }, /Senha precisa de uma letra maiúscula/, 'Senha temporária'],
    ['senha sem minúscula', { senha: 'ABCDEF1!X' }, /Senha precisa de uma letra minúscula/, 'Senha temporária'],
    ['senha sem número', { senha: 'Abcdefg!x' }, /Senha precisa de um número/, 'Senha temporária'],
    ['senha sem caractere especial', { senha: 'Abcdefg1x' }, /Senha precisa de um caractere especial/, 'Senha temporária']
  ];

  for (const [papelNome, papel] of PAPEIS) {
    describe(papelNome, () => {
      it.each(REGRAS)('%s: mensagem visível, campo em vermelho, API não chamada', async (_r, invalido, mensagem, rotulo) => {
        const caixa = await abrirForm();
        await preencher(caixa, { ...papel, ...invalido });
        const botao = within(caixa).getByRole('button', { name: 'Criar usuário' });
        expect(botao).toBeEnabled(); // o botão não fica "morto"
        await fireEvent.click(botao);
        expect(await within(caixa).findByRole('alert')).toHaveTextContent(mensagem);
        expect(within(caixa).getByLabelText(rotulo === 'Senha temporária' ? /Senha temporária/ : rotulo)).toHaveAttribute('aria-invalid', 'true');
        expect(m.chamarApi).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog', { name: 'Novo usuário' })).toBeInTheDocument();
        expect(within(caixa).getByRole('button', { name: 'Criar usuário' })).toBeEnabled();
      });

      it('dados válidos: chama a API e mostra a confirmação', async () => {
        const caixa = await abrirForm();
        await preencher(caixa, papel);
        await tocar(caixa);
        const esperado = {
          nome: 'Novo Nome',
          email: 'novo@ex.com',
          senha: SENHA_OK,
          role: papel.papel,
          condominioId: null,
          especialidade: papel.especialidade ?? null
        };
        await waitFor(() => expect(m.chamarApi).toHaveBeenCalledWith('criar', esperado));
        expect(await screen.findByRole('status')).toHaveTextContent('Usuário Novo Nome criado com sucesso.');
        expect(screen.queryByRole('dialog', { name: 'Novo usuário' })).not.toBeInTheDocument();
      });
    });
  }

  it('gerente com id de condomínio: o id vai na chamada', async () => {
    const caixa = await abrirForm();
    await preencher(caixa, { papel: 'gerente', condominio: 'torre-10' });
    await tocar(caixa);
    await waitFor(() => expect(m.chamarApi).toHaveBeenCalledWith('criar', expect.objectContaining({ role: 'gerente', condominioId: 'torre-10' })));
  });

  it('cliente com id de condomínio inválido: recusado com mensagem, sem chamar a API', async () => {
    const caixa = await abrirForm();
    await preencher(caixa, { papel: 'cliente', condominio: '../x' });
    await tocar(caixa);
    expect(await within(caixa).findByRole('alert')).toHaveTextContent(/id do condomínio/i);
    expect(within(caixa).getByLabelText(/Condomínio \(id\)/)).toHaveAttribute('aria-invalid', 'true');
    expect(m.chamarApi).not.toHaveBeenCalled();
  });

  it('o checklist da senha: verde em tempo real; só depois da 1ª tentativa o que falta fica vermelho', async () => {
    const caixa = await abrirForm();
    await fireEvent.input(within(caixa).getByLabelText(/Senha temporária/), { target: { value: 'Abcdefgh' } });
    const lista = within(caixa).getByRole('list', { name: 'Requisitos da senha' });
    const itens = () => Array.from(lista.querySelectorAll('li'));
    expect(itens().filter((li) => li.classList.contains('ok'))).toHaveLength(3); // tamanho, maiúscula, minúscula
    expect(itens().some((li) => li.classList.contains('falha'))).toBe(false); // ainda sem tentativa
    await fireEvent.click(within(caixa).getByRole('button', { name: 'Criar usuário' }));
    await within(caixa).findByRole('alert');
    expect(itens().filter((li) => li.classList.contains('falha'))).toHaveLength(2); // número, especial
    await fireEvent.input(within(caixa).getByLabelText(/Senha temporária/), { target: { value: 'Abcdefg1!' } });
    expect(itens().every((li) => li.classList.contains('ok'))).toBe(true);
  });

  it('a mensagem de erro fica logo acima do botão', async () => {
    const caixa = await abrirForm();
    await preencher(caixa, { email: '' });
    await tocar(caixa);
    const alerta = await within(caixa).findByRole('alert');
    expect(alerta.nextElementSibling).toBe(within(caixa).getByRole('button', { name: 'Criar usuário' }));
  });

  it('o botão mostra "Criando..." e fica ocupado enquanto a API não responde', async () => {
    let terminar: (v?: unknown) => void = () => {};
    m.chamarApi.mockReturnValue(new Promise((ok) => (terminar = ok)));
    const caixa = await abrirForm();
    await preencher(caixa, { papel: 'cliente' });
    await tocar(caixa);
    const botao = await within(caixa).findByRole('button', { name: 'Criando...' });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute('aria-busy', 'true');
    terminar({ ok: true });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Novo usuário' })).not.toBeInTheDocument());
  });

  it('o formulário não depende da validação nativa do navegador (novalidate)', async () => {
    const caixa = await abrirForm();
    expect(caixa.querySelector('form')?.hasAttribute('novalidate')).toBe(true);
  });

  it.each([
    ['servidor', new Error('Já existe uma conta com esse e-mail.'), /Já existe uma conta/],
    ['rede', new Error('Sem conexão com o servidor. Verifique a internet.'), /Sem conexão/],
    ['HTTP 500', new Error('Erro inesperado no servidor (HTTP 500).'), /HTTP 500/]
  ])('falha de %s aparece para o admin e o botão volta a funcionar', async (_nome, erro, mensagem) => {
    m.chamarApi.mockRejectedValue(erro);
    const caixa = await abrirForm();
    await preencher(caixa, { papel: 'cliente' });
    await tocar(caixa);
    expect(await within(caixa).findByRole('alert')).toHaveTextContent(mensagem);
    expect(within(caixa).getByRole('button', { name: 'Criar usuário' })).toBeEnabled();
  });

  it('falha sem mensagem (erro estranho) mostra o texto padrão', async () => {
    m.chamarApi.mockRejectedValue({});
    const caixa = await abrirForm();
    await preencher(caixa, { papel: 'cliente' });
    await tocar(caixa);
    expect(await within(caixa).findByRole('alert')).toHaveTextContent('Não foi possível criar o usuário.');
  });
});

describe('toque no card abre a tela do usuário', () => {
  it('o card é um link para /admin/usuarios/{uid} e não existe mais o botão "Detalhes"', async () => {
    await abrir();
    expect(screen.getByRole('link', { name: 'Abrir Ana' })).toHaveAttribute('href', '/admin/usuarios/c1');
    expect(screen.queryByRole('button', { name: /Detalhes de/ })).not.toBeInTheDocument();
  });
});
