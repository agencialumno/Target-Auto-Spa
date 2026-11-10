// @vitest-environment jsdom
// Formulários de entrada do app (login, cadastro e "qual é o seu condomínio?"): nenhum falha em silêncio.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';

const m = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => ({ goto: m.goto }));
vi.mock('$lib/auth.svelte', async () => {
  const { AuthFalso } = await import('$lib/testes/auth-falso.svelte');
  return { authStore: new AuthFalso() };
});

import { authStore } from '$lib/auth.svelte';
const auth = authStore as unknown as InstanceType<typeof import('$lib/testes/auth-falso.svelte').AuthFalso>;

import Login from './+page.svelte';
import EntrarCondominio from './entrar-condominio/+page.svelte';

const SENHA_OK = 'Abcdef1!x';

beforeEach(() => {
  vi.clearAllMocks();
  auth.erro = '';
  auth.usuario = null;
  auth.perfil = null;
  auth.entrar.mockResolvedValue(undefined);
  auth.cadastrar.mockResolvedValue(undefined);
  auth.entrarNoCondominio.mockResolvedValue('ok');
});

const formulario = (container: HTMLElement) => container.querySelector('form') as HTMLFormElement;

async function abrirCadastro() {
  const r = render(Login);
  await fireEvent.click(screen.getAllByRole('button', { name: 'Criar conta' })[0]);
  return within(formulario(r.container));
}

describe('cadastro', () => {
  const preencher = async (f: ReturnType<typeof within>, c: { nome?: string; email?: string; senha?: string }) => {
    const v = { nome: 'Ana Souza', email: 'ana@ex.com', senha: SENHA_OK, ...c };
    await fireEvent.input(f.getByPlaceholderText('Seu nome'), { target: { value: v.nome } });
    await fireEvent.input(f.getByPlaceholderText('voce@exemplo.com'), { target: { value: v.email } });
    await fireEvent.input(f.getByPlaceholderText('••••••••'), { target: { value: v.senha } });
  };

  it.each([
    ['sem nome', { nome: '' }, /Informe o seu nome\./, 'Seu nome'],
    ['sem e-mail', { email: '' }, /Informe o e-mail\./, 'voce@exemplo.com'],
    ['e-mail inválido', { email: 'ana@' }, /e-mail parece inválido/i, 'voce@exemplo.com'],
    ['sem senha', { senha: '' }, /Informe a senha\./, '••••••••'],
    ['senha curta', { senha: 'Ab1!' }, /pelo menos 8 caracteres/, '••••••••'],
    ['sem maiúscula', { senha: 'abcdef1!x' }, /letra maiúscula/, '••••••••'],
    ['sem minúscula', { senha: 'ABCDEF1!X' }, /letra minúscula/, '••••••••'],
    ['sem número', { senha: 'Abcdefg!x' }, /Senha precisa de um número/, '••••••••'],
    ['sem caractere especial', { senha: 'Abcdefg1x' }, /caractere especial/, '••••••••']
  ])('%s: mensagem, campo em vermelho e cadastro não chamado', async (_n, invalido, mensagem, placeholder) => {
    const f = await abrirCadastro();
    await preencher(f, invalido);
    const botao = f.getByRole('button', { name: 'Criar conta' });
    expect(botao).toBeEnabled(); // o botão nunca fica "morto"
    await fireEvent.click(botao);
    expect(await f.findByRole('alert')).toHaveTextContent(mensagem);
    expect(f.getByPlaceholderText(placeholder)).toHaveAttribute('aria-invalid', 'true');
    expect(auth.cadastrar).not.toHaveBeenCalled();
  });

  it('dados válidos: cadastra e mostra a confirmação', async () => {
    const f = await abrirCadastro();
    await preencher(f, {});
    await fireEvent.click(f.getByRole('button', { name: 'Criar conta' }));
    await waitFor(() => expect(auth.cadastrar).toHaveBeenCalledWith('Ana Souza', 'ana@ex.com', SENHA_OK));
    expect(await screen.findByText('Cadastro realizado com sucesso')).toBeInTheDocument();
  });

  it('checklist da senha: verde em tempo real; o que falta fica vermelho depois da 1ª tentativa', async () => {
    const f = await abrirCadastro();
    await fireEvent.input(f.getByPlaceholderText('••••••••'), { target: { value: 'Abcdefgh' } });
    const itens = () => Array.from(f.getByRole('list', { name: 'Requisitos da senha' }).querySelectorAll('li'));
    expect(itens().filter((li) => li.classList.contains('ok'))).toHaveLength(3);
    expect(itens().some((li) => li.classList.contains('falha'))).toBe(false);
    await fireEvent.click(f.getByRole('button', { name: 'Criar conta' }));
    await f.findByRole('alert');
    expect(itens().filter((li) => li.classList.contains('falha'))).toHaveLength(2);
  });

  it('o erro real do servidor aparece (ex.: e-mail já usado), nunca em silêncio', async () => {
    auth.cadastrar.mockImplementation(async () => {
      auth.erro = 'Este e-mail já tem uma conta.';
      throw new Error('x');
    });
    const f = await abrirCadastro();
    await preencher(f, {});
    await fireEvent.click(f.getByRole('button', { name: 'Criar conta' }));
    expect(await f.findByRole('alert')).toHaveTextContent('Este e-mail já tem uma conta.');
  });

  it('mostra "Aguarde..." enquanto o cadastro não termina', async () => {
    let terminar: (v?: unknown) => void = () => {};
    auth.cadastrar.mockReturnValue(new Promise((ok) => (terminar = ok)));
    const f = await abrirCadastro();
    await preencher(f, {});
    await fireEvent.click(f.getByRole('button', { name: 'Criar conta' }));
    const botao = await f.findByRole('button', { name: 'Aguarde...' });
    expect(botao).toBeDisabled();
    terminar();
  });

  it('o formulário não usa a validação nativa (novalidate)', async () => {
    const r = render(Login);
    expect(formulario(r.container).hasAttribute('novalidate')).toBe(true);
  });
});

describe('login', () => {
  const abrir = () => {
    const r = render(Login);
    return within(formulario(r.container));
  };

  it.each([
    ['sem e-mail', { email: '', senha: 'qualquer' }, /Informe o e-mail\./],
    ['e-mail inválido', { email: 'ana', senha: 'qualquer' }, /e-mail parece inválido/i],
    ['sem senha', { email: 'ana@ex.com', senha: '' }, /Informe a senha\./]
  ])('%s: mensagem e entrar não chamado', async (_n, v, mensagem) => {
    const f = abrir();
    await fireEvent.input(f.getByPlaceholderText('voce@exemplo.com'), { target: { value: v.email } });
    await fireEvent.input(f.getByPlaceholderText('••••••••'), { target: { value: v.senha } });
    await fireEvent.click(f.getByRole('button', { name: 'Entrar' }));
    expect(await f.findByRole('alert')).toHaveTextContent(mensagem);
    expect(auth.entrar).not.toHaveBeenCalled();
  });

  it('dados válidos: chama entrar (a senha do login não precisa ser "forte")', async () => {
    const f = abrir();
    await fireEvent.input(f.getByPlaceholderText('voce@exemplo.com'), { target: { value: 'ana@ex.com' } });
    await fireEvent.input(f.getByPlaceholderText('••••••••'), { target: { value: 'abc123' } });
    await fireEvent.click(f.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(auth.entrar).toHaveBeenCalledWith('ana@ex.com', 'abc123'));
  });

  it('erro do Firebase (ex.: senha errada) aparece como alerta', async () => {
    auth.entrar.mockImplementation(async () => {
      auth.erro = 'E-mail ou senha incorretos.';
      throw new Error('x');
    });
    const f = abrir();
    await fireEvent.input(f.getByPlaceholderText('voce@exemplo.com'), { target: { value: 'ana@ex.com' } });
    await fireEvent.input(f.getByPlaceholderText('••••••••'), { target: { value: 'errada1' } });
    await fireEvent.click(f.getByRole('button', { name: 'Entrar' }));
    expect(await f.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('não mostra o checklist de senha no login', () => {
    abrir();
    expect(screen.queryByRole('list', { name: 'Requisitos da senha' })).not.toBeInTheDocument();
  });
});

describe('qual é o seu condomínio?', () => {
  it('nome vazio: o toque responde com mensagem, campo em vermelho, sem chamar a busca', async () => {
    render(EntrarCondominio);
    const botao = screen.getByRole('button', { name: 'Confirmar' });
    expect(botao).toBeEnabled();
    await fireEvent.click(botao);
    expect(await screen.findByRole('alert')).toHaveTextContent('Informe o nome do condomínio.');
    expect(screen.getByPlaceholderText(/Residencial/)).toHaveAttribute('aria-invalid', 'true');
    expect(auth.entrarNoCondominio).not.toHaveBeenCalled();
  });

  it('nome válido: busca e segue para o app', async () => {
    render(EntrarCondominio);
    await fireEvent.input(screen.getByPlaceholderText(/Residencial/), { target: { value: 'Torre 10' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(auth.entrarNoCondominio).toHaveBeenCalledWith('Torre 10'));
    await waitFor(() => expect(m.goto).toHaveBeenCalledWith('/cliente'));
  });

  it('condomínio não encontrado e falha de rede aparecem como alerta', async () => {
    render(EntrarCondominio);
    await fireEvent.input(screen.getByPlaceholderText(/Residencial/), { target: { value: 'Nada' } });
    auth.entrarNoCondominio.mockResolvedValueOnce('nao-encontrado');
    await fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Condomínio não encontrado/);
    auth.entrarNoCondominio.mockRejectedValueOnce(new Error('Sem conexão com o Firebase.'));
    await fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão com o Firebase.'));
  });
});
