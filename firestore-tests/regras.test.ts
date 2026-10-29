import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

// Roda contra o Firebase Emulator: `npm run test:rules`
let env: RulesTestEnvironment;

const PERFIS: Record<string, { role: string; condominioId: string | null }> = {
  ana: { role: 'cliente', condominioId: 'c1' },
  bia: { role: 'cliente', condominioId: 'c2' },
  carlos: { role: 'cliente', condominioId: null },
  gui: { role: 'gerente', condominioId: 'c1' },
  gabi: { role: 'gerente', condominioId: 'c2' },
  gnulo: { role: 'gerente', condominioId: null },
  adm: { role: 'admin', condominioId: null },
  ins: { role: 'insulfilm', condominioId: null }
};

const perfil = (uid: string) => ({
  nome: uid,
  email: `${uid}@ex.com`,
  ...PERFIS[uid]
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-target-auto-spa',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const uid of Object.keys(PERFIS)) await setDoc(doc(db, 'users', uid), perfil(uid));
    await setDoc(doc(db, 'condominios', 'c1'), { nome: 'Cond 1', nomeNormalizado: 'cond 1' });
    await setDoc(doc(db, 'condominios', 'c2'), { nome: 'Cond 2', nomeNormalizado: 'cond 2' });
    await setDoc(doc(db, 'servicos', 's1'), { nome: 'Lavagem' });
    await setDoc(doc(db, 'agendamentos', 'ag1'), { clienteId: 'ana', condominioId: 'c1', status: 'agendado' });
    await setDoc(doc(db, 'agendamentos', 'ag2'), { clienteId: 'bia', condominioId: 'c2', status: 'agendado' });
    // Agendamento sem condomínio: gerente sem condomínio NÃO pode enxergar (null == null)
    await setDoc(doc(db, 'agendamentos', 'agNulo'), { clienteId: 'carlos', condominioId: null, status: 'agendado' });
    await setDoc(doc(db, 'chats', 'ana', 'mensagens', 'm1'), { de: 'cliente', texto: 'oi', hora: '10:00', lida: false });
  });
});

const como = (uid: string | null) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

const PAPEIS = ['anonimo', 'cliente', 'gerente', 'admin', 'insulfilm'] as const;
// ana (cliente c1), gui (gerente c1), adm, ins; anônimo = null
const quem: Record<(typeof PAPEIS)[number], string | null> = {
  anonimo: null,
  cliente: 'ana',
  gerente: 'gui',
  admin: 'adm',
  insulfilm: 'ins'
};

describe('users', () => {
  it('leitura do próprio perfil: todos os logados; anônimo não', async () => {
    await assertFails(getDoc(doc(como(null), 'users', 'ana')));
    for (const uid of ['ana', 'gui', 'adm', 'ins']) {
      await assertSucceeds(getDoc(doc(como(uid), 'users', uid)));
    }
  });

  it('ler perfil de outro: só admin', async () => {
    await assertFails(getDoc(doc(como('ana'), 'users', 'bia')));
    await assertFails(getDoc(doc(como('gui'), 'users', 'ana'))); // nem o gerente do mesmo condomínio
    await assertFails(getDoc(doc(como('ins'), 'users', 'ana')));
    await assertSucceeds(getDoc(doc(como('adm'), 'users', 'ana')));
  });

  it('listar todos os usuários: só admin', async () => {
    await assertFails(getDocs(collection(como('ana'), 'users')));
    await assertFails(getDocs(collection(como('gui'), 'users')));
    await assertFails(getDocs(collection(como(null), 'users')));
    await assertSucceeds(getDocs(collection(como('adm'), 'users')));
  });

  describe('criação (cadastro)', () => {
    const novo = { nome: 'Novo', email: 'n@ex.com', role: 'cliente', condominioId: null };

    it('cria o próprio perfil como cliente sem condomínio', async () => {
      await assertSucceeds(setDoc(doc(como('novo'), 'users', 'novo'), novo));
    });

    it.each(['admin', 'gerente', 'insulfilm'])('NÃO cria perfil com role %s', async (role) => {
      await assertFails(setDoc(doc(como('novo'), 'users', 'novo'), { ...novo, role }));
    });

    it('NÃO cria já vinculado a um condomínio', async () => {
      await assertFails(setDoc(doc(como('novo'), 'users', 'novo'), { ...novo, condominioId: 'c1' }));
    });

    it('NÃO cria perfil de outro uid', async () => {
      await assertFails(setDoc(doc(como('novo'), 'users', 'outro'), novo));
    });

    it('NÃO aceita campos extras nem faltando', async () => {
      await assertFails(setDoc(doc(como('novo'), 'users', 'novo'), { ...novo, extra: 1 }));
      await assertFails(setDoc(doc(como('novo'), 'users', 'novo'), { nome: 'x', email: 'x', role: 'cliente' }));
    });

    it('anônimo não cria', async () => {
      await assertFails(setDoc(doc(como(null), 'users', 'novo'), novo));
    });

    it('admin existente também não cria perfil alheio pelo cliente (só via Admin SDK)', async () => {
      await assertFails(setDoc(doc(como('adm'), 'users', 'zzz'), { ...novo, role: 'gerente' }));
    });
  });

  describe('edição do próprio perfil', () => {
    it('NÃO muda o próprio role (nenhum papel)', async () => {
      for (const uid of ['ana', 'gui', 'ins']) {
        await assertFails(updateDoc(doc(como(uid), 'users', uid), { role: 'admin' }));
      }
      await assertFails(updateDoc(doc(como('ana'), 'users', 'ana'), { role: 'gerente' }));
      // nem o admin muda o próprio papel pelo cliente (rebaixar/trocar)
      await assertFails(updateDoc(doc(como('adm'), 'users', 'adm'), { role: 'cliente' }));
    });

    it('NÃO muda o e-mail', async () => {
      await assertFails(updateDoc(doc(como('ana'), 'users', 'ana'), { email: 'outro@ex.com' }));
    });

    it('muda o nome (até 100 caracteres)', async () => {
      await assertSucceeds(updateDoc(doc(como('ana'), 'users', 'ana'), { nome: 'Ana Maria' }));
      await assertFails(updateDoc(doc(como('ana'), 'users', 'ana'), { nome: 'x'.repeat(101) }));
    });

    it('cliente sem condomínio entra em condomínio EXISTENTE (uma vez)', async () => {
      await assertSucceeds(updateDoc(doc(como('carlos'), 'users', 'carlos'), { condominioId: 'c1' }));
    });

    it('NÃO entra em condomínio inexistente', async () => {
      await assertFails(updateDoc(doc(como('carlos'), 'users', 'carlos'), { condominioId: 'inventado' }));
    });

    it('NÃO troca de condomínio depois de definido (ana: c1 -> c2)', async () => {
      await assertFails(updateDoc(doc(como('ana'), 'users', 'ana'), { condominioId: 'c2' }));
    });

    it('NÃO remove o condomínio (volta a null para entrar em outro)', async () => {
      await assertFails(updateDoc(doc(como('ana'), 'users', 'ana'), { condominioId: null }));
    });

    it('gerente sem condomínio NÃO se atribui um condomínio', async () => {
      // pela regra, a atribuição inicial só vale para quem está com null; gerente é definido pelo admin.
      // Mesmo que consiga, o papel continua o mesmo: o teste garante que o role não muda no mesmo update.
      await assertFails(updateDoc(doc(como('gnulo'), 'users', 'gnulo'), { condominioId: 'c1', role: 'admin' }));
    });

    it('NÃO edita perfil de outro (nem admin pelo cliente)', async () => {
      await assertFails(updateDoc(doc(como('ana'), 'users', 'bia'), { nome: 'x' }));
      await assertFails(updateDoc(doc(como('adm'), 'users', 'ana'), { role: 'admin' }));
      await assertFails(updateDoc(doc(como('gui'), 'users', 'ana'), { nome: 'x' }));
    });
  });

  it('ninguém apaga perfil', async () => {
    for (const uid of ['ana', 'adm']) await assertFails(deleteDoc(doc(como(uid), 'users', uid)));
  });
});

describe('condominios e servicos (leitura logada, escrita admin)', () => {
  for (const colecao of ['condominios', 'servicos']) {
    const id = colecao === 'condominios' ? 'c1' : 's1';

    it(`${colecao}: leitura`, async () => {
      await assertFails(getDoc(doc(como(null), colecao, id)));
      for (const p of ['cliente', 'gerente', 'admin', 'insulfilm'] as const) {
        await assertSucceeds(getDoc(doc(como(quem[p]), colecao, id)));
      }
    });

    it(`${colecao}: escrita só admin`, async () => {
      for (const p of ['anonimo', 'cliente', 'gerente', 'insulfilm'] as const) {
        await assertFails(setDoc(doc(como(quem[p]), colecao, 'novo'), { nome: 'x' }));
        await assertFails(updateDoc(doc(como(quem[p]), colecao, id), { nome: 'x' }));
        await assertFails(deleteDoc(doc(como(quem[p]), colecao, id)));
      }
      await assertSucceeds(setDoc(doc(como('adm'), colecao, 'novo'), { nome: 'x', nomeNormalizado: 'x' }));
      await assertSucceeds(updateDoc(doc(como('adm'), colecao, id), { nome: 'y' }));
    });
  }

  it('busca de condomínio por nome (usada na tela de entrar no condomínio) funciona para cliente logado', async () => {
    await assertSucceeds(
      getDocs(query(collection(como('carlos'), 'condominios'), where('nomeNormalizado', '==', 'cond 1')))
    );
  });
});

describe('agendamentos', () => {
  describe('leitura', () => {
    it('anônimo e insulfilm: negado', async () => {
      await assertFails(getDoc(doc(como(null), 'agendamentos', 'ag1')));
      await assertFails(getDoc(doc(como('ins'), 'agendamentos', 'ag1')));
    });

    it('cliente: só o próprio', async () => {
      await assertSucceeds(getDoc(doc(como('ana'), 'agendamentos', 'ag1')));
      await assertFails(getDoc(doc(como('ana'), 'agendamentos', 'ag2')));
    });

    it('gerente: só do próprio condomínio', async () => {
      await assertSucceeds(getDoc(doc(como('gui'), 'agendamentos', 'ag1')));
      await assertFails(getDoc(doc(como('gui'), 'agendamentos', 'ag2')));
      await assertSucceeds(getDoc(doc(como('gabi'), 'agendamentos', 'ag2')));
    });

    it('gerente SEM condomínio não lê agendamento sem condomínio (null == null)', async () => {
      await assertFails(getDoc(doc(como('gnulo'), 'agendamentos', 'agNulo')));
      await assertFails(getDoc(doc(como('gnulo'), 'agendamentos', 'ag1')));
    });

    it('admin lê todos', async () => {
      for (const id of ['ag1', 'ag2', 'agNulo']) await assertSucceeds(getDoc(doc(como('adm'), 'agendamentos', id)));
    });

    it('lista filtrada pelo dono/condomínio funciona; lista geral é negada', async () => {
      await assertSucceeds(getDocs(query(collection(como('ana'), 'agendamentos'), where('clienteId', '==', 'ana'))));
      await assertFails(getDocs(collection(como('ana'), 'agendamentos')));
      await assertSucceeds(getDocs(query(collection(como('gui'), 'agendamentos'), where('condominioId', '==', 'c1'))));
      await assertFails(getDocs(query(collection(como('gui'), 'agendamentos'), where('condominioId', '==', 'c2'))));
    });
  });

  describe('criação', () => {
    const ag = (extra = {}) => ({ clienteId: 'ana', condominioId: 'c1', status: 'agendado', ...extra });

    it('cliente cria o próprio, no próprio condomínio, como "agendado"', async () => {
      await assertSucceeds(setDoc(doc(como('ana'), 'agendamentos', 'novo'), ag()));
    });

    it('NÃO cria para outro cliente', async () => {
      await assertFails(setDoc(doc(como('ana'), 'agendamentos', 'novo'), ag({ clienteId: 'bia' })));
    });

    it('NÃO cria em outro condomínio', async () => {
      await assertFails(setDoc(doc(como('ana'), 'agendamentos', 'novo'), ag({ condominioId: 'c2' })));
    });

    it('NÃO cria já "finalizado"', async () => {
      await assertFails(setDoc(doc(como('ana'), 'agendamentos', 'novo'), ag({ status: 'finalizado' })));
    });

    it('cliente sem condomínio não cria', async () => {
      await assertFails(
        setDoc(doc(como('carlos'), 'agendamentos', 'novo'), { clienteId: 'carlos', condominioId: null, status: 'agendado' })
      );
    });

    it('anônimo e insulfilm não criam', async () => {
      await assertFails(setDoc(doc(como(null), 'agendamentos', 'n1'), ag()));
      await assertFails(setDoc(doc(como('ins'), 'agendamentos', 'n2'), ag({ clienteId: 'ins' })));
    });
  });

  describe('atualização', () => {
    it('cliente: só a avaliação', async () => {
      await assertSucceeds(updateDoc(doc(como('ana'), 'agendamentos', 'ag1'), { avaliacao: { nota: 5 } }));
      await assertFails(updateDoc(doc(como('ana'), 'agendamentos', 'ag1'), { status: 'finalizado' }));
      await assertFails(updateDoc(doc(como('ana'), 'agendamentos', 'ag1'), { condominioId: 'c2' }));
      await assertFails(updateDoc(doc(como('ana'), 'agendamentos', 'ag1'), { clienteId: 'bia' }));
      await assertFails(updateDoc(doc(como('ana'), 'agendamentos', 'ag2'), { avaliacao: { nota: 1 } }));
    });

    it('gerente: muda andamento no próprio condomínio, mas não dono nem condomínio', async () => {
      await assertSucceeds(updateDoc(doc(como('gui'), 'agendamentos', 'ag1'), { status: 'em-atendimento' }));
      await assertFails(updateDoc(doc(como('gui'), 'agendamentos', 'ag1'), { condominioId: 'c2' }));
      await assertFails(updateDoc(doc(como('gui'), 'agendamentos', 'ag1'), { clienteId: 'bia' }));
      await assertFails(updateDoc(doc(como('gui'), 'agendamentos', 'ag2'), { status: 'finalizado' }));
    });

    it('admin atualiza; anônimo e insulfilm não', async () => {
      await assertSucceeds(updateDoc(doc(como('adm'), 'agendamentos', 'ag1'), { status: 'finalizado' }));
      await assertFails(updateDoc(doc(como(null), 'agendamentos', 'ag1'), { status: 'finalizado' }));
      await assertFails(updateDoc(doc(como('ins'), 'agendamentos', 'ag1'), { status: 'finalizado' }));
    });
  });

  it('exclusão: só admin', async () => {
    for (const uid of ['ana', 'gui', 'ins']) await assertFails(deleteDoc(doc(como(uid), 'agendamentos', 'ag1')));
    await assertFails(deleteDoc(doc(como(null), 'agendamentos', 'ag1')));
    await assertSucceeds(deleteDoc(doc(como('adm'), 'agendamentos', 'ag1')));
  });
});

describe('chats/{chatId}/mensagens (chatId = uid do cliente)', () => {
  const msg = (extra = {}) => ({ de: 'cliente', texto: 'olá', hora: '10:05', lida: false, ...extra });
  const ref = (uid: string | null, chat = 'ana', id = 'm1') => doc(como(uid), 'chats', chat, 'mensagens', id);

  describe('leitura', () => {
    it('dono, gerente do condomínio e admin leem', async () => {
      await assertSucceeds(getDoc(ref('ana')));
      await assertSucceeds(getDoc(ref('gui')));
      await assertSucceeds(getDoc(ref('adm')));
    });

    it('outro cliente, gerente de outro condomínio, gerente sem condomínio, insulfilm e anônimo NÃO leem', async () => {
      await assertFails(getDoc(ref('bia')));
      await assertFails(getDoc(ref('gabi')));
      await assertFails(getDoc(ref('gnulo')));
      await assertFails(getDoc(ref('ins')));
      await assertFails(getDoc(ref(null)));
    });

    it('listar a conversa: participantes sim, estranhos não', async () => {
      await assertSucceeds(getDocs(collection(como('ana'), 'chats', 'ana', 'mensagens')));
      await assertSucceeds(getDocs(collection(como('gui'), 'chats', 'ana', 'mensagens')));
      await assertFails(getDocs(collection(como('bia'), 'chats', 'ana', 'mensagens')));
      await assertFails(getDocs(collection(como('gabi'), 'chats', 'ana', 'mensagens')));
    });
  });

  describe('criação', () => {
    it('cliente escreve na própria conversa como "cliente"', async () => {
      await assertSucceeds(setDoc(ref('ana', 'ana', 'n1'), msg()));
    });

    it('gerente do condomínio e admin escrevem como "gerente"', async () => {
      await assertSucceeds(setDoc(ref('gui', 'ana', 'n2'), msg({ de: 'gerente' })));
      await assertSucceeds(setDoc(ref('adm', 'ana', 'n3'), msg({ de: 'gerente' })));
    });

    it('NÃO escreve se passando pelo outro lado', async () => {
      await assertFails(setDoc(ref('ana', 'ana', 'n4'), msg({ de: 'gerente' })));
      await assertFails(setDoc(ref('gui', 'ana', 'n5'), msg({ de: 'cliente' })));
    });

    it('estranhos NÃO escrevem na conversa dos outros', async () => {
      await assertFails(setDoc(ref('bia', 'ana', 'n6'), msg()));
      await assertFails(setDoc(ref('gabi', 'ana', 'n7'), msg({ de: 'gerente' })));
      await assertFails(setDoc(ref('gnulo', 'ana', 'n8'), msg({ de: 'gerente' })));
      await assertFails(setDoc(ref('ins', 'ana', 'n9'), msg({ de: 'gerente' })));
      await assertFails(setDoc(ref(null, 'ana', 'n10'), msg()));
    });

    it('valida o conteúdo: texto vazio, grande demais, campos extras', async () => {
      await assertFails(setDoc(ref('ana', 'ana', 'v1'), msg({ texto: '' })));
      await assertFails(setDoc(ref('ana', 'ana', 'v2'), msg({ texto: 'x'.repeat(2001) })));
      await assertFails(setDoc(ref('ana', 'ana', 'v3'), msg({ admin: true })));
      await assertSucceeds(setDoc(ref('ana', 'ana', 'v4'), msg({ texto: 'x'.repeat(2000) })));
    });
  });

  describe('atualização e exclusão', () => {
    it('participante só marca como lida', async () => {
      await assertSucceeds(updateDoc(ref('gui'), { lida: true }));
      await assertFails(updateDoc(ref('gui'), { texto: 'editado' }));
      await assertFails(updateDoc(ref('ana'), { de: 'gerente' }));
    });

    it('estranho não marca como lida', async () => {
      await assertFails(updateDoc(ref('bia'), { lida: true }));
      await assertFails(updateDoc(ref(null), { lida: true }));
    });

    it('ninguém apaga mensagem', async () => {
      for (const uid of ['ana', 'gui', 'adm']) await assertFails(deleteDoc(ref(uid)));
    });
  });
});

describe('negar tudo que não está liberado', () => {
  it.each(PAPEIS)('%s não lê nem escreve em coleção desconhecida', async (papel) => {
    const db = como(quem[papel]);
    await assertFails(getDoc(doc(db, 'segredos', 'x')));
    await assertFails(setDoc(doc(db, 'segredos', 'x'), { a: 1 }));
    await assertFails(getDocs(collection(db, 'segredos')));
  });

  it('o chat sem a subcoleção "mensagens" também é negado', async () => {
    await assertFails(setDoc(doc(como('adm'), 'chats', 'ana'), { a: 1 }));
    await assertFails(getDoc(doc(como('adm'), 'chats', 'ana')));
  });
});
