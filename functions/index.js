import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const auth = getAuth();
const db = getFirestore();

const REGIAO = 'southamerica-east1';
const PAPEIS = ['cliente', 'gerente', 'admin', 'insulfilm'];

const senhaForte = (s) =>
  typeof s === 'string' &&
  s.length >= 8 &&
  /[A-Z]/.test(s) &&
  /[a-z]/.test(s) &&
  /[0-9]/.test(s) &&
  /[^A-Za-z0-9]/.test(s);

// O papel vem sempre do Firestore, lido aqui no servidor. Nunca de dado enviado pelo cliente.
async function exigirAdmin(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login para continuar.');
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists || snap.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Apenas administradores podem fazer isso.');
  }
  return uid;
}

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

export const criarUsuario = onCall({ region: REGIAO }, async (request) => {
  await exigirAdmin(request);

  const nome = texto(request.data?.nome);
  const email = texto(request.data?.email).toLowerCase();
  const senha = request.data?.senha;
  const role = request.data?.role;
  const condominioId = texto(request.data?.condominioId) || null;

  if (!nome) throw new HttpsError('invalid-argument', 'Informe o nome.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'E-mail inválido.');
  }
  if (!PAPEIS.includes(role)) throw new HttpsError('invalid-argument', 'Papel inválido.');
  if (!senhaForte(senha)) {
    throw new HttpsError(
      'invalid-argument',
      'A senha precisa de 8+ caracteres, maiúscula, minúscula, número e caractere especial.'
    );
  }

  let usuario;
  try {
    usuario = await auth.createUser({ email, password: senha, displayName: nome });
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Já existe uma conta com esse e-mail.');
    }
    throw new HttpsError('internal', 'Não foi possível criar a conta.');
  }

  try {
    await db.doc(`users/${usuario.uid}`).set({
      nome,
      email,
      role,
      // Só cliente e gerente pertencem a um condomínio
      condominioId: role === 'cliente' || role === 'gerente' ? condominioId : null
    });
  } catch {
    // Não deixa conta sem perfil: desfaz a criação no Authentication
    await auth.deleteUser(usuario.uid).catch(() => {});
    throw new HttpsError('internal', 'Não foi possível gravar o perfil.');
  }

  return { uid: usuario.uid };
});

export const removerUsuario = onCall({ region: REGIAO }, async (request) => {
  const adminUid = await exigirAdmin(request);

  const uid = texto(request.data?.uid);
  if (!uid) throw new HttpsError('invalid-argument', 'Informe o usuário.');
  if (uid === adminUid) {
    throw new HttpsError('failed-precondition', 'Você não pode remover a própria conta.');
  }

  const alvo = await db.doc(`users/${uid}`).get();
  if (alvo.exists && alvo.data().role === 'admin') {
    const admins = await db.collection('users').where('role', '==', 'admin').count().get();
    if (admins.data().count <= 1) {
      throw new HttpsError('failed-precondition', 'Não é possível remover o último administrador.');
    }
  }

  try {
    await auth.deleteUser(uid);
  } catch (e) {
    // Conta já inexistente no Authentication: segue e limpa o perfil
    if (e.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', 'Não foi possível remover a conta.');
    }
  }
  await db.doc(`users/${uid}`).delete();

  return { ok: true };
});

// A listagem de usuários não precisa de function: as regras do Firestore já deixam
// o admin ler todos os documentos de `users`. A tela usa getDocs direto.
