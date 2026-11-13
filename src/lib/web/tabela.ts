// Regras puras das tabelas do painel web: ordenar, paginar e filtrar (sem rede, sem Svelte).
import type { Agendamento } from '../agendamentos';

export type Coluna<R> = {
  id: string;
  titulo: string;
  texto: (r: R) => string;
  chave?: (r: R) => string | number | Date | null; // presente = coluna ordenável
  link?: (r: R) => string;
  selo?: (r: R) => 'ok' | 'aviso' | 'erro' | ''; // mostra como selo (ok/aviso/erro; vazio = neutro)
  alinhar?: "dir";
};

export type Direcao = 'asc' | 'desc';

export function ordenar<T>(itens: T[], chave: (t: T) => string | number | Date | null, dir: Direcao): T[] {
  const f = dir === 'asc' ? 1 : -1;
  const val = (t: T) => {
    const v = chave(t);
    return v instanceof Date ? v.getTime() : v;
  };
  return [...itens].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    if (x === y) return 0;
    if (x === null) return 1; // vazio sempre no fim
    if (y === null) return -1;
    if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y, 'pt-BR') * f;
    return (x < y ? -1 : 1) * f;
  });
}

export function paginar<T>(itens: T[], pagina: number, porPagina: number) {
  const paginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const atual = Math.min(Math.max(1, pagina), paginas);
  return { itens: itens.slice((atual - 1) * porPagina, atual * porPagina), pagina: atual, paginas, total: itens.length };
}

export type UsuarioLinha = { uid: string; nome: string; email: string; role: string; condominioId: string | null };
export type FiltroUsuarios = { busca: string; papel: string; condominio: string };

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtrarUsuarios(us: UsuarioLinha[], f: FiltroUsuarios): UsuarioLinha[] {
  const b = semAcento(f.busca.trim());
  return us.filter(
    (u) =>
      (!f.papel || u.role === f.papel) &&
      (!f.condominio || u.condominioId === f.condominio) &&
      (!b || semAcento(u.nome ?? '').includes(b) || semAcento(u.email ?? '').includes(b))
  );
}

export type FiltroAg = {
  de: string; // aaaa-mm-dd
  ate: string; // aaaa-mm-dd (inclusive)
  status: string;
  condominio: string;
  pagamento: '' | 'pago' | 'pendente' | 'revisao' | 'sem';
};

// Pagamento é filtrado aqui (no navegador): consultar por pagamento.status junto com período e
// status exigiria índices compostos novos. Os demais filtros vão na consulta (ver consultas.ts).
export function filtrarPorPagamento(ags: Agendamento[], p: FiltroAg['pagamento']): Agendamento[] {
  if (!p) return ags;
  return ags.filter((a) => {
    const s = a.pagamento?.status;
    if (p === 'sem') return !a.pagamento;
    if (p === 'pago') return s === 'pago';
    if (p === 'revisao') return s === 'pago_apos_cancelamento' || s === 'divergente';
    return s === 'pendente';
  });
}

// Limites do período [de, ate] em horário local, fim exclusivo; null se as datas forem inválidas
export function limitesPeriodo(de: string, ate: string): { inicio: Date; fim: Date } | null {
  const ok = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00').getTime());
  if (!ok(de) || !ok(ate) || de > ate) return null;
  const fim = new Date(ate + 'T00:00:00');
  fim.setDate(fim.getDate() + 1);
  return { inicio: new Date(de + 'T00:00:00'), fim };
}
