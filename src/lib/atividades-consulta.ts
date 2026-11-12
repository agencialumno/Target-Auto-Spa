// Tela /admin/atividades: filtros, rótulos e leitura dos documentos (puro, sem rede).
export const POR_PAGINA = 50;

export const rotuloAcao: Record<string, string> = {
  login_admin: 'Login de administrador',
  usuario_criado: 'Usuário criado',
  usuario_removido: 'Usuário removido',
  condominio_vinculado: 'Condomínio vinculado',
  papel_alterado: 'Papel alterado',
  preco_alterado: 'Preço alterado',
  status_agendamento: 'Status do agendamento',
  pagamento_confirmado: 'Pagamento confirmado',
  pagamento_divergente: 'Pagamento divergente',
  pagamento_expirado: 'Pagamento expirado',
  pagamento_cancelado: 'Pagamento cancelado',
  custo_criado: 'Custo criado',
  custo_alterado: 'Custo alterado',
  custo_removido: 'Custo removido'
};

export type FiltrosBrutos = { atorUid: string; acao: string; alvoId: string; de: string; ate: string };
export type Filtros = { atorUid?: string; acao?: string; alvoId?: string; de?: Date; ate?: Date };

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Ignora o que não é válido (um filtro quebrado vira "sem filtro", nunca uma consulta quebrada).
// A data final é inclusiva: vai até 23:59:59.999 do dia.
export function normalizarFiltros(b: FiltrosBrutos): Filtros {
  const f: Filtros = {};
  const uid = b.atorUid.trim();
  if (ID_RE.test(uid)) f.atorUid = uid;
  if (b.acao in rotuloAcao) f.acao = b.acao;
  const alvo = b.alvoId.trim();
  if (ID_RE.test(alvo)) f.alvoId = alvo;
  if (DATA_RE.test(b.de)) f.de = new Date(`${b.de}T00:00:00`);
  if (DATA_RE.test(b.ate)) f.ate = new Date(`${b.ate}T23:59:59.999`);
  if (f.de && Number.isNaN(f.de.getTime())) delete f.de;
  if (f.ate && Number.isNaN(f.ate.getTime())) delete f.ate;
  return f;
}

export type Atividade = {
  id: string;
  em: Date | null;
  atorUid: string;
  atorPapel: string;
  acao: string;
  alvoTipo: string;
  alvoId: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  origem: string;
};

const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const mapa = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

export function lerAtividade(id: string, d: Record<string, any>): Atividade {
  return {
    id,
    em: typeof d.em?.toDate === 'function' ? d.em.toDate() : null,
    atorUid: texto(d.atorUid),
    atorPapel: texto(d.atorPapel),
    acao: texto(d.acao),
    alvoTipo: texto(d.alvoTipo),
    alvoId: texto(d.alvoId),
    antes: mapa(d.antes),
    depois: mapa(d.depois),
    origem: texto(d.origem)
  };
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// "status: agendado → em_andamento" / "preço: R$ 65,00 → R$ 70,00"
export function descreverMudanca(a: Pick<Atividade, 'antes' | 'depois'>): string {
  const chaves = [...new Set([...Object.keys(a.antes ?? {}), ...Object.keys(a.depois ?? {})])];
  return chaves
    .map((c) => {
      const fmt = (v: unknown) =>
        v === undefined || v === null ? '—' : /Centavos$/.test(c) && typeof v === 'number' ? brl(v) : String(v);
      const nome = c === 'categoria' ? 'categoria' : c === 'precoCentavos' ? 'preço' : c === 'valorCentavos' ? 'valor' : c === 'condominioId' ? 'condomínio' : c;
      return `${nome}: ${fmt(a.antes?.[c])} → ${fmt(a.depois?.[c])}`;
    })
    .join(' · ');
}
