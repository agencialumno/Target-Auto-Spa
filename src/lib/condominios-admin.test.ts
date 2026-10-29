import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firestore falso em memória: documentos por "colecao/id"
const m = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn()
}));

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => {
  const colecao = (nome: string) => ({ tipo: 'colecao', nome });
  return {
    collection: (_db: unknown, nome: string) => colecao(nome),
    doc: (_db: unknown, c: string, id: string) => ({ tipo: 'doc', caminho: `${c}/${id}` }),
    query: (col: { nome: string }, ...filtros: unknown[]) => ({ ...col, filtros }),
    where: (campo: string, _op: string, valor: unknown) => ({ campo, valor }),
    getDocs: async (col: { nome: string }) => ({
      docs: [...m.docs.entries()]
        .filter(([k]) => k.startsWith(col.nome + '/'))
        .map(([k, v]) => ({ id: k.split('/')[1], data: () => v }))
    }),
    getDoc: async (ref: { caminho: string }) => ({ exists: () => m.docs.has(ref.caminho) }),
    getCountFromServer: async (q: { nome: string; filtros: { campo: string; valor: unknown }[] }) => {
      const n = [...m.docs.entries()].filter(
        ([k, v]) =>
          k.startsWith(q.nome + '/') && q.filtros.every((f) => (v as Record<string, unknown>)[f.campo] === f.valor)
      ).length;
      return { data: () => ({ count: n }) };
    },
    setDoc: m.setDoc,
    updateDoc: m.updateDoc,
    deleteDoc: m.deleteDoc
  };
});

import { criarCondominio, listarCondominios, removerCondominio, renomearCondominio } from './condominios-admin';

beforeEach(() => {
  vi.clearAllMocks();
  m.docs.clear();
  m.docs.set('condominios/torre-10', { nome: 'Torre 10', nomeNormalizado: 'torre 10' });
  m.docs.set('condominios/vazio', { nome: 'Sem Ninguém', nomeNormalizado: 'sem ninguem' });
  m.docs.set('users/c1', { nome: 'Ana', role: 'cliente', condominioId: 'torre-10' });
  m.docs.set('users/c2', { nome: 'Bia', role: 'cliente', condominioId: 'torre-10' });
  m.docs.set('users/g1', { nome: 'Gui', email: 'g@ex.com', role: 'gerente', condominioId: 'torre-10' });
  m.docs.set('users/adm', { nome: 'Adm', role: 'admin', condominioId: null });
  m.docs.set('agendamentos/a1', { clienteId: 'c1', condominioId: 'torre-10' });
});

describe('listarCondominios', () => {
  it('conta moradores (só clientes), lista gerentes e conta agendamentos por condomínio', async () => {
    const lista = await listarCondominios();
    const torre = lista.find((c) => c.id === 'torre-10')!;
    expect(torre.moradores).toBe(2);
    expect(torre.gerentes).toEqual([{ uid: 'g1', nome: 'Gui' }]);
    expect(torre.agendamentos).toBe(1);

    const vazio = lista.find((c) => c.id === 'vazio')!;
    expect(vazio).toMatchObject({ moradores: 0, gerentes: [], agendamentos: 0 });
  });

  it('ordena por nome', async () => {
    const nomes = (await listarCondominios()).map((c) => c.nome);
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });
});

describe('criarCondominio', () => {
  it('grava nome limpo, nomeNormalizado e id gerado do nome', async () => {
    const id = await criarCondominio('  Residencial   São João ');
    expect(id).toBe('residencial-sao-joao');
    expect(m.setDoc).toHaveBeenCalledWith(
      { tipo: 'doc', caminho: 'condominios/residencial-sao-joao' },
      { nome: 'Residencial São João', nomeNormalizado: 'residencial sao joao' }
    );
  });

  it('o nomeNormalizado gravado é exatamente o que a busca do morador usa', async () => {
    const { normalizarNome } = await import('./condominio');
    await criarCondominio('Residencial São João');
    const gravado = m.setDoc.mock.calls[0]![1].nomeNormalizado;
    expect(gravado).toBe(normalizarNome('residencial SAO joao '));
  });

  it('recusa duplicado pelo nome normalizado (acento, caixa e espaços)', async () => {
    await expect(criarCondominio('TORRE   10')).rejects.toThrow('Já existe um condomínio');
    await expect(criarCondominio('Tôrre 10')).rejects.toThrow('Já existe um condomínio');
    expect(m.setDoc).not.toHaveBeenCalled();
  });

  it('recusa quando o id já existe mesmo com outro nome normalizado', async () => {
    m.docs.set('condominios/a-b', { nome: 'A.B', nomeNormalizado: 'a.b' });
    await expect(criarCondominio('A B')).rejects.toThrow('Já existe um condomínio');
    expect(m.setDoc).not.toHaveBeenCalled();
  });

  it('valida o nome', async () => {
    await expect(criarCondominio('   ')).rejects.toThrow('Informe o nome');
    await expect(criarCondominio('x'.repeat(101))).rejects.toThrow('no máximo 100');
    await expect(criarCondominio('???')).rejects.toThrow('letras ou números');
    expect(m.setDoc).not.toHaveBeenCalled();
  });
});

describe('renomearCondominio', () => {
  it('muda só nome e nomeNormalizado; o id não muda', async () => {
    await renomearCondominio('torre-10', 'Torre Dez');
    expect(m.updateDoc).toHaveBeenCalledWith(
      { tipo: 'doc', caminho: 'condominios/torre-10' },
      { nome: 'Torre Dez', nomeNormalizado: 'torre dez' }
    );
    expect(m.setDoc).not.toHaveBeenCalled();
    expect(m.deleteDoc).not.toHaveBeenCalled();
  });

  it('pode manter o mesmo nome com outra grafia (não conta como duplicado de si mesmo)', async () => {
    await expect(renomearCondominio('torre-10', 'TORRE 10')).resolves.toBeUndefined();
  });

  it('recusa nome de outro condomínio', async () => {
    await expect(renomearCondominio('vazio', 'torre 10')).rejects.toThrow('outro condomínio');
    expect(m.updateDoc).not.toHaveBeenCalled();
  });
});

describe('removerCondominio', () => {
  it('recusa se houver usuários, mostrando quantos', async () => {
    m.docs.delete('agendamentos/a1');
    await expect(removerCondominio('torre-10')).rejects.toThrow('3 usuários vinculados');
    expect(m.deleteDoc).not.toHaveBeenCalled();
  });

  it('recusa se houver agendamentos, mostrando quantos', async () => {
    m.docs.delete('users/c1');
    m.docs.delete('users/c2');
    m.docs.delete('users/g1');
    await expect(removerCondominio('torre-10')).rejects.toThrow('1 agendamento vinculado');
    expect(m.deleteDoc).not.toHaveBeenCalled();
  });

  it('mostra usuários e agendamentos juntos', async () => {
    await expect(removerCondominio('torre-10')).rejects.toThrow('3 usuários e 1 agendamento vinculados');
  });

  it('remove quando está vazio', async () => {
    await removerCondominio('vazio');
    expect(m.deleteDoc).toHaveBeenCalledWith({ tipo: 'doc', caminho: 'condominios/vazio' });
  });
});
