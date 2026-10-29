// Cria (ou atualiza) UMA conta com e-mail, senha e papel informados, SEM exigir senha forte.
// Uso excepcional, direto pelo Admin SDK (não passa pelo app nem pela API da Vercel).
//
//   node criar-conta-avulsa.mjs --email x@y.com --senha 123456 --role admin [--nome "Nome"] [--condominio id]
//
// Credenciais: GOOGLE_APPLICATION_CREDENTIALS (service account) ou as Application Default Credentials
// do gcloud. Nunca grave e-mail/senha reais neste arquivo: o repositório é (ou será) público.

import { parseArgs } from 'node:util';

const PROJECT_ID = 'target-auto-spa-33842';
const PAPEIS = ['cliente', 'gerente', 'admin', 'insulfilm'];

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    senha: { type: 'string' },
    role: { type: 'string' },
    nome: { type: 'string' },
    condominio: { type: 'string' }
  }
});

const email = values.email?.trim().toLowerCase();
const { senha, role } = values;
if (!email || !senha || !PAPEIS.includes(role ?? '')) {
  console.error('Informe --email, --senha e --role (cliente|gerente|admin|insulfilm).');
  process.exit(1);
}
if (senha.length < 6) {
  console.error('O Firebase Authentication exige no mínimo 6 caracteres.');
  process.exit(1);
}
const nome = values.nome?.trim() || email.split('@')[0];
const condominioId = role === 'cliente' || role === 'gerente' ? values.condominio?.trim() || null : null;

const { initializeApp, applicationDefault } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore } = await import('firebase-admin/firestore');

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

let usuario;
try {
  usuario = await auth.getUserByEmail(email);
  await auth.updateUser(usuario.uid, { password: senha, displayName: nome, emailVerified: true });
  console.log(`Auth: ${email} já existia; senha redefinida (${usuario.uid})`);
} catch (e) {
  if (e.code !== 'auth/user-not-found') throw e;
  usuario = await auth.createUser({ email, password: senha, displayName: nome, emailVerified: true });
  console.log(`Auth: ${email} criado (${usuario.uid})`);
}

await db.doc(`users/${usuario.uid}`).set({ nome, email, role, condominioId });
const conferido = (await db.doc(`users/${usuario.uid}`).get()).data();
console.log('Firestore users/' + usuario.uid + ':', JSON.stringify(conferido));
