import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  aguardaConfirmacaoPagamento,
  caminhoFoto,
  chaveFoto,
  faltamFotos,
  fotosFeitas,
  idVaga,
  inicioDe,
  lerAgendamento,
  montarAgendamento,
  montarVaga,
  proximoStatus,
  situacaoPagamento,
  slugAngulo,
  totalCentavos,
  type Item,
  type NovoAgendamento
} from './agendamentos';

const ANGULOS = ['Frente', 'Traseira', 'Lateral esquerda', 'Lateral direita', 'Painel', 'Bancos', 'Porta-malas', 'Rodas'];

const itens: Item[] = [
  { servicoId: 'eco01', nome: 'Banho Básico', precoCentavos: 6500 },
  { servicoId: 'eco06', nome: 'Polimento', precoCentavos: 19999 }
];

const novo = (extra: Partial<NovoAgendamento> = {}): NovoAgendamento => ({
  clienteId: 'u1',
  clienteNome: 'Ana',
  condominioId: 'c1',
  itens,
  data: '2030-05-10',
  hora: '09:30',
  veiculo: { modelo: ' Gol ', placa: ' abc1d23 ' },
  externo: false,
  vagaId: 'c1_2030-05-10_09:30_1',
  ...extra
});

describe('montarAgendamento (documento aceito pelas regras)', () => {
  const doc = montarAgendamento(novo(), 'CARIMBO');

  it('guarda nome e preço dos itens no momento da contratação, em centavos inteiros', () => {
    expect(doc.itens).toEqual(itens);
    expect(doc.total).toBe(26499);
    expect(Number.isInteger(doc.total)).toBe(true);
  });

  it('nasce "agendado", sem funcionário, sem avaliação e sem fotos', () => {
    expect(doc.status).toBe('agendado');
    expect(doc.funcionarioId).toBeNull();
    expect(doc.funcionarioNome).toBeNull();
    expect(doc.avaliacao).toBeNull();
    expect(doc.checklist).toEqual({ fotos: {} });
  });

  it('usa o carimbo recebido (serverTimestamp) e converte o início em Timestamp', () => {
    expect(doc.criadoEm).toBe('CARIMBO');
    expect(doc.inicio).toBeInstanceOf(Timestamp);
    expect(doc.inicio.toDate().getHours()).toBe(9);
    expect(doc.inicio.toDate().getMinutes()).toBe(30);
  });

  it('normaliza o veículo (placa em maiúsculas, sem espaços)', () => {
    expect(doc.veiculo).toEqual({ modelo: 'Gol', placa: 'ABC1D23' });
  });

  it('só tem os campos permitidos pelas regras (nada de base64, desconto ou campo extra)', () => {
    expect(Object.keys(doc).sort()).toEqual(
      [
        'avaliacao', 'checklist', 'clienteId', 'clienteNome', 'condominioId', 'criadoEm', 'data',
        'externo', 'funcionarioId', 'funcionarioNome', 'hora', 'inicio', 'itens', 'observacoes',
        'status', 'total', 'vagaId', 'veiculo'
      ].sort()
    );
  });

  it('corta textos acima do limite das regras', () => {
    const d = montarAgendamento(novo({ clienteNome: 'x'.repeat(200), observacoes: 'y'.repeat(900) }), 1);
    expect(d.clienteNome.length).toBe(100);
    expect(d.observacoes.length).toBe(500);
  });

  it('ignora campos extras que venham nos itens', () => {
    const extra = [{ ...itens[0], desconto: 99 } as Item];
    expect(montarAgendamento(novo({ itens: extra }), 1).itens).toEqual([itens[0]]);
  });
});

describe('vagas de horário', () => {
  it('id regular: condomínio, data, hora e número', () => {
    expect(idVaga({ externo: false, condominioId: 'torre-10', data: '2030-05-10', hora: '09:30' }, 2)).toBe('torre-10_2030-05-10_09:30_2');
  });

  it('id externo: ext_ sem condomínio (a agenda do insulfilm é única)', () => {
    expect(idVaga({ externo: true, condominioId: 'torre-10', data: '2030-05-10', hora: '14:00' }, 1)).toBe('ext_2030-05-10_14:00_1');
  });

  it('o documento da vaga tem só os 5 campos e nenhum dado pessoal', () => {
    const v = montarVaga({ externo: false, condominioId: 'c1', data: '2030-05-10', hora: '09:30' }, 'ag9');
    expect(v).toEqual({ condominioId: 'c1', data: '2030-05-10', hora: '09:30', externo: false, agendamentoId: 'ag9' });
  });

  it('o agendamento carrega externo e o id da vaga que ocupa', () => {
    const d = montarAgendamento(novo({ externo: true, vagaId: 'ext_2030-05-10_14:00_1' }), 1);
    expect(d.externo).toBe(true);
    expect(d.vagaId).toBe('ext_2030-05-10_14:00_1');
  });
});

describe('totalCentavos', () => {
  it('soma sem erro de ponto flutuante', () => {
    expect(totalCentavos([{ servicoId: 'a', nome: 'a', precoCentavos: 1 }, { servicoId: 'b', nome: 'b', precoCentavos: 2 }])).toBe(3);
    expect(totalCentavos([])).toBe(0);
  });
});

describe('fotos do checklist', () => {
  it('slug e nome do arquivo seguem o padrão do storage.rules', () => {
    expect(slugAngulo('Lateral esquerda')).toBe('lateral_esquerda');
    expect(slugAngulo('Porta-malas')).toBe('porta_malas');
    for (const a of ANGULOS) {
      for (const fase of ['antes', 'depois'] as const) {
        expect(caminhoFoto('ag1', fase, a)).toMatch(/^agendamentos\/ag1\/checklist\/(antes|depois)_[a-z0-9_]+\.jpg$/);
      }
    }
  });

  it('chaves de ângulos diferentes não colidem', () => {
    const chaves = new Set(ANGULOS.map((a) => chaveFoto('antes', a)));
    expect(chaves.size).toBe(ANGULOS.length);
  });

  const comFotos = (fase: 'antes' | 'depois', n: number) => ({
    checklist: {
      fotos: Object.fromEntries(
        ANGULOS.slice(0, n).map((a) => [chaveFoto(fase, a), { path: caminhoFoto('ag1', fase, a), em: null }])
      )
    }
  });

  it('conta as fotos da fase', () => {
    expect(fotosFeitas(comFotos('antes', 3), 'antes', ANGULOS)).toBe(3);
    expect(fotosFeitas(comFotos('antes', 3), 'depois', ANGULOS)).toBe(0);
  });

  it('só avança com as 8 fotos da etapa', () => {
    expect(faltamFotos({ status: 'agendado', ...comFotos('antes', 5) }, ANGULOS)).toBe('Faltam fotos de "Como chegou" (5/8).');
    expect(faltamFotos({ status: 'agendado', ...comFotos('antes', 8) }, ANGULOS)).toBeNull();
    expect(faltamFotos({ status: 'em_andamento', ...comFotos('antes', 8) }, ANGULOS)).toBe('Faltam fotos de "Como saiu" (0/8).');
    expect(faltamFotos({ status: 'em_andamento', ...comFotos('depois', 8) }, ANGULOS)).toBeNull();
  });
});

describe('andamento', () => {
  it('agendado -> em_andamento -> finalizado; depois disso não avança', () => {
    expect(proximoStatus('agendado')).toBe('em_andamento');
    expect(proximoStatus('em_andamento')).toBe('finalizado');
    expect(proximoStatus('finalizado')).toBeNull();
    expect(proximoStatus('cancelado')).toBeNull();
  });
});

describe('lerAgendamento', () => {
  it('lê um documento completo do Firestore', () => {
    const inicio = Timestamp.fromDate(inicioDe('2030-05-10', '09:30'));
    const ag = lerAgendamento('ag1', {
      clienteId: 'u1',
      clienteNome: 'Ana',
      condominioId: 'c1',
      itens,
      total: 26499,
      data: '2030-05-10',
      hora: '09:30',
      inicio,
      status: 'finalizado',
      funcionarioId: 'f1',
      funcionarioNome: 'Fê',
      veiculo: { modelo: 'Gol', placa: 'ABC1D23' },
      checklist: { fotos: { antes_frente: { path: 'agendamentos/ag1/checklist/antes_frente.jpg', em: inicio } } },
      avaliacao: { nota: 5, nps: 10, comentario: 'Ótimo', em: inicio },
      criadoEm: inicio
    });
    expect(ag.id).toBe('ag1');
    expect(ag.total).toBe(26499);
    expect(ag.inicio).toBeInstanceOf(Date);
    expect(ag.checklist.fotos.antes_frente.path).toContain('antes_frente.jpg');
    expect(ag.avaliacao).toMatchObject({ nota: 5, nps: 10, comentario: 'Ótimo' });
  });

  it('tolera campos ausentes (documento antigo ou parcial)', () => {
    const ag = lerAgendamento('x', { data: '2030-01-01', hora: '08:00' });
    expect(ag.itens).toEqual([]);
    expect(ag.avaliacao).toBeNull();
    expect(ag.funcionarioId).toBeNull();
    expect(ag.checklist.fotos).toEqual({});
    expect(ag.veiculo).toEqual({ modelo: '', placa: '' });
    expect(ag.externo).toBe(false);
    expect(ag.vagaId).toBe('');
    expect(ag.status).toBe('agendado');
  });

  it('descarta foto sem caminho', () => {
    const ag = lerAgendamento('x', { checklist: { fotos: { antes_frente: {} } } });
    expect(ag.checklist.fotos).toEqual({});
  });
});

describe('pagamento', () => {
  const base = { status: 'agendado' as const };
  const agora = Date.parse('2030-01-01T12:00:00Z');
  const pag = (status: any, venceEm: Date | null = null) => ({ status, venceEm, revisao: false });

  it('lerAgendamento mapeia o pagamento do servidor (status, vencimento) e tolera a ausência', () => {
    const venceEm = Timestamp.fromDate(new Date(agora + 900_000));
    const ag = lerAgendamento('x', { pagamento: { status: 'pendente', checkoutId: 'chk', link: 'https://a.com', venceEm } });
    expect(ag.pagamento?.status).toBe('pendente');
    expect(ag.pagamento?.venceEm?.getTime()).toBe(agora + 900_000);
    expect(lerAgendamento('y', {}).pagamento).toBeNull();
  });

  it('o app não carrega checkoutId nem link do documento', () => {
    const ag = lerAgendamento('x', { pagamento: { status: 'pendente', checkoutId: 'chk', link: 'https://a.com' } });
    expect(Object.keys(ag.pagamento!).sort()).toEqual(['revisao', 'status', 'venceEm']);
  });

  it.each([
    [{ ...base, pagamento: null }, 'sem'],
    [{ status: 'cancelado' as const, pagamento: null }, 'nenhuma'],
    [{ ...base, pagamento: pag('pendente', new Date(agora + 60_000)) }, 'pendente'],
    [{ ...base, pagamento: pag('pendente', new Date(agora - 1)) }, 'vencido'],
    [{ ...base, pagamento: pag('pago') }, 'pago'],
    [{ ...base, pagamento: pag('pago_apos_cancelamento') }, 'revisao'],
    [{ ...base, pagamento: pag('divergente') }, 'revisao'],
    [{ status: 'cancelado' as const, pagamento: pag('expirado') }, 'expirado'],
    [{ status: 'cancelado' as const, pagamento: pag('cancelado') }, 'cancelado']
  ])('situacaoPagamento %#', (ag, esperado) => {
    expect(situacaoPagamento(ag as any, agora)).toBe(esperado);
  });
});

describe('aguardaConfirmacaoPagamento', () => {
  it.each([
    [{ status: 'agendado', pagamento: { status: 'pendente', venceEm: null, revisao: false } }, true],
    [{ status: 'agendado', pagamento: { status: 'pago', venceEm: null, revisao: false } }, false],
    [{ status: 'agendado', pagamento: null }, false],
    [{ status: 'cancelado', pagamento: { status: 'pendente', venceEm: null, revisao: false } }, false]
  ])('%#', (ag, esperado) => {
    expect(aguardaConfirmacaoPagamento(ag as any)).toBe(esperado);
  });
});
