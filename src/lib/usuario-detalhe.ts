// Tela de um usuário no admin: contas puras sobre agendamentos já lidos (sem rede).
import type { Agendamento, Status } from './agendamentos';
import { getServico } from './catalogo.svelte';

export type FiltroAgendamentos = 'todos' | 'abertos' | 'concluidos' | 'cancelados';

export const rotuloFiltro: Record<FiltroAgendamentos, string> = {
  todos: 'Todos',
  abertos: 'Em aberto',
  concluidos: 'Concluídos',
  cancelados: 'Cancelados'
};

const aberto = (s: Status) => s === 'agendado' || s === 'em_andamento';

export function filtrarAgendamentos(ags: Agendamento[], f: FiltroAgendamentos): Agendamento[] {
  if (f === 'abertos') return ags.filter((a) => aberto(a.status));
  if (f === 'concluidos') return ags.filter((a) => a.status === 'finalizado');
  if (f === 'cancelados') return ags.filter((a) => a.status === 'cancelado');
  return ags;
}

// "Todos": os em aberto vão para o topo (mantendo a ordem mais recente primeiro dentro de cada grupo)
export function emAbertoPrimeiro(ags: Agendamento[]): Agendamento[] {
  return [...ags.filter((a) => aberto(a.status)), ...ags.filter((a) => !aberto(a.status))];
}

export type LinhaPagamento = { agendamentoId: string; valorCentavos: number; status: string; pagoEm: Date | null; servicos: string };

// Pagamentos = agendamentos que têm cobrança (o valor é o total do agendamento)
export function pagamentosDe(ags: Agendamento[]): LinhaPagamento[] {
  return ags
    .filter((a) => a.pagamento)
    .map((a) => ({
      agendamentoId: a.id,
      valorCentavos: a.total,
      status: a.pagamento!.status,
      pagoEm: a.pagamento!.pagoEm ?? null,
      servicos: a.itens.map((i) => i.nome).join(' + ')
    }));
}

export type LinhaAvaliacao = { agendamentoId: string; nota: number; nps: number | null; comentario: string; servicos: string; em: Date | null };

export function avaliacoesDe(ags: Agendamento[]): LinhaAvaliacao[] {
  return ags
    .filter((a) => a.avaliacao)
    .map((a) => ({
      agendamentoId: a.id,
      nota: a.avaliacao!.nota,
      nps: typeof a.avaliacao!.nps === 'number' ? a.avaliacao!.nps : null,
      comentario: a.avaliacao!.comentario,
      servicos: a.itens.map((i) => i.nome).join(' + '),
      em: a.avaliacao!.em ?? null
    }));
}

// Duração hoje no catálogo (o agendamento não guarda a duração); null se algum serviço saiu do catálogo
export function duracaoDoCatalogo(ag: Pick<Agendamento, 'itens'>): number | null {
  let total = 0;
  for (const i of ag.itens) {
    const s = getServico(i.servicoId);
    if (!s || typeof s.duracao !== 'number') return null;
    total += s.duracao;
  }
  return total;
}

export type Marco = { em: Date; texto: string };

// O app não guarda um histórico completo de status: a linha do tempo usa só as datas que o agendamento registra
export function linhaDoTempo(ag: Agendamento): Marco[] {
  const m: Marco[] = [];
  if (ag.criadoEm) m.push({ em: ag.criadoEm, texto: 'Agendamento criado' });
  if (ag.pagamento?.pagoEm) m.push({ em: ag.pagamento.pagoEm, texto: 'Pagamento confirmado' });
  const fotos = Object.entries(ag.checklist.fotos).filter(([, f]) => f.em);
  const primeira = (fase: string, ordem: 1 | -1) =>
    fotos
      .filter(([k]) => k.startsWith(fase + '_'))
      .map(([, f]) => f.em!)
      .sort((a, b) => ordem * (a.getTime() - b.getTime()))[0];
  const antes = primeira('antes', 1);
  const depois = primeira('depois', -1);
  if (antes) m.push({ em: antes, texto: 'Primeira foto do antes (atendimento começou)' });
  if (depois) m.push({ em: depois, texto: 'Última foto do depois' });
  if (ag.avaliacao?.em) m.push({ em: ag.avaliacao.em, texto: 'Avaliado pelo cliente' });
  if (ag.atualizadoEm) m.push({ em: ag.atualizadoEm, texto: 'Última atualização do agendamento' });
  return m.sort((a, b) => a.em.getTime() - b.em.getTime());
}
