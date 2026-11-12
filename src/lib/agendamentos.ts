// Regras puras de agendamento (sem Svelte e sem rede): montar o documento do Firestore,
// ler o documento de volta e conferir as fotos do checklist. As regras do Firestore repetem
// as mesmas conferências (preço, total, andamento) porque o cliente não é confiável.
import { Timestamp, type DocumentData } from 'firebase/firestore';

export type Status = 'agendado' | 'em_andamento' | 'finalizado' | 'cancelado';
export type Fase = 'antes' | 'depois';

// Andamento normal do atendimento (cancelado fica fora da sequência)
export const ordemStatus: Status[] = ['agendado', 'em_andamento', 'finalizado'];

export const rotuloStatus: Record<Status, string> = {
  agendado: 'Agendado',
  em_andamento: 'Em atendimento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado'
};

export const MAX_ITENS = 5;

// Estados do pagamento (gravados SÓ pelo servidor: API da Vercel e webhook do Asaas)
export type PagamentoStatus =
  | 'pendente'
  | 'pago'
  | 'expirado'
  | 'cancelado'
  | 'divergente'
  | 'pago_apos_cancelamento';

export type Pagamento = { status: PagamentoStatus; venceEm: Date | null; revisao: boolean; pagoEm?: Date | null };

// O que a tela mostra, já considerando o prazo (o webhook pode demorar alguns segundos a cancelar)
export type SituacaoPagamento = 'sem' | 'pendente' | 'vencido' | 'pago' | 'expirado' | 'cancelado' | 'revisao' | 'nenhuma';

export const rotuloPagamento: Record<SituacaoPagamento, string> = {
  sem: 'Pagamento pendente',
  pendente: 'Aguardando pagamento',
  vencido: 'Prazo vencido',
  pago: 'Pago',
  expirado: 'Prazo expirado',
  cancelado: 'Pagamento cancelado',
  revisao: 'Pagamento em análise',
  nenhuma: ''
};

export function situacaoPagamento(
  ag: Pick<Agendamento, 'status' | 'pagamento'>,
  agora: number = Date.now()
): SituacaoPagamento {
  const p = ag.pagamento;
  if (!p) return ag.status === 'agendado' ? 'sem' : 'nenhuma';
  switch (p.status) {
    case 'pago':
      return 'pago';
    case 'pago_apos_cancelamento':
    case 'divergente':
      return 'revisao';
    case 'expirado':
      return 'expirado';
    case 'cancelado':
      return 'cancelado';
    default:
      return p.venceEm && p.venceEm.getTime() <= agora ? 'vencido' : 'pendente';
  }
}

// Preço e nome copiados do catálogo no momento da contratação (preço em centavos inteiros)
export type Item = { servicoId: string; nome: string; precoCentavos: number };

export type FotoChecklist = { path: string; em: Date | null };

export type Avaliacao = { nota: number; nps?: number; comentario: string; em?: Date | null };

export type Veiculo = { modelo: string; placa: string };

export type Agendamento = {
  id: string;
  clienteId: string;
  clienteNome: string;
  condominioId: string;
  itens: Item[];
  total: number; // centavos
  data: string; // aaaa-mm-dd
  hora: string; // hh:mm
  inicio: Date;
  status: Status;
  funcionarioId: string | null;
  funcionarioNome: string | null;
  veiculo: Veiculo;
  observacoes: string;
  checklist: { fotos: Record<string, FotoChecklist> };
  avaliacao: Avaliacao | null;
  pagamento: Pagamento | null; // gravado só pelo servidor
  externo: boolean; // todos os itens são insulfilm (profissional externo); vem do catálogo
  vagaId: string; // vaga em /ocupacao que este agendamento ocupa
  criadoEm: Date | null;
  atualizadoEm?: Date | null;
};

export const brlCentavos = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const nomesItens = (itens: Item[]) => itens.map((i) => i.nome).join(' + ');

export const totalCentavos = (itens: Item[]) => itens.reduce((soma, i) => soma + i.precoCentavos, 0);

// "Lateral esquerda" vira "lateral_esquerda"
export const slugAngulo = (angulo: string) =>
  angulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// Chave do mapa checklist.fotos e nome do arquivo no Storage (padrão exigido pelo storage.rules)
export const chaveFoto = (fase: Fase, angulo: string) => `${fase}_${slugAngulo(angulo)}`;

export const caminhoFoto = (agendamentoId: string, fase: Fase, angulo: string) =>
  `agendamentos/${agendamentoId}/checklist/${chaveFoto(fase, angulo)}.jpg`;

export const fotosFeitas = (ag: Pick<Agendamento, 'checklist'>, fase: Fase, angulos: string[]) =>
  angulos.filter((a) => !!ag.checklist.fotos[chaveFoto(fase, a)]).length;

export const proximoStatus = (s: Status): Status | null => {
  const i = ordemStatus.indexOf(s);
  return i >= 0 && i < ordemStatus.length - 1 ? ordemStatus[i + 1] : null;
};

// Mensagem de erro se ainda faltam fotos para avançar; null se pode avançar
export function faltamFotos(ag: Pick<Agendamento, 'status' | 'checklist'>, angulos: string[]): string | null {
  if (ag.status === 'agendado') {
    const n = fotosFeitas(ag, 'antes', angulos);
    if (n < angulos.length) return `Faltam fotos de "Como chegou" (${n}/${angulos.length}).`;
  }
  if (ag.status === 'em_andamento') {
    const n = fotosFeitas(ag, 'depois', angulos);
    if (n < angulos.length) return `Faltam fotos de "Como saiu" (${n}/${angulos.length}).`;
  }
  return null;
}

// "2026-09-21" + "14:30" vira a data local
export function inicioDe(data: string, hora: string): Date {
  const [a, m, d] = data.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(a, m - 1, d, hh, mm, 0, 0);
}

// Vaga de horário: {condominioId}_{AAAA-MM-DD}_{HH:MM}_{n} (regular) ou ext_{AAAA-MM-DD}_{HH:MM}_{n} (externo)
export const idVaga = (
  v: { externo: boolean; condominioId: string; data: string; hora: string },
  n: number
) => (v.externo ? `ext_${v.data}_${v.hora}_${n}` : `${v.condominioId}_${v.data}_${v.hora}_${n}`);

// Documento da vaga (sem nome nem dado pessoal)
export const montarVaga = (
  v: { externo: boolean; condominioId: string; data: string; hora: string },
  agendamentoId: string
) => ({
  condominioId: v.condominioId,
  data: v.data,
  hora: v.hora,
  externo: v.externo,
  agendamentoId
});

export type NovoAgendamento = {
  clienteId: string;
  clienteNome: string;
  condominioId: string;
  itens: Item[];
  data: string;
  hora: string;
  veiculo: Veiculo;
  observacoes?: string;
  externo: boolean;
  vagaId: string;
};

// Documento exatamente no formato que o firestore.rules aceita no create.
// `carimbo` é o serverTimestamp() (ou um valor fixo nos testes).
export function montarAgendamento(n: NovoAgendamento, carimbo: unknown): DocumentData {
  return {
    clienteId: n.clienteId,
    clienteNome: n.clienteNome.slice(0, 100),
    condominioId: n.condominioId,
    itens: n.itens.map((i) => ({ servicoId: i.servicoId, nome: i.nome, precoCentavos: i.precoCentavos })),
    total: totalCentavos(n.itens),
    data: n.data,
    hora: n.hora,
    inicio: Timestamp.fromDate(inicioDe(n.data, n.hora)),
    status: 'agendado',
    funcionarioId: null,
    funcionarioNome: null,
    veiculo: {
      modelo: n.veiculo.modelo.trim().slice(0, 60),
      placa: n.veiculo.placa.trim().toUpperCase().slice(0, 10)
    },
    observacoes: (n.observacoes ?? '').slice(0, 500),
    checklist: { fotos: {} },
    avaliacao: null,
    externo: n.externo,
    vagaId: n.vagaId,
    criadoEm: carimbo
  };
}

const paraData = (v: unknown): Date | null =>
  v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : null;

// Documento do Firestore para o objeto usado nas telas (tolera campos ausentes)
export function lerAgendamento(id: string, d: DocumentData): Agendamento {
  const fotos: Record<string, FotoChecklist> = {};
  for (const [k, v] of Object.entries(d.checklist?.fotos ?? {})) {
    const f = v as { path?: string; em?: unknown };
    if (f?.path) fotos[k] = { path: f.path, em: paraData(f.em) };
  }
  const av = d.avaliacao;
  return {
    id,
    clienteId: d.clienteId ?? '',
    clienteNome: d.clienteNome ?? '',
    condominioId: d.condominioId ?? '',
    itens: Array.isArray(d.itens) ? d.itens : [],
    total: typeof d.total === 'number' ? d.total : 0,
    data: d.data ?? '',
    hora: d.hora ?? '',
    inicio: paraData(d.inicio) ?? inicioDe(d.data ?? '1970-01-01', d.hora ?? '00:00'),
    status: d.status ?? 'agendado',
    funcionarioId: d.funcionarioId ?? null,
    funcionarioNome: d.funcionarioNome ?? null,
    veiculo: { modelo: d.veiculo?.modelo ?? '', placa: d.veiculo?.placa ?? '' },
    observacoes: d.observacoes ?? '',
    checklist: { fotos },
    avaliacao: av ? { nota: av.nota, nps: av.nps, comentario: av.comentario ?? '', em: paraData(av.em) } : null,
    externo: d.externo === true,
    pagamento: d.pagamento?.status
      ? {
          status: d.pagamento.status,
          venceEm: paraData(d.pagamento.venceEm),
          revisao: d.pagamento.revisao === true,
          pagoEm: paraData(d.pagamento.pagoEm)
        }
      : null,
    vagaId: d.vagaId ?? '',
    criadoEm: paraData(d.criadoEm),
    atualizadoEm: paraData(d.atualizadoEm)
  };
}

// Vale consultar o Asaas? Só enquanto o app ainda mostra "pendente" (rede de segurança do webhook)
export const aguardaConfirmacaoPagamento = (ag: Pick<Agendamento, 'status' | 'pagamento'>) =>
  ag.status === 'agendado' && ag.pagamento?.status === 'pendente';
