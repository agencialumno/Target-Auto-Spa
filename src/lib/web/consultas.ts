// Consultas do painel web (só leitura). Nada aqui escreve no Firestore.
// Índices: ver WEB-ADMIN.md. Sem índice composto novo: filtros extras são feitos no navegador.
import { Timestamp, collection, getDocs, limit, orderBy, query, where, type QueryConstraint } from 'firebase/firestore';
import { db } from '../firebase';
import { lerAgendamento, type Agendamento } from '../agendamentos';
import { limitesPeriodo, type FiltroAg, type UsuarioLinha } from './tabela';

export const TETO_AGENDAMENTOS = 2000;
export const TETO_USUARIOS = 2000;
export const TETO_CONVERSAS = 200;
export const TETO_MENSAGENS = 500;

// Mensagem visível com o código do Firestore (nunca erro mudo)
export function descreverErro(e: unknown, oQue: string): string {
  const codigo = (e as { code?: string })?.code ?? 'desconhecido';
  const extra =
    codigo === 'failed-precondition'
      ? ' Falta um índice do Firestore; o link para criá-lo aparece no console do navegador.'
      : codigo === 'permission-denied'
        ? ' Sem permissão: confira se esta conta é admin.'
        : '';
  return `Não foi possível carregar ${oQue} (${codigo}).${extra}`;
}

export async function listarUsuarios(): Promise<{ itens: UsuarioLinha[]; cortado: boolean }> {
  const snap = await getDocs(query(collection(db, 'users'), limit(TETO_USUARIOS)));
  return {
    itens: snap.docs.map((d) => {
      const x = d.data();
      return {
        uid: d.id,
        nome: String(x.nome ?? ''),
        email: String(x.email ?? ''),
        role: String(x.role ?? ''),
        condominioId: typeof x.condominioId === 'string' ? x.condominioId : null
      };
    }),
    cortado: snap.size >= TETO_USUARIOS
  };
}

export async function listarCondominios(): Promise<{ id: string; nome: string }[]> {
  const snap = await getDocs(collection(db, 'condominios'));
  return snap.docs.map((d) => ({ id: d.id, nome: String(d.data().nome ?? d.id) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// Restrições da consulta de agendamentos. Índices usados (todos existem em firestore.indexes.json):
//   só período               -> campo único `inicio` (automático)
//   período + status         -> (status, inicio desc)
//   período + condomínio     -> (condominioId, inicio desc)
//   período + status + cond. -> (condominioId, status, inicio desc)
export function restricoesAgendamentos(f: Pick<FiltroAg, 'de' | 'ate' | 'status' | 'condominio'>): QueryConstraint[] | null {
  const lim = limitesPeriodo(f.de, f.ate);
  if (!lim) return null;
  return [
    ...(f.condominio ? [where('condominioId', '==', f.condominio)] : []),
    ...(f.status ? [where('status', '==', f.status)] : []),
    where('inicio', '>=', Timestamp.fromDate(lim.inicio)),
    where('inicio', '<', Timestamp.fromDate(lim.fim)),
    orderBy('inicio', 'desc'),
    limit(TETO_AGENDAMENTOS)
  ];
}

export async function listarAgendamentos(
  f: Pick<FiltroAg, 'de' | 'ate' | 'status' | 'condominio'>
): Promise<{ itens: Agendamento[]; cortado: boolean }> {
  const r = restricoesAgendamentos(f);
  if (!r) throw Object.assign(new Error('Período inválido'), { code: 'periodo-invalido' });
  const snap = await getDocs(query(collection(db, 'agendamentos'), ...r));
  return { itens: snap.docs.map((d) => lerAgendamento(d.id, d.data())), cortado: snap.size >= TETO_AGENDAMENTOS };
}

// Pagos do período pela data do PAGAMENTO, igual ao faturamento() do dashboard.
// Índice EXISTENTE (pagamento.status, pagamento.pagoEm, total): o orderBy('total') no fim faz a consulta de
// documentos casar com ele (o dashboard usa o mesmo índice com sum('total')).
export async function listarPagos(de: string, ate: string): Promise<{ itens: Agendamento[]; cortado: boolean }> {
  const lim = limitesPeriodo(de, ate);
  if (!lim) throw Object.assign(new Error('Período inválido'), { code: 'periodo-invalido' });
  const snap = await getDocs(
    query(
      collection(db, 'agendamentos'),
      where('pagamento.status', '==', 'pago'),
      where('pagamento.pagoEm', '>=', Timestamp.fromDate(lim.inicio)),
      where('pagamento.pagoEm', '<', Timestamp.fromDate(lim.fim)),
      orderBy('pagamento.pagoEm', 'asc'),
      orderBy('total', 'asc'),
      limit(TETO_AGENDAMENTOS)
    )
  );
  return { itens: snap.docs.map((d) => lerAgendamento(d.id, d.data())), cortado: snap.size >= TETO_AGENDAMENTOS };
}

export type ConversaLinha = { id: string; clienteNome: string; condominioId: string; ultimaMensagem: string; ultimaHora: Date | null };
export type MensagemLinha = { id: string; de: string; texto: string; criadoEm: Date | null };

const dataDe = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);

// Admin lê TODAS as conversas (regra chats: souAdmin). Índice: campo único `ultimaHora` (automático).
export async function listarConversas(): Promise<ConversaLinha[]> {
  const snap = await getDocs(query(collection(db, 'chats'), orderBy('ultimaHora', 'desc'), limit(TETO_CONVERSAS)));
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      clienteNome: String(x.clienteNome ?? ''),
      condominioId: String(x.condominioId ?? ''),
      ultimaMensagem: String(x.ultimaMensagem ?? ''),
      ultimaHora: dataDe(x.ultimaHora)
    };
  });
}

// Só leitura: getDocs, sem marcar como lida. Índice: campo único `criadoEm` (automático).
export async function listarMensagens(chatId: string): Promise<MensagemLinha[]> {
  const snap = await getDocs(query(collection(db, 'chats', chatId, 'mensagens'), orderBy('criadoEm', 'asc'), limit(TETO_MENSAGENS)));
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, de: String(x.de ?? ''), texto: String(x.texto ?? ''), criadoEm: dataDe(x.criadoEm) };
  });
}
