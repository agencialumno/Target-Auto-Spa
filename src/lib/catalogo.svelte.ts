// Catálogo de serviços. O texto (descrição, itens incluídos, ícone) vem de catalogo-base.ts;
// o preço, a duração e a disponibilidade que valem vêm do Firestore (coleção servicos).
// As regras do agendamento conferem o preço contra o documento do Firestore.
import { registrarAtividade } from './atividades';
import { collection, doc, onSnapshot, updateDoc, writeBatch, type DocumentData } from 'firebase/firestore';
import { servicosBase, type Servico } from './catalogo-base';
import { db } from './firebase';

export const servicos: Servico[] = $state(
  servicosBase.map((s) => ({ ...s, publicado: false, ativo: true }))
);

export const getServico = (id: string) => servicos.find((s) => s.id === id);

// Só o que está publicado e ativo pode ser contratado
export const contratavel = (s: Servico) => s.publicado === true && s.ativo !== false;

// Aplica os documentos do Firestore sobre a lista (preço, duração, nome, ativo)
export function aplicarCatalogo(docs: { id: string; data: DocumentData }[]) {
  const porId = new Map(docs.map((d) => [d.id, d.data]));
  for (const s of servicos) {
    const d = porId.get(s.id);
    if (!d) {
      s.publicado = false;
      s.ativo = true;
      continue;
    }
    s.publicado = true;
    s.ativo = d.ativo !== false;
    if (Number.isInteger(d.precoCentavos)) {
      s.precoCentavos = d.precoCentavos;
      s.preco = d.precoCentavos / 100;
    }
    if (typeof d.duracaoMin === 'number') s.duracao = d.duracaoMin;
    if (typeof d.nome === 'string' && d.nome) s.nome = d.nome;
  }
}

let parar: (() => void) | null = null;

export function iniciarCatalogo() {
  if (parar) return;
  parar = onSnapshot(
    collection(db, 'servicos'),
    (snap) => aplicarCatalogo(snap.docs.map((d) => ({ id: d.id, data: d.data() }))),
    () => {
      // sem permissão ou sem rede: mantém o texto base e nada fica contratável
    }
  );
}

export function pararCatalogo() {
  parar?.();
  parar = null;
  aplicarCatalogo([]);
}

// Documento de /servicos no formato que as regras esperam
export function docServico(s: Servico, ordem: number): DocumentData {
  return {
    codigo: s.codigo,
    nome: s.nome,
    descricao: s.descricao,
    categoria: s.categoria,
    precoCentavos: s.precoCentavos,
    duracaoMin: s.duracao,
    avulso: s.avulso,
    ativo: s.ativo !== false,
    ordem
  };
}

// Admin: publica no Firestore os serviços que ainda não existem lá (preço inicial = o do catálogo base)
export async function publicarCatalogoInicial(): Promise<number> {
  const faltam = servicosBase.filter((b) => !getServico(b.id)?.publicado);
  for (let i = 0; i < faltam.length; i += 400) {
    const lote = writeBatch(db);
    for (const b of faltam.slice(i, i + 400)) {
      lote.set(doc(db, 'servicos', b.id), docServico({ ...b, ativo: true }, servicosBase.indexOf(b)));
    }
    await lote.commit();
  }
  return faltam.length;
}

// Admin: troca o preço (em centavos inteiros) de um serviço publicado
export async function salvarPrecoServico(id: string, precoCentavos: number) {
  if (!Number.isInteger(precoCentavos) || precoCentavos <= 0) throw new Error('Preço inválido.');
  const antes = servicos.find((s) => s.id === id)?.precoCentavos;
  await updateDoc(doc(db, 'servicos', id), { precoCentavos });
  void registrarAtividade(
    { acao: 'preco_alterado', alvoId: id, ...(typeof antes === 'number' ? { antes: { precoCentavos: antes } } : {}), depois: { precoCentavos } },
    'admin'
  );
}

export async function alternarServico(id: string, ativo: boolean) {
  await updateDoc(doc(db, 'servicos', id), { ativo });
}
