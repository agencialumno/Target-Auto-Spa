// Migração única: o papel 'insulfilm' deixou de existir. Quem o tinha vira funcionário com
// especialidade 'insulfilm' (e sem condomínio). Recebe o Firestore por parâmetro para poder ser testada.
// Por padrão só LISTA (dry-run); grava apenas com { aplicar: true }.
export async function migrarInsulfilm(db, { aplicar = false } = {}) {
  const snap = await db.collection('users').where('role', '==', 'insulfilm').get();
  const afetados = snap.docs.map((d) => ({ uid: d.id, nome: d.data().nome ?? '', email: d.data().email ?? '' }));
  if (aplicar) {
    for (const a of afetados) {
      await db.doc(`users/${a.uid}`).update({ role: 'funcionario', especialidade: 'insulfilm', condominioId: null });
    }
  }
  return { aplicado: aplicar, afetados };
}
