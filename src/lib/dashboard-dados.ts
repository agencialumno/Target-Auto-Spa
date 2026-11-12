// Leituras do dashboard no Firestore (só admin). Estratégia de custo (fase 1):
//  - contagens e somas pelo servidor (count()/sum()): 1 leitura cobrada por até 1.000 itens agregados;
//  - tempo real só nos cartões do topo, sobre o que o app já escuta (sem leitura extra);
//  - ranking e desempenho abrem documentos, então só sob demanda e com teto de 500.
import { collection, getAggregateFromServer, getCountFromServer, getDocs, limit, orderBy, query, sum, count, where } from 'firebase/firestore';
import { db } from './firebase';
import { lerAgendamento, type Agendamento, type Status } from './agendamentos';
import { lerAtividade, type Atividade } from './atividades-consulta';
import { TETO_DETALHE, STATUS_ORDEM } from './dashboard';

export type Papel = 'cliente' | 'gerente' | 'funcionario' | 'admin';
const PAPEIS: Papel[] = ['cliente', 'gerente', 'funcionario', 'admin'];

export async function contarUsuarios(): Promise<Record<Papel, number>> {
  const r = await Promise.all(PAPEIS.map((p) => getCountFromServer(query(collection(db, 'users'), where('role', '==', p)))));
  return Object.fromEntries(PAPEIS.map((p, i) => [p, r[i].data().count])) as Record<Papel, number>;
}

// Índice existente: agendamentos (status, inicio desc)
export async function contarPorStatus(inicio: Date, fim: Date): Promise<Record<Status, number>> {
  const r = await Promise.all(
    STATUS_ORDEM.map((s) =>
      getCountFromServer(query(collection(db, 'agendamentos'), where('status', '==', s), where('inicio', '>=', inicio), where('inicio', '<', fim)))
    )
  );
  return Object.fromEntries(STATUS_ORDEM.map((s, i) => [s, r[i].data().count])) as Record<Status, number>;
}

// Só pagamentos confirmados (pagamento.status == 'pago'), pela data em que foram pagos.
// Índice novo: agendamentos (pagamento.status, pagamento.pagoEm, total)
export async function faturamento(inicio: Date, fim: Date): Promise<{ centavos: number; pagos: number }> {
  const q = query(
    collection(db, 'agendamentos'),
    where('pagamento.status', '==', 'pago'),
    where('pagamento.pagoEm', '>=', inicio),
    where('pagamento.pagoEm', '<', fim)
  );
  const r = await getAggregateFromServer(q, { total: sum('total'), pagos: count() });
  return { centavos: r.data().total ?? 0, pagos: r.data().pagos };
}

// Abre documentos (até o teto): só quando o admin pede os detalhes
export async function agendamentosDoPeriodo(inicio: Date, fim: Date): Promise<Agendamento[]> {
  const snap = await getDocs(
    query(collection(db, 'agendamentos'), where('inicio', '>=', inicio), where('inicio', '<', fim), orderBy('inicio', 'desc'), limit(TETO_DETALHE))
  );
  return snap.docs.map((d) => lerAgendamento(d.id, d.data()));
}

// "Últimas movimentações": o log de atividades (índice automático de um campo: em)
export async function ultimasMovimentacoes(n = 20): Promise<Atividade[]> {
  const snap = await getDocs(query(collection(db, 'atividades'), orderBy('em', 'desc'), limit(n)));
  return snap.docs.map((d) => lerAtividade(d.id, d.data()));
}
