// Dashboard do admin: contas puras (sem rede). Leitura barata: contagens e somas vêm do servidor
// (count()/sum()); o que precisa abrir documentos (ranking, desempenho) só roda sob demanda e com teto.
import type { Agendamento, Status } from './agendamentos';

export const TETO_DETALHE = 500; // documentos lidos no "carregar detalhes"

// Período em meses (aaaa-mm, inclusivo) -> intervalo [inicio, fim) em datas locais
export function limitesDoPeriodo(de: string, ate: string): { inicio: Date; fim: Date } | null {
  const ok = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!ok.test(de) || !ok.test(ate) || ate < de) return null;
  const [a, m] = ate.split('-').map(Number);
  return { inicio: new Date(`${de}-01T00:00:00`), fim: new Date(a, m, 1, 0, 0, 0, 0) };
}

export type Rentabilidade = { faturamentoCentavos: number; custosCentavos: number; resultadoCentavos: number; margemPct: number | null };

// Rentabilidade = receita (só pagamentos confirmados) menos custos do período
export function rentabilidade(faturamentoCentavos: number, custosCentavos: number): Rentabilidade {
  const resultado = faturamentoCentavos - custosCentavos;
  return {
    faturamentoCentavos,
    custosCentavos,
    resultadoCentavos: resultado,
    margemPct: faturamentoCentavos > 0 ? Math.round((resultado / faturamentoCentavos) * 1000) / 10 : null
  };
}

export const ticketMedio = (faturamentoCentavos: number, pagos: number) => (pagos > 0 ? Math.round(faturamentoCentavos / pagos) : 0);

// "Visão em tempo real": cartões do topo, calculados sobre o que o app já escuta (sem leitura extra)
export type TempoReal = { hoje: number; emAtendimento: number; aguardandoPagamento: number; proximo: Agendamento | null };

export function cartoesTempoReal(ags: Agendamento[], agora = new Date()): TempoReal {
  const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hoje = dia(agora);
  const deHoje = ags.filter((a) => a.data === hoje && a.status !== 'cancelado');
  const futuros = ags.filter((a) => a.status === 'agendado' && a.inicio.getTime() >= agora.getTime()).sort((x, y) => x.inicio.getTime() - y.inicio.getTime());
  return {
    hoje: deHoje.length,
    emAtendimento: ags.filter((a) => a.status === 'em_andamento').length,
    aguardandoPagamento: ags.filter((a) => a.status === 'agendado' && a.pagamento?.status === 'pendente').length,
    proximo: futuros[0] ?? null
  };
}

export type Detalhe = {
  lidos: number;
  truncado: boolean;
  servicos: { nome: string; vezes: number }[]; // serviços executados (finalizados), mais usados primeiro
  funcionarios: { id: string; nome: string; finalizados: number; notaMedia: number | null }[];
  notaMedia: number | null;
};

// Sobre os agendamentos do período já lidos (no máximo TETO_DETALHE)
export function detalharPeriodo(ags: Agendamento[]): Detalhe {
  const usos = new Map<string, number>();
  const porFunc = new Map<string, { nome: string; finalizados: number; notas: number[] }>();
  const todas: number[] = [];
  for (const a of ags) {
    if (a.status === 'finalizado') {
      for (const i of a.itens) usos.set(i.nome, (usos.get(i.nome) ?? 0) + 1);
      if (a.funcionarioId) {
        const f = porFunc.get(a.funcionarioId) ?? { nome: a.funcionarioNome ?? 'Sem nome', finalizados: 0, notas: [] };
        f.finalizados++;
        if (a.avaliacao) f.notas.push(a.avaliacao.nota);
        porFunc.set(a.funcionarioId, f);
      }
    }
    if (a.avaliacao) todas.push(a.avaliacao.nota);
  }
  const media = (n: number[]) => (n.length ? Math.round((n.reduce((s, x) => s + x, 0) / n.length) * 10) / 10 : null);
  return {
    lidos: ags.length,
    truncado: ags.length >= TETO_DETALHE,
    servicos: [...usos.entries()].map(([nome, vezes]) => ({ nome, vezes })).sort((x, y) => y.vezes - x.vezes || x.nome.localeCompare(y.nome, 'pt-BR')).slice(0, 10),
    funcionarios: [...porFunc.entries()]
      .map(([id, f]) => ({ id, nome: f.nome, finalizados: f.finalizados, notaMedia: media(f.notas) }))
      .sort((x, y) => y.finalizados - x.finalizados || x.nome.localeCompare(y.nome, 'pt-BR')),
    notaMedia: media(todas)
  };
}

export const STATUS_ORDEM: Status[] = ['agendado', 'em_andamento', 'finalizado', 'cancelado'];

// ---- Página inicial do admin: períodos rápidos, variação e filtros dos detalhes ----
export type Preset = 'hoje' | '7d' | 'mes';
export const PRESETS: { id: Preset; rotulo: string }[] = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: '7d', rotulo: '7 dias' },
  { id: 'mes', rotulo: 'Mês' }
];
export const rotuloPreset: Record<Preset, string> = { hoje: 'hoje', '7d': 'nos últimos 7 dias', mes: 'neste mês' };

const mesDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Período atual [inicio, fim) e o período imediatamente anterior, de mesmo tamanho (para a variação)
export function periodoPreset(p: Preset, agora = new Date()) {
  const a = agora.getFullYear();
  const m = agora.getMonth();
  const d = agora.getDate();
  let inicio: Date, fim: Date, anteriorInicio: Date;
  if (p === 'hoje') {
    inicio = new Date(a, m, d);
    fim = new Date(a, m, d + 1);
    anteriorInicio = new Date(a, m, d - 1);
  } else if (p === '7d') {
    inicio = new Date(a, m, d - 6);
    fim = new Date(a, m, d + 1);
    anteriorInicio = new Date(a, m, d - 13);
  } else {
    inicio = new Date(a, m, 1);
    fim = new Date(a, m + 1, 1);
    anteriorInicio = new Date(a, m - 1, 1);
  }
  return { inicio, fim, anteriorInicio, anteriorFim: inicio, de: mesDe(inicio), ate: mesDe(new Date(fim.getTime() - 1)) };
}

// Variação percentual inteira; sem base de comparação (anterior = 0) não há variação
export const variacaoPct = (atual: number, anterior: number): number | null =>
  anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : null;

export type FiltroAgendamentos = { status?: Status; pagamento?: 'pendente' | 'pago'; periodo?: Preset };

// Lê o filtro da URL; valor desconhecido é ignorado (nunca quebra a lista)
export function lerFiltro(q: URLSearchParams): FiltroAgendamentos {
  const f: FiltroAgendamentos = {};
  const s = q.get('status');
  if (s && (STATUS_ORDEM as string[]).includes(s)) f.status = s as Status;
  const pg = q.get('pagamento');
  if (pg === 'pendente' || pg === 'pago') f.pagamento = pg;
  const pe = q.get('periodo');
  if (pe === 'hoje' || pe === '7d' || pe === 'mes') f.periodo = pe;
  return f;
}

export function filtrarAgendamentos(ags: Agendamento[], f: FiltroAgendamentos, agora = new Date()): Agendamento[] {
  const per = f.periodo ? periodoPreset(f.periodo, agora) : null;
  return ags.filter((a) => {
    if (f.status && a.status !== f.status) return false;
    if (f.pagamento === 'pendente' && !(a.status === 'agendado' && a.pagamento?.status === 'pendente')) return false;
    if (f.pagamento === 'pago' && a.pagamento?.status !== 'pago') return false;
    if (per && !(a.inicio >= per.inicio && a.inicio < per.fim)) return false;
    return true;
  });
}

export const temFiltro = (f: FiltroAgendamentos) => Boolean(f.status || f.pagamento || f.periodo);
