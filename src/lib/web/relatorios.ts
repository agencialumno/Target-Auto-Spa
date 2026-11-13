// Relatórios do painel web: tudo calculado no navegador sobre UMA consulta de agendamentos do período
// (por data do agendamento, índice automático de campo único). Sem índice novo.
import type { Agendamento, Status } from '../agendamentos';
import { rotuloStatus } from '../agendamentos';
import { nomeCategoria, somarCustos, type Custo } from '../custos';
import { STATUS_ORDEM } from '../dashboard';

export type Linha = { rotulo: string; quantidade: number; centavos: number };

const pago = (a: Agendamento) => a.pagamento?.status === 'pago';

function somar(mapa: Map<string, Linha>, rotulo: string, centavos: number) {
  const l = mapa.get(rotulo) ?? { rotulo, quantidade: 0, centavos: 0 };
  l.quantidade += 1;
  l.centavos += centavos;
  mapa.set(rotulo, l);
}

// Faturamento = só agendamentos com pagamento "pago", agrupado por dia do agendamento
export function faturamentoPorDia(ags: Agendamento[]): Linha[] {
  const m = new Map<string, Linha>();
  for (const a of ags) if (pago(a)) somar(m, a.data, a.total);
  return [...m.values()].sort((x, y) => x.rotulo.localeCompare(y.rotulo));
}

// Por serviço: valor dos itens (preço gravado no agendamento) dos agendamentos pagos
export function faturamentoPorServico(ags: Agendamento[]): Linha[] {
  const m = new Map<string, Linha>();
  for (const a of ags) if (pago(a)) for (const i of a.itens) somar(m, i.nome, i.precoCentavos);
  return [...m.values()].sort((x, y) => y.centavos - x.centavos);
}

export function agendamentosPorStatus(ags: Agendamento[]): Linha[] {
  const m = new Map<Status, Linha>();
  for (const s of STATUS_ORDEM) m.set(s, { rotulo: rotuloStatus[s], quantidade: 0, centavos: 0 });
  for (const a of ags) {
    const l = m.get(a.status);
    if (l) {
      l.quantidade += 1;
      l.centavos += a.total;
    }
  }
  return [...m.values()];
}

export type LinhaFuncionario = { nome: string; atendimentos: number; finalizados: number; centavos: number; notaMedia: number | null };

export function desempenhoPorFuncionario(ags: Agendamento[]): LinhaFuncionario[] {
  const m = new Map<string, { nome: string; atendimentos: number; finalizados: number; centavos: number; notas: number[] }>();
  for (const a of ags) {
    if (!a.funcionarioId || a.status === 'cancelado') continue;
    const f = m.get(a.funcionarioId) ?? { nome: a.funcionarioNome || a.funcionarioId, atendimentos: 0, finalizados: 0, centavos: 0, notas: [] };
    f.atendimentos += 1;
    if (a.status === 'finalizado') f.finalizados += 1;
    if (pago(a)) f.centavos += a.total;
    if (a.avaliacao) f.notas.push(a.avaliacao.nota);
    m.set(a.funcionarioId, f);
  }
  return [...m.values()]
    .map((f) => ({
      nome: f.nome,
      atendimentos: f.atendimentos,
      finalizados: f.finalizados,
      centavos: f.centavos,
      notaMedia: f.notas.length ? Math.round((f.notas.reduce((s, n) => s + n, 0) / f.notas.length) * 10) / 10 : null
    }))
    .sort((x, y) => y.centavos - x.centavos);
}

// Custos por categoria no período (meses aaaa-mm, do mês inicial ao final, inclusive)
export function custosPorCategoria(custos: Custo[], de: string, ate: string): Linha[] {
  const r = somarCustos(custos, de.slice(0, 7), ate.slice(0, 7));
  return Object.entries(r.porCategoria)
    .map(([id, centavos]) => ({ rotulo: nomeCategoria(id), quantidade: 0, centavos }))
    .sort((x, y) => y.centavos - x.centavos);
}
