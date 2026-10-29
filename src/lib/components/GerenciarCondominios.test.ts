// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';

const m = vi.hoisted(() => ({
  listarCondominios: vi.fn(),
  criarCondominio: vi.fn(),
  renomearCondominio: vi.fn(),
  removerCondominio: vi.fn()
}));

vi.mock('$lib/condominios-admin', () => m);

import GerenciarCondominios from './GerenciarCondominios.svelte';

const torre = {
  id: 'torre-10',
  nome: 'Torre 10',
  nomeNormalizado: 'torre 10',
  moradores: 2,
  gerentes: [{ uid: 'g1', nome: 'Gui' }],
  agendamentos: 1
};
const vazio = { id: 'vazio', nome: 'Sem Ninguém', nomeNormalizado: 'sem ninguem', moradores: 0, gerentes: [], agendamentos: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  m.listarCondominios.mockResolvedValue([torre, vazio]);
  m.criarCondominio.mockResolvedValue('novo');
  m.renomearCondominio.mockResolvedValue(undefined);
  m.removerCondominio.mockResolvedValue(undefined);
});

async function abrir() {
  render(GerenciarCondominios);
  await screen.findByText('Torre 10');
}

describe('lista', () => {
  it('mostra nome, moradores, gerente(s) e agendamentos', async () => {
    await abrir();
    expect(screen.getByText('Condomínios (2)')).toBeInTheDocument();
    expect(screen.getByText('2 moradores · 1 agendamento')).toBeInTheDocument();
    expect(screen.getByText(/Gerente:\s*Gui/)).toBeInTheDocument();
    expect(screen.getByText('0 moradores · 0 agendamentos')).toBeInTheDocument();
    expect(screen.getByText(/nenhum vinculado/)).toBeInTheDocument();
  });

  it('lista vazia orienta a criar o primeiro', async () => {
    m.listarCondominios.mockResolvedValue([]);
    render(GerenciarCondominios);
    expect(await screen.findByText(/Nenhum condomínio cadastrado/)).toBeInTheDocument();
  });

  it('erro ao carregar', async () => {
    m.listarCondominios.mockRejectedValue(new Error('x'));
    render(GerenciarCondominios);
    expect(await screen.findByText('Não foi possível carregar os condomínios.')).toBeInTheDocument();
  });
});

describe('criar', () => {
  it('botão desabilitado sem nome válido e mostra o identificador previsto', async () => {
    await abrir();
    await fireEvent.click(screen.getByText('Novo condomínio'));
    const caixa = screen.getByRole('dialog', { name: 'Novo condomínio' });
    const botao = within(caixa).getByRole('button', { name: 'Criar condomínio' });
    expect(botao).toBeDisabled();

    const campo = within(caixa).getByLabelText(/Nome do condomínio/);
    await fireEvent.input(campo, { target: { value: '   ' } });
    expect(botao).toBeDisabled();

    await fireEvent.input(campo, { target: { value: 'Residencial São João' } });
    expect(botao).toBeEnabled();
    expect(within(caixa).getByText('Identificador: residencial-sao-joao')).toBeInTheDocument();
  });

  it('só símbolos não habilita o botão', async () => {
    await abrir();
    await fireEvent.click(screen.getByText('Novo condomínio'));
    const caixa = screen.getByRole('dialog');
    await fireEvent.input(within(caixa).getByLabelText(/Nome do condomínio/), { target: { value: '***' } });
    expect(within(caixa).getByRole('button', { name: 'Criar condomínio' })).toBeDisabled();
  });

  it('cria, fecha o formulário e recarrega a lista', async () => {
    await abrir();
    await fireEvent.click(screen.getByText('Novo condomínio'));
    const caixa = screen.getByRole('dialog');
    await fireEvent.input(within(caixa).getByLabelText(/Nome do condomínio/), { target: { value: 'Torre Nova' } });
    await fireEvent.click(within(caixa).getByRole('button', { name: 'Criar condomínio' }));

    await waitFor(() => expect(m.criarCondominio).toHaveBeenCalledWith('Torre Nova'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(m.listarCondominios).toHaveBeenCalledTimes(2);
  });

  it('duplicado: mostra a mensagem e mantém o formulário aberto', async () => {
    m.criarCondominio.mockRejectedValue(new Error('Já existe um condomínio com esse nome.'));
    await abrir();
    await fireEvent.click(screen.getByText('Novo condomínio'));
    const caixa = screen.getByRole('dialog');
    await fireEvent.input(within(caixa).getByLabelText(/Nome do condomínio/), { target: { value: 'torre 10' } });
    await fireEvent.click(within(caixa).getByRole('button', { name: 'Criar condomínio' }));

    expect(await screen.findByText('Já existe um condomínio com esse nome.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(m.listarCondominios).toHaveBeenCalledTimes(1);
  });

  it('cancelar fecha sem criar', async () => {
    await abrir();
    await fireEvent.click(screen.getByText('Novo condomínio'));
    await fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(m.criarCondominio).not.toHaveBeenCalled();
  });
});

describe('editar', () => {
  it('abre com o nome atual, avisa que o identificador não muda e salva', async () => {
    await abrir();
    await fireEvent.click(screen.getByRole('button', { name: 'Editar Torre 10' }));
    const caixa = screen.getByRole('dialog', { name: 'Editar condomínio' });
    const campo = within(caixa).getByLabelText(/Nome do condomínio/) as HTMLInputElement;
    expect(campo.value).toBe('Torre 10');
    expect(within(caixa).getByText(/identificador \(torre-10\) não muda/i)).toBeInTheDocument();

    await fireEvent.input(campo, { target: { value: 'Torre Dez' } });
    await fireEvent.click(within(caixa).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(m.renomearCondominio).toHaveBeenCalledWith('torre-10', 'Torre Dez'));
    expect(m.criarCondominio).not.toHaveBeenCalled();
  });
});

describe('remover', () => {
  it('pede confirmação e só remove ao confirmar', async () => {
    await abrir();
    await fireEvent.click(screen.getByRole('button', { name: 'Remover Sem Ninguém' }));
    const caixa = screen.getByRole('dialog', { name: 'Confirmar remoção' });
    expect(m.removerCondominio).not.toHaveBeenCalled();

    await fireEvent.click(within(caixa).getByRole('button', { name: 'Remover' }));
    await waitFor(() => expect(m.removerCondominio).toHaveBeenCalledWith('vazio'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('vínculos existentes: mostra quantos e mantém a confirmação aberta', async () => {
    m.removerCondominio.mockRejectedValue(new Error('Não é possível remover: há 3 usuários e 1 agendamento vinculados.'));
    await abrir();
    await fireEvent.click(screen.getByRole('button', { name: 'Remover Torre 10' }));
    await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remover' }));

    expect(await screen.findByText(/há 3 usuários e 1 agendamento vinculados/)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Confirmar remoção' })).toBeInTheDocument();
  });

  it('cancelar não remove', async () => {
    await abrir();
    await fireEvent.click(screen.getByRole('button', { name: 'Remover Torre 10' }));
    await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(m.removerCondominio).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
