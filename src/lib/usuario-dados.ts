// Leituras da tela de um usuário no admin (as regras já deixam o admin ler tudo isto).
// Índices usados, todos já existentes: agendamentos (clienteId, inicio desc) e (funcionarioId, inicio).
import { collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, startAfter, where, type DocumentSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { lerAgendamento, type Agendamento } from './agendamentos';

export const POR_PAGINA = 25;

export type PerfilAdmin = { nome: string; email: string; role: string; condominioId: string | null; especialidade: string | null };

export async function carregarPerfil(uid: string): Promise<PerfilAdmin | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    nome: String(d.nome ?? ''),
    email: String(d.email ?? ''),
    role: String(d.role ?? ''),
    condominioId: typeof d.condominioId === 'string' ? d.condominioId : null,
    especialidade: typeof d.especialidade === 'string' ? d.especialidade : null
  };
}

export async function nomeDoCondominio(id: string | null): Promise<string> {
  if (!id) return '';
  const snap = await getDoc(doc(db, 'condominios', id));
  return snap.exists() ? String(snap.data().nome ?? id) : id;
}

export const campoDoPapel = (role: string): 'clienteId' | 'funcionarioId' | null =>
  role === 'cliente' ? 'clienteId' : role === 'funcionario' ? 'funcionarioId' : null;

// Uma página (mais recentes primeiro). Sem teto: quem pede a próxima página passa o cursor.
export async function carregarPagina(campo: 'clienteId' | 'funcionarioId', uid: string, cursor: DocumentSnapshot | null) {
  const r = [where(campo, '==', uid), orderBy('inicio', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(POR_PAGINA)];
  const snap = await getDocs(query(collection(db, 'agendamentos'), ...r));
  return {
    itens: snap.docs.map((d) => lerAgendamento(d.id, d.data())) as Agendamento[],
    cursor: snap.docs[snap.docs.length - 1] ?? null,
    temMais: snap.docs.length === POR_PAGINA
  };
}

// Total de agendamentos do usuário (agregação: barata, não abre documentos)
export async function contarAgendamentos(campo: 'clienteId' | 'funcionarioId', uid: string): Promise<number> {
  const r = await getCountFromServer(query(collection(db, 'agendamentos'), where(campo, '==', uid)));
  return r.data().count;
}

export async function carregarAgendamento(id: string): Promise<Agendamento | null> {
  const snap = await getDoc(doc(db, 'agendamentos', id));
  return snap.exists() ? lerAgendamento(snap.id, snap.data()) : null;
}
