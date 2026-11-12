import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { Timestamp, serverTimestamp, collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

// Roda contra o Firebase Emulator: `npm run test:rules`
let env: RulesTestEnvironment;

const PERFIS: Record<string, { role: string; condominioId: string | null; especialidade?: string }> = {
  ana: { role: 'cliente', condominioId: 'c1' },
  bia: { role: 'cliente', condominioId: 'c2' },
  carlos: { role: 'cliente', condominioId: null },
  gui: { role: 'gerente', condominioId: 'c1' },
  gabi: { role: 'gerente', condominioId: 'c2' },
  fun: { role: 'funcionario', condominioId: null },
  fran: { role: 'funcionario', condominioId: null },
  fins: { role: 'funcionario', condominioId: null, especialidade: 'insulfilm' },
  cap1: { role: 'cliente', condominioId: 'c3' },
  cap2: { role: 'cliente', condominioId: 'c3' },
  cap3: { role: 'cliente', condominioId: 'c3' },
  ana2: { role: 'cliente', condominioId: 'c1' },
  gnulo: { role: 'gerente', condominioId: null },
  adm: { role: 'admin', condominioId: null },
  // Papel legado (removido): contas antigas ainda existentes não podem nada
  ins: { role: 'insulfilm', condominioId: null }
};

const futuro = () => Timestamp.fromDate(new Date(Date.now() + 86400000));

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
    await setDoc(doc(db, 'condominios', 'c3'), { nome: 'Cond 3', nomeNormalizado: 'cond 3', capacidade: 2 });
    await setDoc(doc(db, 'servicos', 's1'), { nome: 'Lavagem', categoria: 'lavagem', precoCentavos: 6500, duracaoMin: 45, ativo: true });
    await setDoc(doc(db, 'servicos', 's2'), { nome: 'Polimento', categoria: 'estetica', precoCentavos: 20000, duracaoMin: 120, ativo: true });
    await setDoc(doc(db, 'servicos', 's3'), { nome: 'Antigo', precoCentavos: 5000, duracaoMin: 30, ativo: false });
    await setDoc(doc(db, 'servicos', 's4'), { nome: 'Insulfilm', categoria: 'insulfilm', precoCentavos: 35000, duracaoMin: 90, ativo: true });
    await setDoc(doc(db, 'servicos', 's5'), { nome: 'Insulfilm Premium', categoria: 'insulfilm', precoCentavos: 68000, duracaoMin: 120, ativo: true });
    const base = {
      clienteNome: 'x',
      externo: false,
      itens: [{ servicoId: 's1', nome: 'Lavagem', precoCentavos: 6500 }],
      total: 6500,
      data: '2030-01-01',
      hora: '08:00',
      inicio: Timestamp.fromDate(new Date('2030-01-01T12:00:00Z')),
      veiculo: { modelo: 'Gol', placa: 'ABC1D23' },
      checklist: { fotos: {} },
      avaliacao: null,
      funcionarioId: null,
      funcionarioNome: null
    };
    await setDoc(doc(db, 'agendamentos', 'ag1'), { ...base, clienteId: 'ana', condominioId: 'c1', status: 'agendado', vagaId: 'c1_2030-01-01_08:00_1' });
    await setDoc(doc(db, 'ocupacao', 'c1_2030-01-01_08:00_1'), { condominioId: 'c1', data: '2030-01-01', hora: '08:00', externo: false, agendamentoId: 'ag1' });
    await setDoc(doc(db, 'ocupacao', 'ext_2030-01-01_10:00_1'), { condominioId: 'c2', data: '2030-01-01', hora: '10:00', externo: true, agendamentoId: 'agExt' });
    await setDoc(doc(db, 'agendamentos', 'agExt'), { ...base, clienteId: 'bia', condominioId: 'c2', status: 'agendado', externo: true, hora: '10:00', vagaId: 'ext_2030-01-01_10:00_1', itens: [{ servicoId: 's4', nome: 'Insulfilm', precoCentavos: 35000 }], total: 35000, funcionarioId: 'fins', funcionarioNome: 'fins' });
    await setDoc(doc(db, 'agendamentos', 'ag2'), { ...base, clienteId: 'bia', condominioId: 'c2', status: 'agendado' });
    // Agendamento sem condomínio: gerente sem condomínio NÃO pode enxergar (null == null)
    await setDoc(doc(db, 'agendamentos', 'agNulo'), { ...base, clienteId: 'carlos', condominioId: null, status: 'agendado' });
    await setDoc(doc(db, 'agendamentos', 'agAtrib'), { ...base, clienteId: 'ana', condominioId: 'c1', status: 'agendado', funcionarioId: 'fun', funcionarioNome: 'fun' });
    await setDoc(doc(db, 'agendamentos', 'agEmAnd'), { ...base, clienteId: 'ana', condominioId: 'c1', status: 'em_andamento', funcionarioId: 'fun', funcionarioNome: 'fun' });
    await setDoc(doc(db, 'agendamentos', 'agFim'), { ...base, clienteId: 'ana', condominioId: 'c1', status: 'finalizado', funcionarioId: 'fun', funcionarioNome: 'fun' });
    await setDoc(doc(db, 'agendamentos', 'agAval'), { ...base, clienteId: 'ana', condominioId: 'c1', status: 'finalizado', avaliacao: { nota: 4, comentario: '', em: Timestamp.now() } });
    await setDoc(doc(db, 'agendamentos', 'agOutro'), { ...base, clienteId: 'bia', condominioId: 'c2', status: 'finalizado' });
    await setDoc(doc(db, 'chats', 'ana'), { clienteId: 'ana', clienteNome: 'Ana', condominioId: 'c1', naoLidasGerente: 0, naoLidasCliente: 0 });
    await setDoc(doc(db, 'chats', 'ana', 'mensagens', 'm1'), { de: 'cliente', texto: 'oi', hora: '10:00', lida: false, criadoEm: Timestamp.now() });
  });
});

const como = (uid: string | null) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

const PAPEIS = ['anonimo', 'cliente', 'gerente', 'funcionario', 'admin', 'insulfilm'] as const;
// ana (cliente c1), gui (gerente c1), adm, ins; anônimo = null
const quem: Record<(typeof PAPEIS)[number], string | null> = {
  anonimo: null,
  cliente: 'ana',
  gerente: 'gui',
  funcionario: 'fun',
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

  it('gerente lista só funcionários (para atribuir atendimentos); não lê clientes nem admins', async () => {
    await assertSucceeds(getDocs(query(collection(como('gui'), 'users'), where('role', '==', 'funcionario'))));
    await assertSucceeds(getDoc(doc(como('gui'), 'users', 'fun')));
    await assertFails(getDocs(collection(como('gui'), 'users')));
    await assertFails(getDocs(query(collection(como('gui'), 'users'), where('role', '==', 'cliente'))));
    await assertFails(getDoc(doc(como('gui'), 'users', 'adm')));
    await assertFails(getDocs(query(collection(como('ana'), 'users'), where('role', '==', 'funcionario'))));
    await assertFails(getDocs(query(collection(como('fun'), 'users'), where('role', '==', 'funcionario'))));
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

    it.each(['admin', 'gerente', 'funcionario', 'insulfilm'])('NÃO cria perfil com role %s', async (role) => {
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
      for (const p of ['cliente', 'gerente', 'funcionario', 'admin', 'insulfilm'] as const) {
        await assertSucceeds(getDoc(doc(como(quem[p]), colecao, id)));
      }
    });

    it(`${colecao}: escrita só admin`, async () => {
      for (const p of ['anonimo', 'cliente', 'gerente', 'funcionario', 'insulfilm'] as const) {
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

const idVaga = (d: any, n = 1) => (d.externo ? `ext_${d.data}_${d.hora}_${n}` : `${d.condominioId}_${d.data}_${d.hora}_${n}`);
const comVaga = (d: any) => ({ vagaId: idVaga(d), ...d });

describe('agendamentos', () => {
  const ag = (extra: Record<string, unknown> = {}) => comVaga({
    clienteId: 'ana',
    clienteNome: 'Ana',
    condominioId: 'c1',
    itens: [{ servicoId: 's1', nome: 'Lavagem', precoCentavos: 6500 }],
    total: 6500,
    data: '2030-01-01',
    hora: '09:00',
    inicio: futuro(),
    status: 'agendado',
    funcionarioId: null,
    funcionarioNome: null,
    veiculo: { modelo: 'Gol', placa: 'ABC1D23' },
    observacoes: '',
    checklist: { fotos: {} },
    avaliacao: null,
    externo: false,
    criadoEm: serverTimestamp(),
    ...extra
  });
  const ref = (uid: string | null, id: string) => doc(como(uid), 'agendamentos', id);
  const atualiza = (uid: string | null, id: string, dados: Record<string, unknown>) =>
    updateDoc(ref(uid, id), { atualizadoEm: serverTimestamp(), ...dados });
  const nota = (extra: Record<string, unknown> = {}) => ({
    avaliacao: { nota: 5, nps: 10, comentario: 'Ótimo', em: serverTimestamp(), ...extra }
  });

  describe('leitura', () => {
    it('anônimo e insulfilm: negado', async () => {
      await assertFails(getDoc(ref(null, 'ag1')));
      await assertFails(getDoc(ref('ins', 'ag1')));
    });

    it('cliente: só o próprio', async () => {
      await assertSucceeds(getDoc(ref('ana', 'ag1')));
      await assertFails(getDoc(ref('ana', 'ag2')));
    });

    it('gerente: só do próprio condomínio', async () => {
      await assertSucceeds(getDoc(ref('gui', 'ag1')));
      await assertFails(getDoc(ref('gui', 'ag2')));
      await assertSucceeds(getDoc(ref('gabi', 'ag2')));
    });

    it('gerente SEM condomínio não lê agendamento sem condomínio (null == null)', async () => {
      await assertFails(getDoc(ref('gnulo', 'agNulo')));
      await assertFails(getDoc(ref('gnulo', 'ag1')));
    });

    it('funcionário: só os atribuídos a ele', async () => {
      await assertSucceeds(getDoc(ref('fun', 'agAtrib')));
      await assertFails(getDoc(ref('fun', 'ag1')));
      await assertFails(getDoc(ref('fran', 'agAtrib')));
    });

    it('admin lê todos', async () => {
      for (const id of ['ag1', 'ag2', 'agNulo']) await assertSucceeds(getDoc(ref('adm', id)));
    });

    it('listas filtradas funcionam; lista geral é negada', async () => {
      await assertSucceeds(getDocs(query(collection(como('ana'), 'agendamentos'), where('clienteId', '==', 'ana'))));
      await assertFails(getDocs(collection(como('ana'), 'agendamentos')));
      await assertSucceeds(getDocs(query(collection(como('gui'), 'agendamentos'), where('condominioId', '==', 'c1'))));
      await assertFails(getDocs(query(collection(como('gui'), 'agendamentos'), where('condominioId', '==', 'c2'))));
      await assertSucceeds(getDocs(query(collection(como('fun'), 'agendamentos'), where('funcionarioId', '==', 'fun'))));
      await assertFails(getDocs(query(collection(como('fun'), 'agendamentos'), where('funcionarioId', '==', 'fran'))));
      await assertSucceeds(getDocs(collection(como('adm'), 'agendamentos')));
    });
  });

  describe('criação', () => {
    // Agendamento + vaga no mesmo batch (vaga === null: só o agendamento, sem vaga)
    const criar = (uid: string | null, dados: Record<string, unknown>, vaga: Record<string, unknown> | null = {}) => {
      const db = como(uid);
      const b = writeBatch(db);
      b.set(doc(db, 'agendamentos', 'novo'), dados);
      if (vaga !== null) {
        const d = dados as any;
        b.set(doc(db, 'ocupacao', String(d.vagaId)), { condominioId: d.condominioId, data: d.data, hora: d.hora, externo: d.externo, agendamentoId: 'novo', ...vaga });
      }
      return b.commit();
    };

    it('cliente cria o próprio, no próprio condomínio, "agendado", preço do catálogo', async () => {
      await assertSucceeds(criar('ana', ag()));
    });

    it('2 serviços: total é a soma exata', async () => {
      const itens = [
        { servicoId: 's1', nome: 'Lavagem', precoCentavos: 6500 },
        { servicoId: 's2', nome: 'Polimento', precoCentavos: 20000 }
      ];
      await assertSucceeds(criar('ana', ag({ itens, total: 26500 })));
      await assertFails(criar('ana', ag({ itens, total: 26499 })));
      await assertFails(criar('ana', ag({ itens, total: 6500 })));
    });

    it('5 itens passam (dentro do limite de leituras); 6 e 0 itens não', async () => {
      const item = { servicoId: 's1', nome: 'Lavagem', precoCentavos: 6500 };
      const outros = [
        item,
        { servicoId: 's2', nome: 'Polimento', precoCentavos: 20000 },
        item,
        item,
        item
      ];
      await assertSucceeds(criar('ana', ag({ itens: outros, total: 6500 * 4 + 20000 })));
      await assertFails(criar('ana', ag({ itens: [...outros, item], total: 6500 * 5 + 20000 })));
      await assertFails(criar('ana', ag({ itens: [], total: 0 })));
    });

    it('NEGA alterar o preço de um item (cliente pagando menos)', async () => {
      await assertFails(
        criar('ana', ag({ itens: [{ servicoId: 's1', nome: 'Lavagem', precoCentavos: 100 }], total: 100 }))
      );
    });

    it('NEGA total diferente da soma', async () => {
      await assertFails(criar('ana', ag({ total: 100 })));
      await assertFails(criar('ana', ag({ total: 999999 })));
      await assertFails(criar('ana', ag({ total: 65.0 + 0.5 })));
    });

    it('NEGA serviço inexistente, inativo ou com nome diferente do catálogo', async () => {
      await assertFails(
        criar('ana', ag({ itens: [{ servicoId: 'fantasma', nome: 'X', precoCentavos: 1 }], total: 1 }))
      );
      await assertFails(
        criar('ana', ag({ itens: [{ servicoId: 's3', nome: 'Antigo', precoCentavos: 5000 }], total: 5000 }))
      );
      await assertFails(
        criar('ana', ag({ itens: [{ servicoId: 's1', nome: 'Outro nome', precoCentavos: 6500 }] }))
      );
    });

    it('NEGA item com campo extra', async () => {
      await assertFails(
        criar('ana', ag({ itens: [{ servicoId: 's1', nome: 'Lavagem', precoCentavos: 6500, desconto: 50 }] }))
      );
    });

    it('NEGA para outro cliente, outro condomínio e status que não seja "agendado"', async () => {
      await assertFails(criar('ana', ag({ clienteId: 'bia' })));
      await assertFails(criar('ana', ag({ condominioId: 'c2' })));
      for (const status of ['em_andamento', 'finalizado', 'cancelado']) {
        await assertFails(criar('ana', ag({ status })));
      }
    });

    it('NEGA já criar com funcionário, avaliação, fotos ou campo extra', async () => {
      await assertFails(criar('ana', ag({ funcionarioId: 'fun', funcionarioNome: 'fun' })));
      await assertFails(criar('ana', ag({ avaliacao: { nota: 5, comentario: '', em: serverTimestamp() } })));
      await assertFails(criar('ana', ag({ checklist: { fotos: { antes_frente: { path: 'x' } } } })));
      await assertFails(criar('ana', ag({ pago: true })));
    });

    it('NEGA horário no passado e carimbo de criação falso', async () => {
      await assertFails(criar('ana', ag({ inicio: Timestamp.fromDate(new Date(Date.now() - 86400000)) })));
      await assertFails(criar('ana', ag({ criadoEm: Timestamp.fromDate(new Date(2020, 1, 1)) })));
    });

    it('cliente sem condomínio, e quem não é cliente, não criam', async () => {
      await assertFails(criar('carlos', ag({ clienteId: 'carlos', condominioId: null })));
      await assertFails(criar('gui', ag({ clienteId: 'gui' })));
      await assertFails(criar('adm', ag({ clienteId: 'adm' })));
      await assertFails(criar('fun', ag({ clienteId: 'fun' })));
      await assertFails(criar('ins', ag({ clienteId: 'ins' })));
      await assertFails(criar(null, ag()));
    });
  });

  describe('atualização pelo cliente', () => {
    it('cancela o próprio enquanto "agendado"', async () => {
      await assertSucceeds(atualiza('ana', 'ag1', { status: 'cancelado' }));
    });

    it('NEGA cancelar depois que começou ou terminou, ou o de outra pessoa', async () => {
      await assertFails(atualiza('ana', 'agEmAnd', { status: 'cancelado' }));
      await assertFails(atualiza('ana', 'agFim', { status: 'cancelado' }));
      await assertFails(atualiza('ana', 'ag2', { status: 'cancelado' }));
    });

    it('NEGA se autodeclarar em andamento ou finalizado', async () => {
      await assertFails(atualiza('ana', 'ag1', { status: 'em_andamento' }));
      await assertFails(atualiza('ana', 'ag1', { status: 'finalizado' }));
    });

    it('avalia UMA vez, com nota inteira de 1 a 5, quando finalizado', async () => {
      await assertSucceeds(atualiza('ana', 'agFim', nota()));
    });

    it.each([0, 6, -1, 4.5, '5'])('NEGA nota inválida (%s)', async (n) => {
      await assertFails(atualiza('ana', 'agFim', nota({ nota: n })));
    });

    it('NEGA avaliar de novo, antes de finalizar, o de outra pessoa ou com campo extra', async () => {
      await assertFails(atualiza('ana', 'agAval', nota()));
      await assertFails(atualiza('ana', 'ag1', nota()));
      await assertFails(atualiza('ana', 'agEmAnd', nota()));
      await assertFails(atualiza('ana', 'agOutro', nota()));
      await assertFails(atualiza('ana', 'agFim', nota({ verificado: true })));
      await assertFails(atualiza('ana', 'agFim', nota({ comentario: 'x'.repeat(501) })));
    });

    it('NEGA cancelar e avaliar na mesma escrita, ou usar carimbo falso', async () => {
      await assertFails(atualiza('ana', 'agFim', { ...nota(), status: 'cancelado' }));
      await assertFails(updateDoc(ref('ana', 'ag1'), { status: 'cancelado', atualizadoEm: Timestamp.fromDate(new Date(2020, 1, 1)) }));
    });

    it.each([
      ['total', { total: 1 }],
      ['itens', { itens: [{ servicoId: 's1', nome: 'Lavagem', precoCentavos: 1 }] }],
      ['preço de item', { 'itens.0.precoCentavos': 1 }],
      ['clienteId', { clienteId: 'bia' }],
      ['condominioId', { condominioId: 'c2' }],
      ['funcionarioId', { funcionarioId: 'fun' }],
      ['checklist', { checklist: { fotos: {} } }],
      ['data', { data: '2031-01-01' }]
    ])('NEGA alterar %s', async (_nome, dados) => {
      await assertFails(atualiza('ana', 'ag1', dados as Record<string, unknown>));
    });
  });

  describe('atualização pelo funcionário', () => {
    const foto = { 'checklist.fotos.antes_frente': { path: 'agendamentos/agAtrib/checklist/antes_frente.jpg', em: Timestamp.now() } };

    it('avança o atendimento atribuído, uma etapa por vez', async () => {
      await assertSucceeds(atualiza('fun', 'agAtrib', { status: 'em_andamento' }));
      await assertSucceeds(atualiza('fun', 'agEmAnd', { status: 'finalizado' }));
    });

    it('grava fotos no checklist do atribuído', async () => {
      await assertSucceeds(atualiza('fun', 'agAtrib', foto));
      await assertSucceeds(atualiza('fun', 'agEmAnd', { ...foto, 'checklist.fotos.depois_frente': { path: 'x', em: Timestamp.now() } }));
    });

    it('NEGA pular etapa, voltar, cancelar', async () => {
      await assertFails(atualiza('fun', 'agAtrib', { status: 'finalizado' }));
      await assertFails(atualiza('fun', 'agEmAnd', { status: 'agendado' }));
      await assertFails(atualiza('fun', 'agAtrib', { status: 'cancelado' }));
    });

    it('NEGA agendamento de outro funcionário ou sem atribuição', async () => {
      await assertFails(atualiza('fran', 'agAtrib', { status: 'em_andamento' }));
      await assertFails(atualiza('fun', 'ag1', { status: 'em_andamento' }));
      await assertFails(atualiza('fun', 'ag1', foto));
    });

    it('NEGA mexer em atendimento já finalizado', async () => {
      await assertFails(atualiza('fun', 'agFim', foto));
    });

    it.each([
      ['total', { total: 1 }],
      ['itens', { itens: [] }],
      ['preço de item', { 'itens.0.precoCentavos': 1 }],
      ['clienteId', { clienteId: 'fun' }],
      ['condominioId', { condominioId: 'c2' }],
      ['funcionarioId (passar para outro)', { funcionarioId: 'fran' }],
      ['avaliacao', nota()],
      ['data', { data: '2031-01-01' }]
    ])('NEGA alterar %s', async (_nome, dados) => {
      await assertFails(atualiza('fun', 'agAtrib', dados as Record<string, unknown>));
    });

    it('NEGA checklist com formato inválido', async () => {
      await assertFails(atualiza('fun', 'agAtrib', { checklist: { fotos: {}, extra: 1 } }));
      await assertFails(atualiza('fun', 'agAtrib', { checklist: { fotos: 'x' } }));
    });
  });

  describe('atualização pelo gerente', () => {
    it('avança o andamento no próprio condomínio e cancela "agendado"', async () => {
      await assertSucceeds(atualiza('gui', 'ag1', { status: 'em_andamento' }));
      await assertSucceeds(atualiza('gui', 'agEmAnd', { status: 'finalizado' }));
      await assertSucceeds(atualiza('gui', 'agAtrib', { status: 'cancelado' }));
    });

    it('NEGA pular etapa, voltar, cancelar o que já começou', async () => {
      await assertFails(atualiza('gui', 'ag1', { status: 'finalizado' }));
      await assertFails(atualiza('gui', 'agEmAnd', { status: 'agendado' }));
      await assertFails(atualiza('gui', 'agEmAnd', { status: 'cancelado' }));
    });

    it('atribui um funcionário de verdade, com o nome correto', async () => {
      await assertSucceeds(atualiza('gui', 'ag1', { funcionarioId: 'fun', funcionarioNome: 'fun' }));
      await assertSucceeds(atualiza('gui', 'agAtrib', { funcionarioId: null, funcionarioNome: null }));
    });

    it('NEGA atribuir quem não é funcionário, ou nome que não confere', async () => {
      await assertFails(atualiza('gui', 'ag1', { funcionarioId: 'ana', funcionarioNome: 'ana' }));
      await assertFails(atualiza('gui', 'ag1', { funcionarioId: 'inexistente', funcionarioNome: 'x' }));
      await assertFails(atualiza('gui', 'ag1', { funcionarioId: 'fun', funcionarioNome: 'Outro nome' }));
    });

    it('grava fotos no checklist', async () => {
      await assertSucceeds(
        atualiza('gui', 'ag1', { 'checklist.fotos.antes_frente': { path: 'agendamentos/ag1/checklist/antes_frente.jpg', em: Timestamp.now() } })
      );
    });

    it('NEGA agendamento de outro condomínio, e gerente sem condomínio', async () => {
      await assertFails(atualiza('gui', 'ag2', { status: 'em_andamento' }));
      await assertFails(atualiza('gabi', 'ag1', { status: 'em_andamento' }));
      await assertFails(atualiza('gnulo', 'agNulo', { status: 'em_andamento' }));
      await assertFails(atualiza('gnulo', 'ag1', { status: 'em_andamento' }));
    });

    it.each([
      ['total', { total: 1 }],
      ['itens', { itens: [] }],
      ['preço de item', { 'itens.0.precoCentavos': 1 }],
      ['clienteId', { clienteId: 'bia' }],
      ['condominioId', { condominioId: 'c2' }],
      ['avaliacao', nota()],
      ['data', { data: '2031-01-01' }]
    ])('NEGA alterar %s', async (_nome, dados) => {
      await assertFails(atualiza('gui', 'ag1', dados as Record<string, unknown>));
      await assertFails(atualiza('gui', 'agFim', dados as Record<string, unknown>));
    });
  });

  describe('atualização por admin e por quem não tem papel', () => {
    it('admin altera qualquer campo', async () => {
      await assertSucceeds(atualiza('adm', 'ag1', { status: 'finalizado' }));
      await assertSucceeds(atualiza('adm', 'ag1', { total: 1, condominioId: 'c2' }));
      await assertSucceeds(atualiza('adm', 'agFim', nota()));
    });

    it('anônimo, insulfilm e gerente de outro condomínio: nada', async () => {
      for (const uid of [null, 'ins']) {
        await assertFails(atualiza(uid, 'ag1', { status: 'cancelado' }));
        await assertFails(atualiza(uid, 'agFim', nota()));
      }
    });
  });

  it('exclusão: só admin', async () => {
    for (const uid of ['ana', 'gui', 'fun', 'ins']) await assertFails(deleteDoc(ref(uid, 'ag1')));
    await assertFails(deleteDoc(ref(null, 'ag1')));
    await assertSucceeds(deleteDoc(ref('adm', 'ag1')));
  });
});

describe('chats/{chatId} (chatId = uid do cliente)', () => {
  const pai = (uid: string | null, chat = 'ana') => doc(como(uid), 'chats', chat);

  describe('documento da conversa', () => {
    it('dono, gerente do condomínio e admin leem; estranhos não', async () => {
      for (const uid of ['ana', 'gui', 'adm']) await assertSucceeds(getDoc(pai(uid)));
      for (const uid of ['bia', 'gabi', 'gnulo', 'ins', 'fun', null]) await assertFails(getDoc(pai(uid)));
    });

    it('lista de conversas: gerente só do próprio condomínio', async () => {
      await assertSucceeds(getDocs(query(collection(como('gui'), 'chats'), where('condominioId', '==', 'c1'))));
      await assertFails(getDocs(query(collection(como('gui'), 'chats'), where('condominioId', '==', 'c2'))));
      await assertFails(getDocs(collection(como('ana'), 'chats')));
    });

    it('cliente abre a própria conversa com o condomínio do perfil', async () => {
      await assertSucceeds(setDoc(pai('bia', 'bia'), { clienteId: 'bia', clienteNome: 'Bia', condominioId: 'c2' }));
    });

    it('NEGA abrir conversa de outro, com outro condomínio, ou por quem não é o dono', async () => {
      await assertFails(setDoc(pai('bia', 'ana'), { clienteId: 'ana', clienteNome: 'x', condominioId: 'c1' }));
      await assertFails(setDoc(pai('bia', 'bia'), { clienteId: 'bia', clienteNome: 'Bia', condominioId: 'c1' }));
      await assertFails(setDoc(pai('bia', 'bia'), { clienteId: 'ana', clienteNome: 'Bia', condominioId: 'c2' }));
      await assertFails(setDoc(pai('gui', 'ana'), { clienteId: 'ana', clienteNome: 'x', condominioId: 'c1' }));
      await assertFails(setDoc(pai('adm', 'ana'), { clienteId: 'ana', clienteNome: 'x', condominioId: 'c1' }));
      await assertFails(setDoc(pai('carlos', 'carlos'), { clienteId: 'carlos', clienteNome: 'x', condominioId: null }));
    });

    it('cliente atualiza o resumo e zera só o contador dele', async () => {
      await assertSucceeds(updateDoc(pai('ana'), { ultimaMensagem: 'oi', ultimaHora: serverTimestamp(), naoLidasGerente: 1 }));
      await assertSucceeds(updateDoc(pai('ana'), { naoLidasCliente: 0 }));
      await assertFails(updateDoc(pai('ana'), { naoLidasCliente: 7 }));
    });

    it('gerente e admin atualizam o resumo e zeram só o contador do gerente', async () => {
      await assertSucceeds(updateDoc(pai('gui'), { ultimaMensagem: 'ok', ultimaHora: serverTimestamp(), naoLidasCliente: 1 }));
      await assertSucceeds(updateDoc(pai('gui'), { naoLidasGerente: 0 }));
      await assertFails(updateDoc(pai('gui'), { naoLidasGerente: 7 }));
      await assertSucceeds(updateDoc(pai('adm'), { naoLidasGerente: 3 }));
    });

    it('NEGA trocar dono ou condomínio, e estranho escrever', async () => {
      for (const uid of ['ana', 'gui', 'adm']) {
        await assertFails(updateDoc(pai(uid), { clienteId: 'bia' }));
        await assertFails(updateDoc(pai(uid), { condominioId: 'c2' }));
      }
      for (const uid of ['bia', 'gabi', 'gnulo', 'ins', 'fun', null]) {
        await assertFails(updateDoc(pai(uid), { ultimaMensagem: 'x' }));
      }
    });

    it('ninguém apaga a conversa', async () => {
      for (const uid of ['ana', 'gui', 'adm']) await assertFails(deleteDoc(pai(uid)));
    });
  });

  describe('mensagens', () => {
    const msg = (extra = {}) => ({ de: 'cliente', texto: 'olá', hora: '10:05', lida: false, criadoEm: serverTimestamp(), ...extra });
    const ref = (uid: string | null, chat = 'ana', id = 'm1') => doc(como(uid), 'chats', chat, 'mensagens', id);

    describe('leitura', () => {
      it('dono, gerente do condomínio e admin leem', async () => {
        await assertSucceeds(getDoc(ref('ana')));
        await assertSucceeds(getDoc(ref('gui')));
        await assertSucceeds(getDoc(ref('adm')));
      });

      it('outro cliente, gerente de outro condomínio, sem condomínio, funcionário, insulfilm e anônimo NÃO leem', async () => {
        for (const uid of ['bia', 'gabi', 'gnulo', 'fun', 'ins', null]) await assertFails(getDoc(ref(uid)));
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

      it('NEGA se passar pelo outro lado', async () => {
        await assertFails(setDoc(ref('ana', 'ana', 'n4'), msg({ de: 'gerente' })));
        await assertFails(setDoc(ref('gui', 'ana', 'n5'), msg({ de: 'cliente' })));
        await assertFails(setDoc(ref('adm', 'ana', 'n5b'), msg({ de: 'cliente' })));
      });

      it('estranhos NÃO escrevem na conversa dos outros', async () => {
        await assertFails(setDoc(ref('bia', 'ana', 'n6'), msg()));
        await assertFails(setDoc(ref('gabi', 'ana', 'n7'), msg({ de: 'gerente' })));
        await assertFails(setDoc(ref('gnulo', 'ana', 'n8'), msg({ de: 'gerente' })));
        await assertFails(setDoc(ref('ins', 'ana', 'n9'), msg({ de: 'gerente' })));
        await assertFails(setDoc(ref('fun', 'ana', 'n9b'), msg({ de: 'gerente' })));
        await assertFails(setDoc(ref(null, 'ana', 'n10'), msg()));
      });

      it('valida o conteúdo: texto vazio, grande demais, campos extras, carimbo falso', async () => {
        await assertFails(setDoc(ref('ana', 'ana', 'v1'), msg({ texto: '' })));
        await assertFails(setDoc(ref('ana', 'ana', 'v2'), msg({ texto: 'x'.repeat(2001) })));
        await assertFails(setDoc(ref('ana', 'ana', 'v3'), msg({ admin: true })));
        await assertFails(setDoc(ref('ana', 'ana', 'v5'), msg({ criadoEm: Timestamp.fromDate(new Date(2020, 1, 1)) })));
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
});

describe('negar tudo que não está liberado', () => {
  it.each(PAPEIS)('%s não lê nem escreve em coleção desconhecida', async (papel) => {
    const db = como(quem[papel]);
    await assertFails(getDoc(doc(db, 'segredos', 'x')));
    await assertFails(setDoc(doc(db, 'segredos', 'x'), { a: 1 }));
    await assertFails(getDocs(collection(db, 'segredos')));
  });

});

describe('cadastro de condomínios pelo admin (tela /admin)', () => {
  const dados = { nome: 'Torre Nova', nomeNormalizado: 'torre nova' };

  it('admin cria, edita e remove', async () => {
    await assertSucceeds(setDoc(doc(como('adm'), 'condominios', 'torre-nova'), dados));
    await assertSucceeds(updateDoc(doc(como('adm'), 'condominios', 'torre-nova'), { nome: 'Torre Dez', nomeNormalizado: 'torre dez' }));
    await assertSucceeds(deleteDoc(doc(como('adm'), 'condominios', 'torre-nova')));
  });

  it.each(['anonimo', 'cliente', 'gerente', 'funcionario', 'insulfilm'] as const)('%s não cria, edita nem remove', async (papel) => {
    const db = como(quem[papel]);
    await assertFails(setDoc(doc(db, 'condominios', 'torre-nova'), dados));
    await assertFails(updateDoc(doc(db, 'condominios', 'c1'), { nome: 'Invadido', nomeNormalizado: 'invadido' }));
    await assertFails(deleteDoc(doc(db, 'condominios', 'c1')));
  });

  it('um cliente não consegue se promover a admin para depois escrever em condominios', async () => {
    await assertFails(updateDoc(doc(como('ana'), 'users', 'ana'), { role: 'admin' }));
    await assertFails(setDoc(doc(como('ana'), 'condominios', 'x'), dados));
  });

  it('listagem da tela: admin lê todos os usuários e conta agendamentos por condomínio', async () => {
    await assertSucceeds(getDocs(collection(como('adm'), 'users')));
    await assertSucceeds(getDocs(collection(como('adm'), 'condominios')));
    await assertSucceeds(getCountFromServer(query(collection(como('adm'), 'agendamentos'), where('condominioId', '==', 'c1'))));
    await assertSucceeds(getCountFromServer(query(collection(como('adm'), 'users'), where('condominioId', '==', 'c1'))));
  });

  it('gerente e cliente não conseguem contar usuários nem agendamentos de um condomínio inteiro', async () => {
    await assertFails(getCountFromServer(query(collection(como('ana'), 'users'), where('condominioId', '==', 'c1'))));
    await assertFails(getCountFromServer(query(collection(como('gui'), 'users'), where('condominioId', '==', 'c1'))));
    await assertFails(getCountFromServer(query(collection(como('ana'), 'agendamentos'), where('condominioId', '==', 'c1'))));
  });

  it('vínculo de gerente/cliente: o próprio usuário não troca o condomínio (só a API do admin troca)', async () => {
    await assertFails(updateDoc(doc(como('gui'), 'users', 'gui'), { condominioId: 'c2' }));
    await assertFails(updateDoc(doc(como('ana'), 'users', 'ana'), { condominioId: 'c2' }));
    await assertFails(updateDoc(doc(como('adm'), 'users', 'gui'), { condominioId: 'c2' })); // admin pelo cliente também não: usa a API
  });
});

// ---------------------------------------------------------------------------------------------
// Ocupação de horários (capacidade) e agendamentos externos (insulfilm)
// ---------------------------------------------------------------------------------------------
describe('ocupação de horários', () => {
  const agBase = (extra: Record<string, unknown> = {}) =>
    comVaga({
      clienteId: 'ana',
      clienteNome: 'Ana',
      condominioId: 'c1',
      itens: [{ servicoId: 's1', nome: 'Lavagem', precoCentavos: 6500 }],
      total: 6500,
      data: '2030-02-01',
      hora: '09:00',
      inicio: futuro(),
      status: 'agendado',
      funcionarioId: null,
      funcionarioNome: null,
      veiculo: { modelo: 'Gol', placa: 'ABC1D23' },
      observacoes: '',
      checklist: { fotos: {} },
      avaliacao: null,
      externo: false,
      criadoEm: serverTimestamp(),
      ...extra
    });

  // id do agendamento, agendamento e vaga no mesmo batch
  const reservar = (uid: string, agId: string, dados: any, vaga: Record<string, unknown> = {}) => {
    const db = como(uid);
    const b = writeBatch(db);
    b.set(doc(db, 'agendamentos', agId), dados);
    b.set(doc(db, 'ocupacao', dados.vagaId), {
      condominioId: dados.condominioId,
      data: dados.data,
      hora: dados.hora,
      externo: dados.externo,
      agendamentoId: agId,
      ...vaga
    });
    return b.commit();
  };

  const cap = (uid: string, n: number, agId: string, extra: Record<string, unknown> = {}) =>
    reservar(uid, agId, agBase({ clienteId: uid, condominioId: 'c3', vagaId: idVaga({ condominioId: 'c3', data: '2030-02-01', hora: '09:00' }, n), ...extra }));

  describe('vaga única', () => {
    it('cria o agendamento e a vaga juntos', async () => {
      await assertSucceeds(reservar('ana', 'a1', agBase()));
    });

    it('a mesma vaga NÃO é dada a dois clientes (vaga duplicada negada)', async () => {
      await assertSucceeds(reservar('ana', 'a1', agBase()));
      await assertFails(reservar('ana2', 'a2', agBase({ clienteId: 'ana2' })));
    });

    it('com capacidade padrão (1) a vaga 2 não existe', async () => {
      await assertSucceeds(reservar('ana', 'a1', agBase()));
      await assertFails(reservar('ana2', 'a2', agBase({ clienteId: 'ana2', vagaId: idVaga({ condominioId: 'c1', data: '2030-02-01', hora: '09:00' }, 2) })));
    });

    it('capacidade 2: aceita duas vagas e NEGA a terceira', async () => {
      await assertSucceeds(cap('cap1', 1, 'k1'));
      await assertSucceeds(cap('cap2', 2, 'k2'));
      await assertFails(cap('cap3', 3, 'k3'));
      await assertFails(cap('cap3', 1, 'k4')); // vaga 1 já ocupada
      await assertFails(cap('cap3', 2, 'k5')); // vaga 2 já ocupada
    });

    it('horários diferentes e condomínios diferentes não competem', async () => {
      await assertSucceeds(reservar('ana', 'a1', agBase()));
      await assertSucceeds(reservar('ana2', 'a2', agBase({ clienteId: 'ana2', hora: '09:30' })));
      await assertSucceeds(reservar('bia', 'a3', agBase({ clienteId: 'bia', condominioId: 'c2' })));
    });

    it('vaga de agendamento cancelado volta a ficar livre', async () => {
      await assertSucceeds(reservar('ana', 'a1', agBase()));
      const db = como('ana');
      const b = writeBatch(db);
      b.update(doc(db, 'agendamentos', 'a1'), { status: 'cancelado', atualizadoEm: serverTimestamp() });
      b.delete(doc(db, 'ocupacao', agBase().vagaId));
      await assertSucceeds(b.commit());
      await assertSucceeds(reservar('ana2', 'a2', agBase({ clienteId: 'ana2' })));
    });
  });

  describe('a vaga precisa bater com o agendamento (nada de vaga solta ou forjada)', () => {
    it('agendamento SEM vaga no batch é negado', async () => {
      await assertFails(setDoc(doc(como('ana'), 'agendamentos', 'a1'), agBase()));
    });

    it('vaga SEM agendamento no batch é negada (ninguém reserva vaga à toa)', async () => {
      await assertFails(
        setDoc(doc(como('ana'), 'ocupacao', 'c1_2030-02-01_09:00_1'), {
          condominioId: 'c1', data: '2030-02-01', hora: '09:00', externo: false, agendamentoId: 'nada'
        })
      );
    });

    it('agendamentoId da vaga diferente do agendamento é negado', async () => {
      await assertFails(reservar('ana', 'a1', agBase(), { agendamentoId: 'outro' }));
    });

    it('vaga de outro horário, data ou condomínio que o agendamento é negada', async () => {
      await assertFails(reservar('ana', 'a1', agBase(), { hora: '10:00' }));
      await assertFails(reservar('ana', 'a1', agBase(), { data: '2030-02-02' }));
      await assertFails(reservar('ana', 'a1', agBase(), { condominioId: 'c2' }));
    });

    it('id da vaga que não corresponde ao horário é negado', async () => {
      await assertFails(reservar('ana', 'a1', agBase({ vagaId: 'c1_2030-02-01_15:00_1' })));
      await assertFails(reservar('ana', 'a1', agBase({ vagaId: 'qualquer-coisa' })));
    });

    it('vaga 0, negativa, não numérica ou grande demais é negada', async () => {
      for (const sufixo of ['0', '-1', 'x', '99', '100']) {
        await assertFails(reservar('ana', 'a1', agBase({ vagaId: `c1_2030-02-01_09:00_${sufixo}` })));
      }
    });

    it('vaga com campo extra ou dado pessoal é negada', async () => {
      await assertFails(reservar('ana', 'a1', agBase(), { clienteNome: 'Ana' }));
    });

    it('cliente não reserva vaga em condomínio que não é o dele', async () => {
      await assertFails(reservar('ana', 'a1', agBase({ condominioId: 'c2' })));
    });

    it('não atualiza vaga existente, nem o dono', async () => {
      for (const uid of ['ana', 'gui', 'adm']) {
        await assertFails(updateDoc(doc(como(uid), 'ocupacao', 'c1_2030-01-01_08:00_1'), { agendamentoId: 'ag2' }));
        await assertFails(setDoc(doc(como(uid), 'ocupacao', 'c1_2030-01-01_08:00_1'), { condominioId: 'c1', data: '2030-01-01', hora: '08:00', externo: false, agendamentoId: 'ag1' }));
      }
    });

    it('gerente, funcionário, admin e anônimo não criam vaga', async () => {
      for (const uid of ['gui', 'fun', 'adm', null]) {
        await assertFails(
          setDoc(doc(como(uid), 'ocupacao', 'c1_2030-03-01_09:00_1'), {
            condominioId: 'c1', data: '2030-03-01', hora: '09:00', externo: false, agendamentoId: 'x'
          })
        );
      }
    });
  });

  describe('liberar a vaga (cancelamento)', () => {
    const cancelaE = (uid: string, agId = 'ag1', vaga = 'c1_2030-01-01_08:00_1') => {
      const db = como(uid);
      const b = writeBatch(db);
      b.update(doc(db, 'agendamentos', agId), { status: 'cancelado', atualizadoEm: serverTimestamp() });
      b.delete(doc(db, 'ocupacao', vaga));
      return b.commit();
    };

    it('dono, gerente do condomínio e admin cancelam e liberam', async () => {
      await assertSucceeds(cancelaE('ana'));
    });

    it('gerente do condomínio libera', async () => {
      await assertSucceeds(cancelaE('gui'));
    });

    it('admin libera', async () => {
      await assertSucceeds(cancelaE('adm'));
    });

    it('outro cliente, gerente de outro condomínio, funcionário e anônimo NÃO liberam', async () => {
      for (const uid of ['bia', 'ana2', 'gabi', 'gnulo', 'fun']) await assertFails(cancelaE(uid));
    });

    it('apagar a vaga sem cancelar o agendamento é negado (para não-admin)', async () => {
      for (const uid of ['ana', 'gui']) {
        await assertFails(deleteDoc(doc(como(uid), 'ocupacao', 'c1_2030-01-01_08:00_1')));
      }
    });

    it('admin apaga vaga solta', async () => {
      await assertSucceeds(deleteDoc(doc(como('adm'), 'ocupacao', 'c1_2030-01-01_08:00_1')));
    });
  });

  describe('leitura', () => {
    it('cliente e gerente leem as vagas do próprio condomínio; admin lê todas', async () => {
      await assertSucceeds(getDoc(doc(como('ana'), 'ocupacao', 'c1_2030-01-01_08:00_1')));
      await assertSucceeds(getDoc(doc(como('gui'), 'ocupacao', 'c1_2030-01-01_08:00_1')));
      await assertSucceeds(getDoc(doc(como('adm'), 'ocupacao', 'c1_2030-01-01_08:00_1')));
    });

    it('NÃO leem vaga regular de outro condomínio, nem sem login, nem sem condomínio', async () => {
      for (const uid of ['bia', 'gabi', 'carlos', 'gnulo', null]) {
        await assertFails(getDoc(doc(como(uid), 'ocupacao', 'c1_2030-01-01_08:00_1')));
      }
    });

    it('vagas externas: qualquer usuário logado lê; anônimo não', async () => {
      for (const uid of ['ana', 'bia', 'carlos', 'gui', 'fun', 'adm']) {
        await assertSucceeds(getDoc(doc(como(uid), 'ocupacao', 'ext_2030-01-01_10:00_1')));
      }
      await assertFails(getDoc(doc(como(null), 'ocupacao', 'ext_2030-01-01_10:00_1')));
    });

    it('consultas que o app faz: vagas do condomínio e vagas externas', async () => {
      await assertSucceeds(
        getDocs(query(collection(como('ana'), 'ocupacao'), where('condominioId', '==', 'c1'), where('externo', '==', false), where('data', '>=', '2030-01-01')))
      );
      await assertSucceeds(
        getDocs(query(collection(como('ana'), 'ocupacao'), where('externo', '==', true), where('data', '>=', '2030-01-01')))
      );
      await assertFails(getDocs(query(collection(como('ana'), 'ocupacao'), where('condominioId', '==', 'c2'))));
      await assertFails(getDocs(collection(como('ana'), 'ocupacao')));
    });
  });

  describe('capacidade configurável (só admin)', () => {
    it('admin edita a capacidade do condomínio e a do insulfilm', async () => {
      await assertSucceeds(updateDoc(doc(como('adm'), 'condominios', 'c1'), { capacidade: 3 }));
      await assertSucceeds(setDoc(doc(como('adm'), 'config', 'insulfilm'), { capacidade: 2 }));
    });

    it('valores inválidos são negados', async () => {
      for (const v of [0, -1, 21, 1.5, '2', null]) {
        await assertFails(updateDoc(doc(como('adm'), 'condominios', 'c1'), { capacidade: v }));
        await assertFails(setDoc(doc(como('adm'), 'config', 'insulfilm'), { capacidade: v }));
      }
      await assertFails(setDoc(doc(como('adm'), 'config', 'insulfilm'), { capacidade: 2, extra: 1 }));
      await assertFails(setDoc(doc(como('adm'), 'config', 'outra'), { capacidade: 2 }));
    });

    it('cliente, gerente, funcionário e anônimo NÃO editam capacidade', async () => {
      for (const uid of ['ana', 'gui', 'fun', 'ins', null]) {
        await assertFails(updateDoc(doc(como(uid), 'condominios', 'c1'), { capacidade: 50 }));
        await assertFails(setDoc(doc(como(uid), 'config', 'insulfilm'), { capacidade: 50 }));
      }
    });

    it('capacidade vira limite real: aumentar libera a terceira vaga', async () => {
      await assertSucceeds(updateDoc(doc(como('adm'), 'condominios', 'c3'), { capacidade: 3 }));
      await assertSucceeds(cap('cap1', 1, 'k1'));
      await assertSucceeds(cap('cap2', 2, 'k2'));
      await assertSucceeds(cap('cap3', 3, 'k3'));
    });

    it('usuários logados leem config/insulfilm', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'config', 'insulfilm'), { capacidade: 2 }));
      await assertSucceeds(getDoc(doc(como('ana'), 'config', 'insulfilm')));
      await assertFails(getDoc(doc(como(null), 'config', 'insulfilm')));
    });
  });
});

describe('agendamentos externos (insulfilm como funcionário atribuído)', () => {
  const ext = (extra: Record<string, unknown> = {}) =>
    comVaga({
      clienteId: 'ana',
      clienteNome: 'Ana',
      condominioId: 'c1',
      itens: [{ servicoId: 's4', nome: 'Insulfilm', precoCentavos: 35000 }],
      total: 35000,
      data: '2030-02-01',
      hora: '14:00',
      inicio: futuro(),
      status: 'agendado',
      funcionarioId: null,
      funcionarioNome: null,
      veiculo: { modelo: 'Gol', placa: 'ABC1D23' },
      observacoes: '',
      checklist: { fotos: {} },
      avaliacao: null,
      externo: true,
      criadoEm: serverTimestamp(),
      ...extra
    });

  const reservar = (uid: string, agId: string, dados: any, vaga: Record<string, unknown> = {}) => {
    const db = como(uid);
    const b = writeBatch(db);
    b.set(doc(db, 'agendamentos', agId), dados);
    b.set(doc(db, 'ocupacao', dados.vagaId), {
      condominioId: dados.condominioId, data: dados.data, hora: dados.hora, externo: dados.externo, agendamentoId: agId, ...vaga
    });
    return b.commit();
  };

  const itens = {
    lav: { servicoId: 's1', nome: 'Lavagem', precoCentavos: 6500 },
    ins: { servicoId: 's4', nome: 'Insulfilm', precoCentavos: 35000 },
    ins2: { servicoId: 's5', nome: 'Insulfilm Premium', precoCentavos: 68000 }
  };

  describe('campo externo validado contra a categoria do catálogo', () => {
    it('só insulfilm => externo == true (vaga ext_)', async () => {
      await assertSucceeds(reservar('ana', 'e1', ext()));
    });

    it('2 itens de insulfilm => externo true', async () => {
      await assertSucceeds(reservar('ana', 'e1', ext({ itens: [itens.ins, itens.ins2], total: 103000 })));
    });

    it('nenhum insulfilm => externo == false', async () => {
      await assertSucceeds(reservar('ana', 'e1', ext({ itens: [itens.lav], total: 6500, externo: false, vagaId: 'c1_2030-02-01_14:00_1' })));
    });

    it('MISTURA de insulfilm com outro serviço é negada, nos dois valores de externo', async () => {
      const mistura = { itens: [itens.lav, itens.ins], total: 41500 };
      await assertFails(reservar('ana', 'e1', ext({ ...mistura, externo: true })));
      await assertFails(reservar('ana', 'e2', ext({ ...mistura, externo: false, vagaId: 'c1_2030-02-01_14:00_1' })));
    });

    it('externo FORJADO é negado: insulfilm marcado como regular e lavagem marcada como externa', async () => {
      await assertFails(reservar('ana', 'e1', ext({ externo: false, vagaId: 'c1_2030-02-01_14:00_1' })));
      await assertFails(reservar('ana', 'e2', ext({ itens: [itens.lav], total: 6500 })));
    });

    it('externo ausente ou com tipo errado é negado', async () => {
      const { externo, ...semExterno } = ext() as any;
      const vagaExt = { externo: true };
      await assertFails(reservar('ana', 'e1', semExterno, vagaExt));
      await assertFails(reservar('ana', 'e2', ext({ externo: 'true' }), vagaExt));
      await assertFails(reservar('ana', 'e3', ext({ externo: 1 }), vagaExt));
    });

    it('o cliente não consegue mudar externo nem vagaId depois de criar', async () => {
      await assertSucceeds(reservar('ana', 'e1', ext()));
      for (const dados of [{ externo: false }, { vagaId: 'x' }]) {
        await assertFails(updateDoc(doc(como('ana'), 'agendamentos', 'e1'), { atualizadoEm: serverTimestamp(), ...dados }));
        await assertFails(updateDoc(doc(como('gui'), 'agendamentos', 'e1'), { atualizadoEm: serverTimestamp(), ...dados }));
      }
    });
  });

  describe('vagas externas (agenda única, qualquer condomínio)', () => {
    it('vaga ext_ não depende do condomínio: o mesmo horário é disputado por todos', async () => {
      await assertSucceeds(reservar('ana', 'e1', ext()));
      await assertFails(reservar('bia', 'e2', ext({ clienteId: 'bia', condominioId: 'c2' })));
    });

    it('capacidade do insulfilm (config) vale: padrão 1, com 2 aceita duas e nega a terceira', async () => {
      await assertSucceeds(reservar('ana', 'e1', ext()));
      await assertFails(reservar('ana2', 'e2', ext({ clienteId: 'ana2', vagaId: 'ext_2030-02-01_14:00_2' })));
      await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'config', 'insulfilm'), { capacidade: 2 }));
      await assertSucceeds(reservar('ana2', 'e2', ext({ clienteId: 'ana2', vagaId: 'ext_2030-02-01_14:00_2' })));
      await assertFails(reservar('bia', 'e3', ext({ clienteId: 'bia', condominioId: 'c2', vagaId: 'ext_2030-02-01_14:00_3' })));
    });

    it('id com prefixo de condomínio numa vaga externa (ou ext_ numa regular) é negado', async () => {
      await assertFails(reservar('ana', 'e1', ext({ vagaId: 'c1_2030-02-01_14:00_1' })));
      await assertFails(reservar('ana', 'e2', ext({ itens: [itens.lav], total: 6500, externo: false, vagaId: 'ext_2030-02-01_14:00_1' })));
    });
  });

  describe('atribuição só a funcionário com especialidade insulfilm', () => {
    const atribui = (uid: string, id: string, f: string) =>
      updateDoc(doc(como(uid), 'agendamentos', id), { funcionarioId: f, funcionarioNome: f, atualizadoEm: serverTimestamp() });

    it('gerente atribui o agendamento externo a quem tem a especialidade', async () => {
      await env.withSecurityRulesDisabled(async (ctx) =>
        setDoc(doc(ctx.firestore(), 'agendamentos', 'agExtC1'), {
          clienteId: 'ana', condominioId: 'c1', status: 'agendado', externo: true, funcionarioId: null, itens: [], total: 0
        })
      );
      await assertSucceeds(atribui('gui', 'agExtC1', 'fins'));
    });

    it('NEGA atribuir o externo a funcionário sem a especialidade, a cliente ou a inexistente', async () => {
      await env.withSecurityRulesDisabled(async (ctx) =>
        setDoc(doc(ctx.firestore(), 'agendamentos', 'agExtC1'), {
          clienteId: 'ana', condominioId: 'c1', status: 'agendado', externo: true, funcionarioId: null, itens: [], total: 0
        })
      );
      for (const f of ['fun', 'fran', 'ana', 'adm', 'naoexiste']) {
        await assertFails(atribui('gui', 'agExtC1', f));
      }
    });

    it('agendamento regular continua podendo ir para qualquer funcionário', async () => {
      await assertSucceeds(atribui('gui', 'ag1', 'fun'));
    });

    it('o funcionário não se atribui nem passa o atendimento adiante', async () => {
      await assertFails(atribui('fins', 'agExt', 'fran'));
    });

    it('especialidade só nasce pelo admin/API: ninguém a grava pelo cliente', async () => {
      await assertFails(updateDoc(doc(como('fun'), 'users', 'fun'), { especialidade: 'insulfilm' }));
      await assertFails(updateDoc(doc(como('adm'), 'users', 'fun'), { especialidade: 'insulfilm' }));
      await assertFails(setDoc(doc(como('novo'), 'users', 'novo'), { nome: 'x', email: 'x@ex.com', role: 'cliente', condominioId: null, especialidade: 'insulfilm' }));
    });
  });

  describe('o insulfilm usa as telas e regras do funcionário', () => {
    it('funcionário com especialidade lê, avança e grava fotos do externo atribuído', async () => {
      await assertSucceeds(getDoc(doc(como('fins'), 'agendamentos', 'agExt')));
      await assertSucceeds(updateDoc(doc(como('fins'), 'agendamentos', 'agExt'), { status: 'em_andamento', atualizadoEm: serverTimestamp() }));
      await assertSucceeds(
        updateDoc(doc(como('fins'), 'agendamentos', 'agExt'), { 'checklist.fotos.antes_frente': { path: 'agendamentos/agExt/checklist/antes_frente.jpg', em: Timestamp.now() }, atualizadoEm: serverTimestamp() })
      );
    });

    it('NÃO lê nem altera externo de que não é responsável; o papel legado "insulfilm" nada pode', async () => {
      await assertFails(getDoc(doc(como('fran'), 'agendamentos', 'agExt')));
      await assertFails(updateDoc(doc(como('fran'), 'agendamentos', 'agExt'), { status: 'em_andamento', atualizadoEm: serverTimestamp() }));
      await assertFails(getDoc(doc(como('ins'), 'agendamentos', 'agExt')));
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Pagamento (Asaas): só o servidor escreve
// ---------------------------------------------------------------------------------------------
describe('pagamento: campo "pagamento", eventosAsaas e clientesAsaas só pelo servidor', () => {
  const pag = { status: 'pago', checkoutId: 'chk-1', pagoEm: Timestamp.now() };

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await updateDoc(doc(db, 'agendamentos', 'agAtrib'), { pagamento: { status: 'pendente', checkoutId: 'chk-1' } });
      await setDoc(doc(db, 'eventosAsaas', 'evt_1'), { evento: 'CHECKOUT_PAID', resultado: 'pago' });
      await setDoc(doc(db, 'clientesAsaas', 'ana'), { asaasCustomerId: 'cus_000005' });
    });
  });

  const atualiza = (uid: string | null, dados: Record<string, unknown>) =>
    updateDoc(doc(como(uid), 'agendamentos', 'agAtrib'), { atualizadoEm: serverTimestamp(), ...dados });

  describe('campo pagamento no agendamento', () => {
    it('dono, gerente do condomínio, funcionário atribuído e admin LEEM o status do pagamento', async () => {
      for (const uid of ['ana', 'gui', 'fun', 'adm']) {
        await assertSucceeds(getDoc(doc(como(uid), 'agendamentos', 'agAtrib')));
      }
    });

    it('NENHUM papel cria o agendamento já com pagamento (nem "pago")', async () => {
      const db = como('ana');
      const b = writeBatch(db);
      const dados = comVaga({
        clienteId: 'ana', clienteNome: 'Ana', condominioId: 'c1',
        itens: [{ servicoId: 's1', nome: 'Lavagem', precoCentavos: 6500 }], total: 6500,
        data: '2030-04-01', hora: '09:00', inicio: futuro(), status: 'agendado', funcionarioId: null, funcionarioNome: null,
        veiculo: { modelo: 'Gol', placa: 'ABC1D23' }, observacoes: '', checklist: { fotos: {} }, avaliacao: null,
        externo: false, criadoEm: serverTimestamp(), pagamento: pag
      });
      b.set(doc(db, 'agendamentos', 'novoPag'), dados);
      b.set(doc(db, 'ocupacao', (dados as any).vagaId), { condominioId: 'c1', data: '2030-04-01', hora: '09:00', externo: false, agendamentoId: 'novoPag' });
      await assertFails(b.commit());
    });

    it.each([
      ['ana', 'dono'],
      ['gui', 'gerente do condomínio'],
      ['fun', 'funcionário atribuído'],
      ['adm', 'admin'],
      ['gabi', 'gerente de outro condomínio'],
      ['ins', 'papel legado']
    ])('%s (%s) NÃO altera o pagamento', async (uid) => {
      await assertFails(atualiza(uid, { pagamento: pag }));
      await assertFails(atualiza(uid, { 'pagamento.status': 'pago' }));
      await assertFails(atualiza(uid, { pagamento: { status: 'pago_apos_cancelamento', revisao: false } }));
    });

    it('NÃO apaga o campo nem troca o status junto com o pagamento', async () => {
      for (const uid of ['ana', 'gui', 'fun', 'adm']) {
        await assertFails(atualiza(uid, { pagamento: null }));
        await assertFails(atualiza(uid, { status: 'em_andamento', pagamento: pag }));
      }
    });

    it('o admin continua alterando o resto do agendamento (só o pagamento é do servidor)', async () => {
      await assertSucceeds(atualiza('adm', { status: 'em_andamento' }));
    });

    it('anônimo não altera', async () => {
      await assertFails(atualiza(null, { pagamento: pag }));
    });
  });

  describe('eventosAsaas e clientesAsaas: ninguém no cliente', () => {
    for (const colecao of ['eventosAsaas', 'clientesAsaas']) {
      const id = colecao === 'eventosAsaas' ? 'evt_1' : 'ana';

      it.each(['ana', 'bia', 'gui', 'fun', 'fins', 'adm', 'ins', null])(`${colecao}: %s não lê, não lista, não escreve, não apaga`, async (uid) => {
        const db = como(uid);
        await assertFails(getDoc(doc(db, colecao, id)));
        await assertFails(getDocs(collection(db, colecao)));
        await assertFails(setDoc(doc(db, colecao, 'novo'), { asaasCustomerId: 'cus_1', resultado: 'pago' }));
        await assertFails(updateDoc(doc(db, colecao, id), { asaasCustomerId: 'cus_2', resultado: 'pago' }));
        await assertFails(deleteDoc(doc(db, colecao, id)));
      });
    }

    it('o cliente não grava o id do Asaas no próprio perfil nem lê de volta o que o servidor guardou', async () => {
      await assertFails(updateDoc(doc(como('ana'), 'users', 'ana'), { asaasCustomerId: 'cus_000005' }));
      await assertFails(setDoc(doc(como('novo'), 'users', 'novo'), { nome: 'x', email: 'x@ex.com', role: 'cliente', condominioId: null, asaasCustomerId: 'cus_1' }));
      await assertFails(getDoc(doc(como('ana'), 'clientesAsaas', 'ana')));
    });
  });
});

describe('atividades (log imutável)', () => {
  const ativ = (uid: string, extra: Record<string, unknown> = {}) => ({
    em: serverTimestamp(),
    atorUid: uid,
    atorPapel: PERFIS[uid].role,
    acao: 'status_agendamento',
    alvoTipo: 'agendamento',
    alvoId: 'ag1',
    antes: { status: 'agendado' },
    depois: { status: 'em_andamento' },
    origem: 'app',
    ...extra
  });
  const preco = (extra: Record<string, unknown> = {}) =>
    ativ('adm', { acao: 'preco_alterado', alvoTipo: 'servico', alvoId: 's1', antes: { precoCentavos: 6500 }, depois: { precoCentavos: 7000 }, ...extra });
  const login = (extra: Record<string, unknown> = {}) =>
    ativ('adm', { acao: 'login_admin', alvoTipo: 'usuario', alvoId: 'adm', antes: undefined, depois: undefined, ...extra });
  const limpo = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

  it('create válido: status (gerente, funcionário, cliente), preço e login (admin)', async () => {
    await assertSucceeds(setDoc(doc(como('gui'), 'atividades', 'a1'), ativ('gui')));
    await assertSucceeds(setDoc(doc(como('fun'), 'atividades', 'a2'), ativ('fun')));
    await assertSucceeds(setDoc(doc(como('ana'), 'atividades', 'a3'), ativ('ana', { depois: { status: 'cancelado' } })));
    await assertSucceeds(setDoc(doc(como('adm'), 'atividades', 'a4'), preco()));
    await assertSucceeds(setDoc(doc(como('adm'), 'atividades', 'a5'), limpo(login())));
  });

  it('forjar outro atorUid ou outro papel é negado', async () => {
    await assertFails(setDoc(doc(como('ana'), 'atividades', 'f1'), ativ('ana', { atorUid: 'gui' })));
    await assertFails(setDoc(doc(como('ana'), 'atividades', 'f2'), ativ('ana', { atorPapel: 'admin' })));
    await assertFails(setDoc(doc(como('ana'), 'atividades', 'f3'), ativ('ana', { atorUid: 'adm', atorPapel: 'admin' })));
  });

  it('só o admin registra preço e login; cliente não registra preço', async () => {
    await assertFails(setDoc(doc(como('gui'), 'atividades', 'p1'), ativ('gui', { acao: 'preco_alterado', alvoTipo: 'servico', alvoId: 's1', antes: { precoCentavos: 1 }, depois: { precoCentavos: 2 } })));
    await assertFails(setDoc(doc(como('ana'), 'atividades', 'p2'), ativ('ana', { acao: 'login_admin', alvoTipo: 'usuario', alvoId: 'ana' })));
    await assertFails(setDoc(doc(como('adm'), 'atividades', 'p3'), limpo(login({ alvoId: 'ana' }))));
  });

  it('campos fora do formato são negados (hora do cliente, campo extra, e-mail, ação fora da lista, origem)', async () => {
    await assertFails(setDoc(doc(como('gui'), 'atividades', 'x1'), ativ('gui', { em: Timestamp.fromDate(new Date('2020-01-01')) })));
    await assertFails(setDoc(doc(como('gui'), 'atividades', 'x2'), ativ('gui', { email: 'a@b.com' })));
    await assertFails(setDoc(doc(como('gui'), 'atividades', 'x3'), ativ('gui', { depois: { status: 'em_andamento', email: 'a@b.com' } })));
    await assertFails(setDoc(doc(como('gui'), 'atividades', 'x4'), ativ('gui', { depois: { status: 'qualquer' } })));
    await assertFails(setDoc(doc(como('gui'), 'atividades', 'x5'), ativ('gui', { acao: 'usuario_removido', alvoTipo: 'usuario' })));
    await assertFails(setDoc(doc(como('gui'), 'atividades', 'x6'), ativ('gui', { origem: 'api' })));
    await assertFails(setDoc(doc(como('adm'), 'atividades', 'x7'), preco({ depois: { precoCentavos: 7000.5 } })));
    await assertFails(setDoc(doc(como(null), 'atividades', 'x8'), ativ('gui')));
  });

  it('update e delete negados a todos, inclusive ao autor e ao admin', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'atividades', 'e1'), { ...ativ('gui'), em: Timestamp.now() }));
    for (const uid of ['gui', 'adm', 'ana']) {
      await assertFails(updateDoc(doc(como(uid), 'atividades', 'e1'), { acao: 'preco_alterado' }));
      await assertFails(deleteDoc(doc(como(uid), 'atividades', 'e1')));
      await assertFails(setDoc(doc(como(uid), 'atividades', 'e1'), { ...ativ(uid), alvoId: 'outro' }));
    }
  });

  it('leitura só do admin (nem o autor, nem o gerente, nem anônimo)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'atividades', 'l1'), { ...ativ('gui'), em: Timestamp.now() }));
    await assertSucceeds(getDoc(doc(como('adm'), 'atividades', 'l1')));
    for (const uid of ['gui', 'ana', 'fun']) await assertFails(getDoc(doc(como(uid), 'atividades', 'l1')));
    await assertFails(getDoc(doc(como(null), 'atividades', 'l1')));
    await assertSucceeds(getDocs(query(collection(como('adm'), 'atividades'))));
    await assertFails(getDocs(query(collection(como('gui'), 'atividades'))));
  });

  it('o log não é exigido por nenhuma outra regra (compatível com a build antiga do app)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'servicos', 's9'), { nome: 'X', precoCentavos: 100, duracaoMin: 30, ativo: true }));
    await assertSucceeds(updateDoc(doc(como('adm'), 'servicos', 's9'), { precoCentavos: 200 }));
  });
});

describe('custos (só admin)', () => {
  const custo = (extra: Record<string, unknown> = {}) => ({
    categoria: 'produtos',
    descricao: 'Shampoo',
    valorCentavos: 125050,
    competencia: '2030-03-01',
    tipo: 'avulso',
    escopo: 'geral',
    criadoPor: 'adm',
    criadoEm: serverTimestamp(),
    ...extra
  });
  const semear = (id = 'k1', extra: Record<string, unknown> = {}) =>
    env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'custos', id), { ...custo(extra), criadoEm: Timestamp.now() }));

  it('admin cria avulso, recorrente (com e sem fim) e por condomínio', async () => {
    await assertSucceeds(setDoc(doc(como('adm'), 'custos', 'a'), custo()));
    await assertSucceeds(setDoc(doc(como('adm'), 'custos', 'b'), custo({ tipo: 'recorrente', recorrencia: 'mensal', fim: '2030-08-01' })));
    await assertSucceeds(setDoc(doc(como('adm'), 'custos', 'c'), custo({ tipo: 'recorrente', recorrencia: 'mensal', fim: null })));
    await assertSucceeds(setDoc(doc(como('adm'), 'custos', 'd'), custo({ escopo: 'c1' })));
  });

  it('ninguém além do admin lê, cria, altera ou apaga', async () => {
    await semear();
    for (const uid of ['ana', 'gui', 'fun']) {
      await assertFails(getDoc(doc(como(uid), 'custos', 'k1')));
      await assertFails(setDoc(doc(como(uid), 'custos', 'n'), custo({ criadoPor: uid })));
      await assertFails(updateDoc(doc(como(uid), 'custos', 'k1'), { descricao: 'x', atualizadoEm: serverTimestamp() }));
      await assertFails(deleteDoc(doc(como(uid), 'custos', 'k1')));
    }
    await assertFails(getDoc(doc(como(null), 'custos', 'k1')));
    await assertFails(setDoc(doc(como(null), 'custos', 'n'), custo()));
  });

  it('formato inválido é negado (categoria, valor, competência, tipo, escopo, autor, hora, campo extra)', async () => {
    const ruins: Record<string, unknown>[] = [
      { categoria: 'invalida' },
      { descricao: '' },
      { valorCentavos: 0 },
      { valorCentavos: 10.5 },
      { valorCentavos: 200000000 },
      { competencia: '2030-03-15' },
      { competencia: '2030-13-01' },
      { tipo: 'avulso', recorrencia: 'mensal' },
      { tipo: 'recorrente' },
      { tipo: 'recorrente', recorrencia: 'mensal', fim: '2030-01-01' },
      { escopo: 'condominio-que-nao-existe' },
      { criadoPor: 'gui' },
      { criadoEm: Timestamp.fromDate(new Date('2020-01-01')) },
      { email: 'a@b.com' }
    ];
    for (const [i, r] of ruins.entries()) await assertFails(setDoc(doc(como('adm'), 'custos', `r${i}`), custo(r)));
  });

  it('update: admin altera valor; autor e data de criação não mudam; sem carimbo de hora é negado', async () => {
    await semear();
    const base = { categoria: 'produtos', descricao: 'Shampoo', competencia: '2030-03-01', tipo: 'avulso', escopo: 'geral' };
    await assertSucceeds(updateDoc(doc(como('adm'), 'custos', 'k1'), { ...base, valorCentavos: 99900, atualizadoEm: serverTimestamp() }));
    await assertFails(updateDoc(doc(como('adm'), 'custos', 'k1'), { valorCentavos: 100 }));
    await assertFails(updateDoc(doc(como('adm'), 'custos', 'k1'), { criadoPor: 'gui', atualizadoEm: serverTimestamp() }));
    await assertFails(updateDoc(doc(como('adm'), 'custos', 'k1'), { valorCentavos: -1, atualizadoEm: serverTimestamp() }));
  });

  it('admin apaga', async () => {
    await semear();
    await assertSucceeds(deleteDoc(doc(como('adm'), 'custos', 'k1')));
  });

  it('log de custo: só admin registra, só com categoria e valor', async () => {
    const log = (uid: string, extra: Record<string, unknown> = {}) => ({
      em: serverTimestamp(), atorUid: uid, atorPapel: PERFIS[uid].role, acao: 'custo_criado', alvoTipo: 'custo', alvoId: 'k1',
      depois: { categoria: 'produtos', valorCentavos: 125050 }, origem: 'app', ...extra
    });
    await assertSucceeds(setDoc(doc(como('adm'), 'atividades', 'l1'), log('adm')));
    await assertSucceeds(setDoc(doc(como('adm'), 'atividades', 'l2'), log('adm', { acao: 'custo_alterado', antes: { categoria: 'produtos', valorCentavos: 1 } })));
    await assertFails(setDoc(doc(como('gui'), 'atividades', 'l3'), log('gui')));
    await assertFails(setDoc(doc(como('adm'), 'atividades', 'l4'), log('adm', { depois: { descricao: 'segredo', valorCentavos: 1 } })));
    await assertFails(setDoc(doc(como('adm'), 'atividades', 'l5'), log('adm', { alvoTipo: 'servico' })));
  });
});
