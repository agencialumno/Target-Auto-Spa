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

describe('criarAgendamento (pela API do servidor)', () => {
  const base = { data: '2030-05-10', hora: '09:00', veiculo: { modelo: 'Gol', placa: 'ABC1D23' } };

  it('chama POST /api/agendamentos/criar com os ids, nunca com preço ou total; não escreve nada no Firestore', async () => {
    m.chamarApi.mockResolvedValue({ id: 'ag-novo' });
    const id = await app.criarAgendamento({ ...base, servicos: ['eco01'], chave: 'chave-12345678' });
    expect(id).toBe('ag-novo');
    expect(m.chamarApi).toHaveBeenCalledTimes(1);
    const [caminho, corpo, grupo] = m.chamarApi.mock.calls[0] as any[];
    expect([caminho, grupo]).toEqual(['criar', 'agendamentos']);
    expect(corpo).toEqual({ servicos: ['eco01'], data: '2030-05-10', hora: '09:00', veiculo: base.veiculo, observacoes: '', chave: 'chave-12345678' });
    expect(JSON.stringify(corpo)).not.toMatch(/preco|total|condominio|clienteId/i);
    expect(m.lote.commit).not.toHaveBeenCalled();
    expect(m.lote.set).not.toHaveBeenCalled();
  });

  it('sem vaga: o erro do servidor chega em português, sem plano B pelo Firestore', async () => {
    m.chamarApi.mockRejectedValue(new Error('Horário indisponível: não há vaga às 09:30. Escolha outro horário.'));
    await expect(app.criarAgendamento({ ...base, servicos: ['eco01'] })).rejects.toThrow(/Horário indisponível/);
    expect(m.lote.commit).not.toHaveBeenCalled();
    expect(m.setDoc).not.toHaveBeenCalled();
  });

  it('falha de rede também não cai no caminho antigo (poderia duplicar a reserva)', async () => {
    m.chamarApi.mockRejectedValue(new Error('Sem conexão com o servidor. Verifique a internet.'));
    await expect(app.criarAgendamento({ ...base, servicos: ['eco01'], chave: 'chave-12345678' })).rejects.toThrow(/Sem conexão/);
    expect(m.lote.commit).not.toHaveBeenCalled();
  });

  it('insulfilm misturado com outro serviço é recusado antes de chamar o servidor', async () => {
    await expect(app.criarAgendamento({ ...base, servicos: ['eco01', 'eco24'] })).rejects.toThrow(/separado/i);
    expect(m.chamarApi).not.toHaveBeenCalled();
  });

  it('recusa serviço desativado ou fora do catálogo, sem chamar o servidor', async () => {
    await expect(app.criarAgendamento({ ...base, servicos: ['eco02'] })).rejects.toThrow(/indispon/i);
    await expect(app.criarAgendamento({ ...base, servicos: ['eco03'] })).rejects.toThrow(/indispon/i);
    expect(m.chamarApi).not.toHaveBeenCalled();
  });

  it('recusa quem não é cliente de um condomínio', async () => {
    app.iniciar({ uid: 'u2', nome: 'Gui', role: 'gerente', condominioId: 'c1' });
    await expect(app.criarAgendamento({ ...base, servicos: ['eco01'] })).rejects.toThrow(/condom/i);
    expect(m.chamarApi).not.toHaveBeenCalled();
  });
});

describe('grade de horários pela duração', () => {
  const cheio = (hora: string, data = '2030-05-10') => ({ id: `${data}${hora}`, data, hora, externo: false });

  it('serviço de 90 min às 09:00 precisa de 09:00, 09:30 e 10:00 livres', () => {
    app.capacidade = 1;
    app.vagasRegulares = [cheio('10:00')];
    expect(app.horarioLivre('2030-05-10', '09:00', 90, false)).toBe(false); // o 10:00 está ocupado
    expect(app.horarioLivre('2030-05-10', '09:00', 60, false)).toBe(true); // 60 min só precisa de 09:00 e 09:30
    expect(app.horarioLivre('2030-05-10', '08:30', 90, false)).toBe(true); // 08:30, 09:00 e 09:30: o 10:00 não é necessário
  });

  it('um horário no meio do serviço bloqueia só os inícios que o atravessam', () => {
    app.capacidade = 1;
    app.vagasRegulares = [cheio('09:30')];
    expect(app.horarioLivre('2030-05-10', '09:00', 60, false)).toBe(false);
    expect(app.horarioLivre('2030-05-10', '09:00', 30, false)).toBe(true);
    expect(app.horarioLivre('2030-05-10', '10:00', 90, false)).toBe(true);
    expect(app.horarioLivre('2030-05-10', '08:30', 60, false)).toBe(true); // 08:30 e 09:00
    expect(app.horarioLivre('2030-05-10', '08:30', 90, false)).toBe(false); // precisa também do 09:30
    expect(app.horarioLivre('2030-05-10', '08:00', 60, false)).toBe(true);
  });

  it('capacidade 2: só fica indisponível quando as duas vagas do horário existem', () => {
    app.capacidade = 2;
    app.vagasRegulares = [cheio('09:30'), cheio('09:30')];
    expect(app.horarioLivre('2030-05-10', '09:00', 60, false)).toBe(false);
    app.vagasRegulares = [cheio('09:30')];
    expect(app.horarioLivre('2030-05-10', '09:00', 60, false)).toBe(true);
  });

  it('outro dia não interfere; insulfilm usa as vagas externas', () => {
    app.capacidade = 1;
    app.vagasRegulares = [cheio('09:30', '2030-05-11')];
    expect(app.horarioLivre('2030-05-10', '09:00', 60, false)).toBe(true);
    app.capacidadeExterna = 1;
    app.vagasExternas = [{ id: 'x', data: '2030-05-10', hora: '10:00', externo: true }];
    expect(app.horarioLivre('2030-05-10', '09:00', 90, true)).toBe(false);
    expect(app.horarioLivre('2030-05-10', '09:00', 90, false)).toBe(true);
  });
});

describe('cancelar libera todas as vagas da reserva', () => {
  it('reserva nova (vagasIds) apaga todas; reserva antiga (só vagaId) apaga a única', async () => {
    const ag = (id: string, extra: object) => ({ id, vagaId: 'v1', vagasIds: ['v1'], status: 'agendado', ...extra }) as any;
    app.agendamentos = [ag('novo', { vagaId: 'v1', vagasIds: ['v1', 'v2', 'v3'] }), ag('antigo', { vagaId: 'a1', vagasIds: ['a1'] })];
    await app.cancelar('novo');
    expect(m.lote.delete.mock.calls.map((c: any[]) => c[0].caminho)).toEqual(['ocupacao/v1', 'ocupacao/v2', 'ocupacao/v3']);
    m.lote.delete.mockClear();
    await app.cancelar('antigo');
    expect(m.lote.delete.mock.calls.map((c: any[]) => c[0].caminho)).toEqual(['ocupacao/a1']);
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

describe('chat do gerente: estados e leitura', () => {
  const gerente = { uid: 'g1', nome: 'Gui', role: 'gerente', condominioId: 'c1' };
  type Ouvinte = [{ caminho?: string }, (s: any) => void, (e: unknown) => void];
  const daLista = () => (m.onSnapshot.mock.calls as unknown as Ouvinte[]).filter((c) => c[0]?.caminho === 'chats').at(-1)!;

  it('carregando -> pronto com as conversas; erro mostra o código; tentar de novo religa a escuta', () => {
    app.parar();
    m.onSnapshot.mockClear();
    app.iniciar(gerente);
    expect(app.conversasEstado).toBe('carregando');
    daLista()[1]({ docs: [{ id: 'u1', data: () => ({ clienteNome: 'Ana', condominioId: 'c1', ultimaMensagem: 'oi', naoLidasGerente: 2 }) }] });
    expect(app.conversasEstado).toBe('pronto');
    expect(app.conversas).toHaveLength(1);
    expect(app.msgNaoLidasGerente).toBe(2);

    daLista()[2]({ code: 'permission-denied' });
    expect(app.conversasEstado).toBe('erro');
    expect(app.conversasErro).toBe('permission-denied');

    const antes = m.onSnapshot.mock.calls.length;
    app.ouvirConversas();
    expect(m.onSnapshot.mock.calls.length).toBe(antes + 1);
    expect(app.conversasEstado).toBe('carregando');
  });

  it('mensagens: erro com código e reabrirConversa volta a carregar', () => {
    app.parar();
    m.onSnapshot.mockClear();
    app.iniciar(gerente);
    app.abrirConversa('u1');
    const msgs = (m.onSnapshot.mock.calls as unknown as Ouvinte[]).at(-1)!;
    msgs[2]({ code: 'unavailable' });
    expect(app.mensagensEstado).toBe('erro');
    expect(app.mensagensErro).toBe('unavailable');
    app.reabrirConversa();
    expect(app.conversaAtiva).toBe('u1');
    expect(app.mensagensEstado).toBe('carregando');
  });

  it('abrir a conversa marca as do cliente como lidas e zera só o contador do gerente (compatível com as regras)', async () => {
    app.parar();
    app.iniciar(gerente);
    app.abrirConversa('u1');
    const msgs = (m.onSnapshot.mock.calls as unknown as Ouvinte[]).at(-1)!;
    msgs[1]({
      docs: [
        { id: 'm1', data: () => ({ de: 'cliente', texto: 'oi', hora: '09:00', lida: false, criadoEm: null }) },
        { id: 'm2', data: () => ({ de: 'gerente', texto: 'olá', hora: '09:01', lida: false, criadoEm: null }) }
      ],
      docChanges: () => []
    });
    m.lote.update.mockClear();
    await app.lerMensagens('gerente');
    const alvos = m.lote.update.mock.calls.map((c: any[]) => [c[0].caminho, c[1]]);
    expect(alvos).toContainEqual(['chats/u1/mensagens/m1', { lida: true }]);
    expect(alvos).toContainEqual(['chats/u1', { naoLidasGerente: 0 }]);
    expect(alvos.some(([c]) => c === 'chats/u1/mensagens/m2')).toBe(false);
  });
});
