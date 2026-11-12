// Resumo de um usuário para a tela do admin. Funções puras sobre agendamentos já lidos
// (o admin já lê todos os agendamentos pelas regras; nada além disso é exposto).
import type { Agendamento, Status } from './agendamentos';
import { gastoJanela, nivelAtual } from './niveis';

export type ResumoCliente = {
  porStatus: Record<Status, number>;
  total: number;
  pagoCentavos: number; // só pagamentos confirmados (pagamento.status === 'pago')
  maisUsados: { nome: string; vezes: number }[];
  avaliacoes: { quantidade: number; media: number | null };
  nivel: string; // mesma regra que o cliente vê: finalizados nos últimos 90 dias
};

export type ResumoFuncionario = { finalizados: number; emAndamento: number };

const vazio = (): Record<Status, number> => ({ agendado: 0, em_andamento: 0, finalizado: 0, cancelado: 0 });

export function resumoCliente(ags: Agendamento[], agora = new Date()): ResumoCliente {
  const porStatus = vazio();
  const usos = new Map<string, number>();
  let pagoCentavos = 0;
  const notas: number[] = [];

  for (const a of ags) {
    porStatus[a.status]++;
    if (a.pagamento?.status === 'pago') pagoCentavos += a.total;
    if (a.status !== 'cancelado') for (const i of a.itens) usos.set(i.nome, (usos.get(i.nome) ?? 0) + 1);
    if (a.avaliacao) notas.push(a.avaliacao.nota);
  }

  const compras = ags.filter((a) => a.status === 'finalizado').map((a) => ({ data: a.data, valor: a.total / 100 }));
  return {
    porStatus,
    total: ags.length,
    pagoCentavos,
    maisUsados: [...usos.entries()]
      .map(([nome, vezes]) => ({ nome, vezes }))
      .sort((x, y) => y.vezes - x.vezes || x.nome.localeCompare(y.nome, 'pt-BR'))
      .slice(0, 5),
    avaliacoes: {
      quantidade: notas.length,
      media: notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : null
    },
    nivel: nivelAtual(gastoJanela(compras, agora)).nome
  };
}

export function resumoFuncionario(ags: Agendamento[]): ResumoFuncionario {
  return {
    finalizados: ags.filter((a) => a.status === 'finalizado').length,
    emAndamento: ags.filter((a) => a.status === 'em_andamento').length
  };
}
