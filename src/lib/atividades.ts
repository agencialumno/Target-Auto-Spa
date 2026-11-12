// Log de atividades gravado pelo app (melhor esforço): login de admin, preço e status de agendamento.
// As regras só deixam CRIAR, como o próprio autor; nunca alterar nem apagar. O servidor grava o resto
// (usuários, vínculos, pagamentos). Só entram campos de uma lista por ação: nada de e-mail, nome ou CPF.
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Status } from './agendamentos';

export type AcaoApp = 'login_admin' | 'preco_alterado' | 'status_agendamento' | 'custo_criado' | 'custo_alterado' | 'custo_removido';

export type NovaAtividade = {
  acao: AcaoApp;
  alvoId: string;
  antes?: { status?: Status; precoCentavos?: number; categoria?: string; valorCentavos?: number };
  depois?: { status?: Status; precoCentavos?: number; categoria?: string; valorCentavos?: number };
};

const ALVO: Record<AcaoApp, string> = {
  login_admin: 'usuario',
  preco_alterado: 'servico',
  status_agendamento: 'agendamento',
  custo_criado: 'custo',
  custo_alterado: 'custo',
  custo_removido: 'custo'
};
const CAMPOS_CUSTO = ['categoria', 'valorCentavos'];
const CAMPOS: Record<AcaoApp, string[]> = {
  login_admin: [],
  preco_alterado: ['precoCentavos'],
  status_agendamento: ['status'],
  custo_criado: CAMPOS_CUSTO,
  custo_alterado: CAMPOS_CUSTO,
  custo_removido: CAMPOS_CUSTO
};

const so = (campos: string[], o?: Record<string, unknown>) => {
  const saida = Object.fromEntries(campos.filter((c) => o?.[c] !== undefined).map((c) => [c, o![c]]));
  return Object.keys(saida).length ? saida : undefined;
};

// Documento a gravar (puro, testável): campos fora da lista da ação são descartados
export function montarAtividadeApp(n: NovaAtividade, atorUid: string, atorPapel: string, em: unknown) {
  const antes = so(CAMPOS[n.acao], n.antes);
  const depois = so(CAMPOS[n.acao], n.depois);
  return {
    em,
    atorUid,
    atorPapel,
    acao: n.acao,
    alvoTipo: ALVO[n.acao],
    alvoId: n.alvoId,
    ...(antes ? { antes } : {}),
    ...(depois ? { depois } : {}),
    origem: 'app'
  };
}

// Nunca lança: o log não pode quebrar a ação que ele descreve
export async function registrarAtividade(n: NovaAtividade, papel: string | undefined) {
  const uid = auth.currentUser?.uid;
  if (!uid || !papel) return false;
  try {
    await addDoc(collection(db, 'atividades'), montarAtividadeApp(n, uid, papel, serverTimestamp()));
    return true;
  } catch {
    return false;
  }
}
