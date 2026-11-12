// Custos operacionais (só admin). Regras puras: validar, montar o documento e somar por período.
// Data de competência = mês a que o custo pertence (string aaaa-mm-01), não a data em que foi pago.
import type { DocumentData } from 'firebase/firestore';

export const CATEGORIAS = [
  { id: 'pessoal', nome: 'Pessoal' },
  { id: 'produtos', nome: 'Produtos e insumos' },
  { id: 'equipamento', nome: 'Equipamentos' },
  { id: 'aluguel', nome: 'Aluguel e condomínio' },
  { id: 'impostos', nome: 'Impostos e taxas' },
  { id: 'marketing', nome: 'Marketing' },
  { id: 'outros', nome: 'Outros' }
] as const;

export type CategoriaCusto = (typeof CATEGORIAS)[number]['id'];
export const nomeCategoria = (id: string) => CATEGORIAS.find((c) => c.id === id)?.nome ?? id;

export const VALOR_MAXIMO_CENTAVOS = 100_000_000; // R$ 1.000.000,00

export type Custo = {
  id: string;
  categoria: CategoriaCusto;
  descricao: string;
  valorCentavos: number;
  competencia: string; // aaaa-mm-01
  tipo: 'avulso' | 'recorrente';
  fim: string | null; // aaaa-mm-01 (recorrente; null = sem fim)
  escopo: string; // 'geral' ou id do condomínio
  criadoPor: string;
};

export type EntradaCusto = {
  categoria: string;
  descricao: string;
  valor: string; // "1.234,56"
  competencia: string; // aaaa-mm (campo month)
  tipo: 'avulso' | 'recorrente';
  fim: string; // aaaa-mm ou ''
  escopo: string;
};

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// "1.234,56" ou "1234.56" -> centavos inteiros; null se inválido
export function paraCentavos(valor: string): number | null {
  const limpo = valor.trim().replace(/^R\$\s*/, '');
  if (!limpo) return null;
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null;
  const [reais, cent = ''] = normal.split('.');
  return Number(reais) * 100 + Number(cent.padEnd(2, '0'));
}

export type ProblemaCusto = { campo: keyof EntradaCusto; mensagem: string };

export function validarCusto(e: EntradaCusto): ProblemaCusto | null {
  if (!CATEGORIAS.some((c) => c.id === e.categoria)) return { campo: 'categoria', mensagem: 'Escolha a categoria.' };
  const desc = e.descricao.trim();
  if (!desc) return { campo: 'descricao', mensagem: 'Informe a descrição.' };
  if (desc.length > 120) return { campo: 'descricao', mensagem: 'A descrição pode ter no máximo 120 caracteres.' };
  const c = paraCentavos(e.valor);
  if (c === null || c <= 0) return { campo: 'valor', mensagem: 'Informe um valor maior que zero (ex.: 1.250,00).' };
  if (c > VALOR_MAXIMO_CENTAVOS) return { campo: 'valor', mensagem: 'O valor é alto demais.' };
  if (!MES_RE.test(e.competencia)) return { campo: 'competencia', mensagem: 'Informe o mês de competência.' };
  if (e.tipo === 'recorrente' && e.fim) {
    if (!MES_RE.test(e.fim)) return { campo: 'fim', mensagem: 'Mês final inválido.' };
    if (e.fim < e.competencia) return { campo: 'fim', mensagem: 'O mês final não pode ser antes do início.' };
  }
  if (!e.escopo.trim()) return { campo: 'escopo', mensagem: 'Escolha geral ou um condomínio.' };
  return null;
}

// Documento do Firestore (sem criadoPor/criadoEm/atualizadoEm: quem grava acrescenta)
export function montarCusto(e: EntradaCusto) {
  const centavos = paraCentavos(e.valor)!;
  return {
    categoria: e.categoria,
    descricao: e.descricao.trim(),
    valorCentavos: centavos,
    competencia: `${e.competencia}-01`,
    tipo: e.tipo,
    ...(e.tipo === 'recorrente' ? { recorrencia: 'mensal', fim: e.fim ? `${e.fim}-01` : null } : {}),
    escopo: e.escopo.trim()
  };
}

export function lerCusto(id: string, d: DocumentData): Custo {
  return {
    id,
    categoria: d.categoria,
    descricao: String(d.descricao ?? ''),
    valorCentavos: Number.isInteger(d.valorCentavos) ? d.valorCentavos : 0,
    competencia: String(d.competencia ?? ''),
    tipo: d.tipo === 'recorrente' ? 'recorrente' : 'avulso',
    fim: typeof d.fim === 'string' ? d.fim : null,
    escopo: String(d.escopo ?? 'geral'),
    criadoPor: String(d.criadoPor ?? '')
  };
}

// Meses (aaaa-mm) de um período inclusivo
export function mesesDoPeriodo(de: string, ate: string): string[] {
  if (!MES_RE.test(de) || !MES_RE.test(ate) || ate < de) return [];
  const saida: string[] = [];
  let [a, m] = de.split('-').map(Number);
  const [fa, fm] = ate.split('-').map(Number);
  while (a < fa || (a === fa && m <= fm)) {
    saida.push(`${a}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) (m = 1), a++;
    if (saida.length > 600) break;
  }
  return saida;
}

// Quantas vezes o custo cai dentro do período: avulso 1 vez (se a competência está nele);
// recorrente uma vez por mês, do início até o fim (ou sem fim), recortado pelo período
export function ocorrenciasNoPeriodo(c: Pick<Custo, 'tipo' | 'competencia' | 'fim'>, de: string, ate: string): number {
  const mes = (s: string) => s.slice(0, 7);
  const ini = mes(c.competencia);
  if (c.tipo === 'avulso') return ini >= de && ini <= ate ? 1 : 0;
  const fim = c.fim ? mes(c.fim) : ate;
  return mesesDoPeriodo(ini > de ? ini : de, fim < ate ? fim : ate).length;
}

export type ResumoCustos = { totalCentavos: number; porCategoria: Record<string, number> };

// Soma dos custos do período; `escopo` filtra um condomínio (mais os gerais) ou todos se omitido
export function somarCustos(custos: Custo[], de: string, ate: string, escopo?: string): ResumoCustos {
  const porCategoria: Record<string, number> = {};
  let total = 0;
  for (const c of custos) {
    if (escopo && c.escopo !== 'geral' && c.escopo !== escopo) continue;
    const n = ocorrenciasNoPeriodo(c, de, ate);
    if (!n) continue;
    const v = n * c.valorCentavos;
    total += v;
    porCategoria[c.categoria] = (porCategoria[c.categoria] ?? 0) + v;
  }
  return { totalCentavos: total, porCategoria };
}
