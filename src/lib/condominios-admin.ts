import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { acharDuplicado, idDoCondominio, normalizarNome, validarNome } from './condominio';

// Operações do admin sobre /condominios (as regras do Firestore só deixam o admin escrever aqui).
// Os dados de cada condomínio são `nome` e `nomeNormalizado` (a busca da tela "entrar no condomínio").

export type Condominio = {
  id: string;
  nome: string;
  nomeNormalizado: string;
  moradores: number;
  gerentes: { uid: string; nome: string }[];
  agendamentos: number;
};

const MENSAGENS_NOME = {
  vazio: 'Informe o nome do condomínio.',
  longo: 'O nome pode ter no máximo 100 caracteres.',
  invalido: 'O nome precisa ter letras ou números.'
} as const;

const limpar = (nome: string) => nome.trim().replace(/\s+/g, ' ');

async function contar(colecao: string, condominioId: string): Promise<number> {
  const r = await getCountFromServer(query(collection(db, colecao), where('condominioId', '==', condominioId)));
  return r.data().count;
}

export async function listarCondominios(): Promise<Condominio[]> {
  const [condos, usuarios] = await Promise.all([
    getDocs(collection(db, 'condominios')),
    getDocs(collection(db, 'users'))
  ]);
  const gente = usuarios.docs.map((d) => ({ uid: d.id, ...(d.data() as any) }));

  const lista = await Promise.all(
    condos.docs.map(async (d) => {
      const dados = d.data() as { nome?: string; nomeNormalizado?: string };
      const nome = dados.nome ?? d.id;
      return {
        id: d.id,
        nome,
        nomeNormalizado: dados.nomeNormalizado ?? normalizarNome(nome),
        moradores: gente.filter((u) => u.role === 'cliente' && u.condominioId === d.id).length,
        gerentes: gente
          .filter((u) => u.role === 'gerente' && u.condominioId === d.id)
          .map((u) => ({ uid: u.uid, nome: u.nome || u.email })),
        agendamentos: await contar('agendamentos', d.id)
      } satisfies Condominio;
    })
  );
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

async function todosOsCondominios() {
  const snap = await getDocs(collection(db, 'condominios'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as { nome: string; nomeNormalizado?: string }) }));
}

function exigirNomeValido(nome: string) {
  const erro = validarNome(nome);
  if (erro) throw new Error(MENSAGENS_NOME[erro]);
}

export async function criarCondominio(nome: string): Promise<string> {
  exigirNomeValido(nome);
  const id = idDoCondominio(nome);
  if (acharDuplicado(nome, await todosOsCondominios())) {
    throw new Error('Já existe um condomínio com esse nome.');
  }
  // O id é determinístico: se existir um documento com ele, é duplicado mesmo sem o mesmo nomeNormalizado
  if ((await getDoc(doc(db, 'condominios', id))).exists()) {
    throw new Error('Já existe um condomínio com esse nome.');
  }
  await setDoc(doc(db, 'condominios', id), { nome: limpar(nome), nomeNormalizado: normalizarNome(nome) });
  return id;
}

// Renomear NÃO muda o id: usuários e agendamentos guardam o id, e o admin não pode reescrever
// os documentos dos moradores (as regras bloqueiam). Muda só `nome` e `nomeNormalizado`.
export async function renomearCondominio(id: string, nome: string): Promise<void> {
  exigirNomeValido(nome);
  if (acharDuplicado(nome, await todosOsCondominios(), id)) {
    throw new Error('Já existe outro condomínio com esse nome.');
  }
  await updateDoc(doc(db, 'condominios', id), { nome: limpar(nome), nomeNormalizado: normalizarNome(nome) });
}

export async function removerCondominio(id: string): Promise<void> {
  const [usuarios, agendamentos] = await Promise.all([contar('users', id), contar('agendamentos', id)]);
  if (usuarios > 0 || agendamentos > 0) {
    const partes = [
      usuarios > 0 ? `${usuarios} usuário${usuarios > 1 ? 's' : ''}` : '',
      agendamentos > 0 ? `${agendamentos} agendamento${agendamentos > 1 ? 's' : ''}` : ''
    ].filter(Boolean);
    throw new Error(`Não é possível remover: há ${partes.join(' e ')} vinculado${usuarios + agendamentos > 1 ? 's' : ''}.`);
  }
  await deleteDoc(doc(db, 'condominios', id));
}
