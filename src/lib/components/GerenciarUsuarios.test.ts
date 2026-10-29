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
    { id: 'i1', data: { nome: 'Ivo', email: 'ivo@ex.com', role: 'insulfilm', condominioId: null } }
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
  it('botão só para cliente e gerente (não para admin nem insulfilm)', async () => {
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
