// Relatórios do painel web, calculados no navegador. DUAS bases, sempre avisadas na tela:
//  - pagamento: agendamentos pagos, pela data do PAGAMENTO (pagamento.pagoEm) - a mesma do dashboard;
//  - agendamento: todos os agendamentos do período, pela data do AGENDAMENTO (inicio).
import type { Agendamento, Status } from '../agendamentos';
import { rotuloStatus } from '../agendamentos';
import { nomeCategoria, somarCustos, type Custo } from '../custos';
import { STATUS_ORDEM } from '../dashboard';

export type Linha = { rotulo: string; quantidade: number; centavos: number };

const pago = (a: Agendamento) => a.pagamento?.status === 'pago';

const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Total de faturamento: soma de `total` dos pagos (igual ao sum('total') do dashboard)
export const totalFaturamento = (pagos: Agendamento[]) => pagos.reduce((s, a) => s + (pago(a) ? a.total : 0), 0);

function somar(mapa: Map<string, Linha>, rotulo: string, centavos: number) {
  const l = mapa.get(rotulo) ?? { rotulo, quantidade: 0, centavos: 0 };
  l.quantidade += 1;
  l.centavos += centavos;
  mapa.set(rotulo, l);
}

// Faturamento por dia do PAGAMENTO (recebe só os pagos do período, por pagoEm)
export function faturamentoPorDia(pagos: Agendamento[]): Linha[] {
  const m = new Map<string, Linha>();
  for (const a of pagos) if (pago(a) && a.pagamento?.pagoEm) somar(m, dia(a.pagamento.pagoEm), a.total);
  return [...m.values()].sort((x, y) => x.rotulo.localeCompare(y.rotulo));
}

// Por serviço: valor dos itens (preço gravado no agendamento) dos agendamentos pagos
export function faturamentoPorServico(pagos: Agendamento[]): Linha[] {
  const m = new Map<string, Linha>();
  for (const a of pagos) if (pago(a)) for (const i of a.itens) somar(m, i.nome, i.precoCentavos);
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

// Atendimentos, finalizados e nota: por data do AGENDAMENTO (`ags`). Faturamento: por data do PAGAMENTO (`pagos`).
export function desempenhoPorFuncionario(ags: Agendamento[], pagos: Agendamento[] = []): LinhaFuncionario[] {
  const m = new Map<string, { nome: string; atendimentos: number; finalizados: number; centavos: number; notas: number[] }>();
  for (const a of ags) {
    if (!a.funcionarioId || a.status === 'cancelado') continue;
    const f = m.get(a.funcionarioId) ?? { nome: a.funcionarioNome || a.funcionarioId, atendimentos: 0, finalizados: 0, centavos: 0, notas: [] };
    f.atendimentos += 1;
    if (a.status === 'finalizado') f.finalizados += 1;
    if (a.avaliacao) f.notas.push(a.avaliacao.nota);
    m.set(a.funcionarioId, f);
  }
  const fat = new Map<string, number>();
  for (const a of pagos) if (pago(a) && a.funcionarioId) fat.set(a.funcionarioId, (fat.get(a.funcionarioId) ?? 0) + a.total);
  for (const [id, v] of fat) {
    const f = m.get(id);
    if (f) f.centavos = v;
    else m.set(id, { nome: pagos.find((a) => a.funcionarioId === id)?.funcionarioNome || id, atendimentos: 0, finalizados: 0, centavos: v, notas: [] });
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
