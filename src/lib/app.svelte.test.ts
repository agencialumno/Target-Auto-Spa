import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firestore e Storage são mocks: aqui se confere O QUE o app grava (o firestore.rules confere se é aceito)
const m = vi.hoisted(() => {
  const escritas: { tipo: string; ref: any; dados?: any }[] = [];
  return {
    escritas,
    setDoc: vi.fn(async (ref: any, dados: any) => void escritas.push({ tipo: 'set', ref, dados })),
    updateDoc: vi.fn(async (ref: any, dados: any) => void escritas.push({ tipo: 'update', ref, dados })),
    getDoc: vi.fn(),
    lote: { set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => {}) },
    onSnapshot: vi.fn(() => () => {}),
    uploadBytes: vi.fn(async () => ({})),
    getDownloadURL: vi.fn(async () => 'https://exemplo/foto.jpg'),
    openUrl: vi.fn(async () => {}),
    chamarApi: vi.fn()
  };
});

vi.mock('./firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: m.openUrl }));
vi.mock('./api', () => ({ chamarApi: m.chamarApi }));
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
    { id: 'eco02', data: { precoCentavos: 9000, nome: 'Banho', ativo: false } },
    { id: 'eco24', data: { precoCentavos: 35000, nome: 'Insulfilm Poliéster com Garantia (Traseira e Laterais)', ativo: true } }
  ]);
  app.iniciar(cliente);
});

describe('criarAgendamento', () => {
  const base = { data: '2030-05-10', hora: '09:00', veiculo: { modelo: 'Gol', placa: 'abc1d23' } };

  it('agendamento e vaga vão no MESMO batch, com nome e preço do serviço no momento da contratação', async () => {
    const id = await app.criarAgendamento({ ...base, servicos: ['eco01'] });
    expect(m.lote.commit).toHaveBeenCalledTimes(1);
    const [refAg, dadosAg] = m.lote.set.mock.calls[0] as any[];
    const [refVaga, dadosVaga] = m.lote.set.mock.calls[1] as any[];
    expect(refAg.id).toBe(id);
    expect(dadosAg).toMatchObject({
      clienteId: 'u1',
      clienteNome: 'Ana',
      condominioId: 'c1',
      itens: [{ servicoId: 'eco01', nome: 'Banho Básico', precoCentavos: 6500 }],
      total: 6500,
      status: 'agendado',
      externo: false,
      vagaId: 'c1_2030-05-10_09:00_1',
      veiculo: { modelo: 'Gol', placa: 'ABC1D23' },
      criadoEm: 'SERVER_TS'
    });
    expect(refVaga.caminho).toBe('ocupacao/c1_2030-05-10_09:00_1');
    expect(dadosVaga).toEqual({ condominioId: 'c1', data: '2030-05-10', hora: '09:00', externo: false, agendamentoId: id });
  });

  it('serviço de insulfilm vira externo e usa a vaga ext_', async () => {
    await app.criarAgendamento({ ...base, servicos: ['eco24'] });
    const [, dadosAg] = m.lote.set.mock.calls[0] as any[];
    expect(dadosAg).toMatchObject({ externo: true, vagaId: 'ext_2030-05-10_09:00_1' });
    expect((m.lote.set.mock.calls[1] as any[])[0].caminho).toBe('ocupacao/ext_2030-05-10_09:00_1');
  });

  it('insulfilm misturado com outro serviço é recusado, sem escrever nada', async () => {
    await expect(app.criarAgendamento({ ...base, servicos: ['eco01', 'eco24'] })).rejects.toThrow(/separado/i);
    expect(m.lote.commit).not.toHaveBeenCalled();
  });

  it('vaga 1 ocupada: tenta a 2 (capacidade 2) e confirma', async () => {
    app.capacidade = 2;
    m.lote.commit.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' }));
    m.getDoc.mockResolvedValueOnce({ exists: () => true }); // a vaga 1 existe: alguém pegou
    await app.criarAgendamento({ ...base, servicos: ['eco01'] });
    expect(m.lote.commit).toHaveBeenCalledTimes(2);
    const vagas = m.lote.set.mock.calls.filter((c: any[]) => c[0].caminho?.startsWith('ocupacao/')).map((c: any[]) => c[0].caminho);
    expect(vagas).toEqual(['ocupacao/c1_2030-05-10_09:00_1', 'ocupacao/c1_2030-05-10_09:00_2']);
  });

  it('todas as vagas ocupadas: "Horário indisponível"', async () => {
    app.capacidade = 2;
    m.lote.commit.mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    m.getDoc.mockResolvedValue({ exists: () => true });
    await expect(app.criarAgendamento({ ...base, servicos: ['eco01'] })).rejects.toThrow(/Horário indisponível/);
    expect(m.lote.commit).toHaveBeenCalledTimes(2);
    m.lote.commit.mockResolvedValue(undefined);
  });

  it('erro que não é vaga ocupada (ex.: preço mudou) é repassado, sem tentar outra vaga', async () => {
    app.capacidade = 3;
    m.lote.commit.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' }));
    // getDoc da vaga: não existe
    await expect(app.criarAgendamento({ ...base, servicos: ['eco01'] })).rejects.toMatchObject({ code: 'permission-denied' });
    expect(m.lote.commit).toHaveBeenCalledTimes(1);
  });

  it('recusa serviço desativado ou fora do catálogo, sem escrever nada', async () => {
    await expect(app.criarAgendamento({ ...base, servicos: ['eco02'] })).rejects.toThrow(/indispon/i);
    await expect(app.criarAgendamento({ ...base, servicos: ['eco03'] })).rejects.toThrow(/indispon/i);
    expect(m.lote.commit).not.toHaveBeenCalled();
  });

  it('recusa quem não é cliente de um condomínio', async () => {
    app.iniciar({ uid: 'u2', nome: 'Gui', role: 'gerente', condominioId: 'c1' });
    await expect(app.criarAgendamento({ ...base, servicos: ['eco01'] })).rejects.toThrow(/condom/i);
  });
});

describe('horários cheios', () => {
  it('esconde o horário quando todas as vagas (capacidade) já existem', () => {
    app.capacidade = 2;
    app.vagasRegulares = [{ id: 'a', data: '2030-05-10', hora: '09:00', externo: false }];
    expect(app.horarioCheio('2030-05-10', '09:00', false)).toBe(false);
    app.vagasRegulares = [
      { id: 'a', data: '2030-05-10', hora: '09:00', externo: false },
      { id: 'b', data: '2030-05-10', hora: '09:00', externo: false }
    ];
    expect(app.horarioCheio('2030-05-10', '09:00', false)).toBe(true);
    expect(app.horarioCheio('2030-05-10', '09:30', false)).toBe(false);
    expect(app.horarioCheio('2030-05-11', '09:00', false)).toBe(false);
  });

  it('insulfilm usa as vagas e a capacidade externas, independentes do condomínio', () => {
    app.capacidade = 5;
    app.capacidadeExterna = 1;
    app.vagasExternas = [{ id: 'e', data: '2030-05-10', hora: '14:00', externo: true }];
    expect(app.horarioCheio('2030-05-10', '14:00', true)).toBe(true);
    expect(app.horarioCheio('2030-05-10', '14:00', false)).toBe(false);
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

  it('cancelar muda só o status e apaga a vaga no mesmo batch', async () => {
    app.agendamentos = [{ id: 'ag1', vagaId: 'c1_2030-05-10_09:00_1' } as any];
    await app.cancelar('ag1');
    expect(m.lote.update.mock.calls[0][1]).toEqual({ status: 'cancelado', atualizadoEm: 'SERVER_TS' });
    expect((m.lote.delete.mock.calls[0] as any[])[0].caminho).toBe('ocupacao/c1_2030-05-10_09:00_1');
    expect(m.lote.commit).toHaveBeenCalledTimes(1);
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

  it('cliente escuta: agendamentos, condomínio, vagas do condomínio, vagas externas, config, chat e mensagens', () => {
    app.parar();
    m.onSnapshot.mockClear();
    app.iniciar(cliente);
    expect(m.onSnapshot).toHaveBeenCalledTimes(7); // + as mensagens da conversa
  });

  it('papel antigo "insulfilm" não escuta nada (a conta precisa ser migrada)', () => {
    app.parar();
    m.onSnapshot.mockClear();
    app.iniciar({ uid: 'i1', nome: 'Ivo', role: 'insulfilm', condominioId: null });
    expect(m.onSnapshot).not.toHaveBeenCalled();
  });

  it('externos só podem ser atribuídos a funcionário com especialidade insulfilm', () => {
    app.funcionarios = [
      { uid: 'f1', nome: 'Fê', especialidade: null },
      { uid: 'f2', nome: 'Ivo', especialidade: 'insulfilm' }
    ];
    expect(app.funcionariosPara({ externo: true } as any).map((f) => f.uid)).toEqual(['f2']);
    expect(app.funcionariosPara({ externo: false } as any).map((f) => f.uid)).toEqual(['f1', 'f2']);
  });
});

describe('pagamento (Asaas)', () => {
  const link = 'https://sandbox.asaas.com/000/checkoutSession/show/chk-1';

  it('pagar chama a API do servidor só com o id do agendamento e abre o link no navegador do sistema', async () => {
    m.chamarApi.mockResolvedValue({ link, venceEm: '2030-01-01T12:15:00.000Z' });
    await app.pagar('ag1');
    expect(m.chamarApi).toHaveBeenCalledWith('criar', { agendamentoId: 'ag1' }, 'pagamento');
    expect(m.openUrl).toHaveBeenCalledWith(link);
  });

  it('link que não é https nunca é aberto', async () => {
    for (const ruim of ['http://asaas.com/x', 'javascript:alert(1)', 'tauri://localhost/x', '']) {
      m.chamarApi.mockResolvedValue({ link: ruim, venceEm: '' });
      await expect(app.pagar('ag1')).rejects.toThrow(/inválido/i);
    }
    expect(m.openUrl).not.toHaveBeenCalled();
  });

  it('erro do servidor aparece para a tela e nada é aberto', async () => {
    m.chamarApi.mockRejectedValue(new Error('Este agendamento já foi pago.'));
    await expect(app.pagar('ag1')).rejects.toThrow(/já foi pago/);
    expect(m.openUrl).not.toHaveBeenCalled();
  });

  it('prepararPagamento inicia o prazo sem abrir nada e engole falhas', async () => {
    m.chamarApi.mockResolvedValue({ link, venceEm: '' });
    await app.prepararPagamento('ag1');
    expect(m.chamarApi).toHaveBeenCalledTimes(1);
    expect(m.openUrl).not.toHaveBeenCalled();
    m.chamarApi.mockRejectedValue(new Error('sem rede'));
    await expect(app.prepararPagamento('ag1')).resolves.toBeUndefined();
  });
});
