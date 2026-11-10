import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firestore e Storage são mocks: aqui se confere O QUE o app grava (o firestore.rules confere se é aceito)
const m = vi.hoisted(() => {
  const escritas: { tipo: string; ref: any; dados?: any }[] = [];
  return {
    escritas,
    setDoc: vi.fn(async (ref: any, dados: any) => void escritas.push({ tipo: 'set', ref, dados })),
    updateDoc: vi.fn(async (ref: any, dados: any) => void escritas.push({ tipo: 'update', ref, dados })),
    getDoc: vi.fn(),
    lote: { set: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) },
    onSnapshot: vi.fn(() => () => {}),
    uploadBytes: vi.fn(async () => ({})),
    getDownloadURL: vi.fn(async () => 'https://exemplo/foto.jpg')
  };
});

vi.mock('./firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('firebase/firestore', async () => {
  const real = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  let n = 0;
  return {
    Timestamp: real.Timestamp,
    collection: (_db: unknown, ...caminho: string[]) => ({ caminho: caminho.join('/') }),
    doc: (a: any, ...caminho: string[]) =>
      a?.caminho ? { caminho: `${a.caminho}/auto${++n}`, id: `auto${n}` } : { caminho: caminho.join('/'), id: caminho[caminho.length - 1] },
    query: (c: unknown) => c,
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    increment: (v: number) => ({ incremento: v }),
    serverTimestamp: () => 'SERVER_TS',
    writeBatch: () => m.lote,
    setDoc: m.setDoc,
    updateDoc: m.updateDoc,
    getDoc: m.getDoc,
    onSnapshot: m.onSnapshot,
    addDoc: vi.fn()
  };
});
vi.mock('firebase/storage', () => ({
  ref: (_s: unknown, caminho: string) => ({ caminho }),
  uploadBytes: m.uploadBytes,
  getDownloadURL: m.getDownloadURL
}));

import { app } from './app.svelte';
import { aplicarCatalogo } from './catalogo.svelte';

const cliente = { uid: 'u1', nome: 'Ana', role: 'cliente', condominioId: 'c1' };

beforeEach(() => {
  vi.clearAllMocks();
  m.escritas.length = 0;
  m.getDoc.mockResolvedValue({ exists: () => false });
  app.parar();
  aplicarCatalogo([
    { id: 'eco01', data: { precoCentavos: 6500, nome: 'Banho Básico', ativo: true } },
    { id: 'eco02', data: { precoCentavos: 9000, nome: 'Banho', ativo: false } }
  ]);
  app.iniciar(cliente);
});

describe('criarAgendamento', () => {
  it('grava no Firestore com cliente, condomínio, nome e preço do serviço no momento da contratação', async () => {
    const id = await app.criarAgendamento({
      servicos: ['eco01'],
      data: '2030-05-10',
      hora: '09:00',
      veiculo: { modelo: 'Gol', placa: 'abc1d23' }
    });
    const escrita = m.escritas.find((e) => e.tipo === 'set' && e.ref.caminho.startsWith('agendamentos/'))!;
    expect(escrita.ref.id).toBe(id);
    expect(escrita.dados).toMatchObject({
      clienteId: 'u1',
      clienteNome: 'Ana',
      condominioId: 'c1',
      itens: [{ servicoId: 'eco01', nome: 'Banho Básico', precoCentavos: 6500 }],
      total: 6500,
      status: 'agendado',
      veiculo: { modelo: 'Gol', placa: 'ABC1D23' },
      criadoEm: 'SERVER_TS'
    });
  });

  it('recusa serviço desativado ou fora do catálogo, sem escrever nada', async () => {
    const base = { data: '2030-05-10', hora: '09:00', veiculo: { modelo: 'Gol', placa: 'ABC1D23' } };
    await expect(app.criarAgendamento({ ...base, servicos: ['eco02'] })).rejects.toThrow(/indispon/i);
    await expect(app.criarAgendamento({ ...base, servicos: ['eco03'] })).rejects.toThrow(/indispon/i);
    expect(m.setDoc).not.toHaveBeenCalled();
  });

  it('recusa quem não é cliente de um condomínio', async () => {
    app.iniciar({ uid: 'u2', nome: 'Gui', role: 'gerente', condominioId: 'c1' });
    await expect(
      app.criarAgendamento({ servicos: ['eco01'], data: '2030-05-10', hora: '09:00', veiculo: { modelo: '', placa: 'ABC1D23' } })
    ).rejects.toThrow(/condom/i);
  });
});

describe('fotos do checklist', () => {
  it('sobe o JPEG ao Storage e grava só o caminho no documento (nunca base64)', async () => {
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    await app.salvarFoto('ag1', 'antes', 'Lateral esquerda', jpeg);

    expect(m.uploadBytes).toHaveBeenCalledTimes(1);
    const chamada = (m.uploadBytes.mock.calls[0] as unknown) as [{ caminho: string }, Blob, { contentType: string }];
    expect(chamada[0].caminho).toBe('agendamentos/ag1/checklist/antes_lateral_esquerda.jpg');
    expect(chamada[2]).toEqual({ contentType: 'image/jpeg' });

    const up = m.escritas.find((e) => e.tipo === 'update')!;
    expect(up.ref.caminho).toBe('agendamentos/ag1');
    const valor = up.dados['checklist.fotos.antes_lateral_esquerda'];
    expect(valor.path).toBe('agendamentos/ag1/checklist/antes_lateral_esquerda.jpg');
    expect(JSON.stringify(up.dados)).not.toContain('data:image');
  });

  it('não grava no documento se o envio ao Storage falhar', async () => {
    m.uploadBytes.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'storage/unauthorized' }));
    await expect(app.salvarFoto('ag1', 'antes', 'Frente', new Blob(['x']))).rejects.toMatchObject({ code: 'storage/unauthorized' });
    expect(m.escritas.some((e) => e.tipo === 'update')).toBe(false);
  });
});

describe('avaliação e cancelamento', () => {
  it('avalia com nota inteira e carimbo do servidor', async () => {
    await app.avaliar('ag1', { nota: 4.6, nps: 9, comentario: 'x'.repeat(900) });
    const up = m.escritas.find((e) => e.tipo === 'update')!;
    expect(up.dados.avaliacao.nota).toBe(5);
    expect(up.dados.avaliacao.nps).toBe(9);
    expect(up.dados.avaliacao.comentario.length).toBe(500);
    expect(up.dados.avaliacao.em).toBe('SERVER_TS');
    expect(Object.keys(up.dados)).toEqual(['avaliacao', 'atualizadoEm']);
  });

  it('cancelar só muda o status', async () => {
    await app.cancelar('ag1');
    const up = m.escritas.find((e) => e.tipo === 'update')!;
    expect(up.dados).toEqual({ status: 'cancelado', atualizadoEm: 'SERVER_TS' });
  });
});

describe('chat', () => {
  it('cliente cria a conversa na primeira mensagem e soma o contador do gerente', async () => {
    m.getDoc.mockResolvedValue({ exists: () => false });
    await app.enviar('  olá  ');
    const conversa = m.escritas.find((e) => e.tipo === 'set' && e.ref.caminho === 'chats/u1')!;
    expect(conversa.dados).toEqual({ clienteId: 'u1', clienteNome: 'Ana', condominioId: 'c1' });
    expect(m.lote.set.mock.calls[0][1]).toMatchObject({ de: 'cliente', texto: 'olá', lida: false, criadoEm: 'SERVER_TS' });
    expect(m.lote.update.mock.calls[0][1]).toMatchObject({ ultimaMensagem: 'olá', naoLidasGerente: { incremento: 1 } });
    expect(m.lote.commit).toHaveBeenCalled();
  });

  it('mensagem vazia não escreve nada', async () => {
    await app.enviar('   ');
    expect(m.lote.commit).not.toHaveBeenCalled();
  });

  it('gerente responde na conversa aberta como "gerente"', async () => {
    app.iniciar({ uid: 'g1', nome: 'Gui', role: 'gerente', condominioId: 'c1' });
    app.abrirConversa('u1');
    await app.responder('Bom dia');
    expect(m.lote.set.mock.calls[0][1]).toMatchObject({ de: 'gerente', texto: 'Bom dia' });
    expect(m.lote.update.mock.calls[0][1]).toMatchObject({ naoLidasCliente: { incremento: 1 } });
  });

  it('gerente sem conversa aberta não envia', async () => {
    app.iniciar({ uid: 'g1', nome: 'Gui', role: 'gerente', condominioId: 'c1' });
    await app.responder('oi');
    expect(m.lote.commit).not.toHaveBeenCalled();
  });
});

describe('escutas por papel', () => {
  it('cada papel liga as escutas do Firestore e parar() as desliga', () => {
    const desliga = vi.fn();
    app.parar();
    m.onSnapshot.mockClear();
    m.onSnapshot.mockReturnValue(desliga);
    app.iniciar({ uid: 'f1', nome: 'Fê', role: 'funcionario', condominioId: null });
    expect(m.onSnapshot).toHaveBeenCalledTimes(1); // só os atendimentos dele
    app.parar();
    expect(desliga).toHaveBeenCalled();
  });

  it('insulfilm não escuta agendamentos (as regras negam)', () => {
    app.parar();
    m.onSnapshot.mockClear();
    app.iniciar({ uid: 'i1', nome: 'Ivo', role: 'insulfilm', condominioId: null });
    expect(m.onSnapshot).not.toHaveBeenCalled();
  });
});
