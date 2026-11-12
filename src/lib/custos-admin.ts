// Custos no Firestore (só admin; as regras repetem as validações). Cada mudança entra no log de atividades.
import { addDoc, collection, deleteDoc, deleteField, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { registrarAtividade } from './atividades';
import { lerCusto, montarCusto, validarCusto, type Custo, type EntradaCusto } from './custos';

export async function listarCustos(): Promise<Custo[]> {
  const snap = await getDocs(query(collection(db, 'custos'), orderBy('competencia', 'desc'), limit(500)));
  return snap.docs.map((d) => lerCusto(d.id, d.data()));
}

const rotulo = (c: { categoria: string; valorCentavos: number }) => ({ categoria: c.categoria, valorCentavos: c.valorCentavos });

// Cria (sem `atual`) ou altera. Lança Error com a mensagem de validação; o log é melhor esforço.
export async function salvarCusto(entrada: EntradaCusto, atual?: Custo): Promise<void> {
  const problema = validarCusto(entrada);
  if (problema) throw new Error(problema.mensagem);
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sessão expirada. Entre novamente.');
  const dados = montarCusto(entrada);

  if (!atual) {
    const ref = await addDoc(collection(db, 'custos'), { ...dados, criadoPor: uid, criadoEm: serverTimestamp() });
    void registrarAtividade({ acao: 'custo_criado', alvoId: ref.id, depois: rotulo(dados) }, 'admin');
    return;
  }
  // deleteField: trocar recorrente por avulso não pode deixar recorrencia/fim para trás
  await updateDoc(doc(db, 'custos', atual.id), {
    ...dados,
    ...(dados.tipo === 'avulso' ? { recorrencia: deleteField(), fim: deleteField() } : {}),
    atualizadoEm: serverTimestamp()
  });
  void registrarAtividade({ acao: 'custo_alterado', alvoId: atual.id, antes: rotulo(atual), depois: rotulo(dados) }, 'admin');
}

export async function removerCusto(c: Custo): Promise<void> {
  await deleteDoc(doc(db, 'custos', c.id));
  void registrarAtividade({ acao: 'custo_removido', alvoId: c.id, antes: rotulo(c) }, 'admin');
}
