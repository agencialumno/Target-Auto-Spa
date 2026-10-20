// Cria 4 contas de teste (cliente, gerente, admin, insulfilm) no Firebase Auth + Firestore.
//
// Uso (na pasta scripts/contas-teste):
//   npm install
//   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\caminho\fora\do\projeto\chave-service-account.json"   (PowerShell)
//   node criar-contas.mjs
//
// Opcional:
//   $env:SENHA_TESTE = "SuaSenha@123"   usa essa senha em vez de gerar uma
//   node criar-contas.mjs --simular     só mostra o que faria, sem credenciais e sem escrever
//
// Rodar de novo é seguro: contas existentes têm a senha redefinida e o perfil regravado.

import { randomInt } from 'node:crypto';

const PROJECT_ID = 'target-auto-spa-33842';
const DOMINIO = 'targetautospa.com';
const CONDOMINIO_ID = 'condominio-teste';
const SIMULAR = process.argv.includes('--simular');

// Mesmo formato de Perfil em src/lib/auth.svelte.ts: { nome, email, role, condominioId }
const CONTAS = [
  { role: 'cliente', nome: 'Teste Cliente', condominioId: CONDOMINIO_ID },
  { role: 'gerente', nome: 'Teste Gerente', condominioId: CONDOMINIO_ID },
  { role: 'admin', nome: 'Teste Admin', condominioId: null },
  { role: 'insulfilm', nome: 'Teste Insulfilm', condominioId: null }
].map((c) => ({ ...c, email: `teste.${c.role}@${DOMINIO}` }));

// Atende aos critérios do app: 8+ caracteres, maiúscula, minúscula, número e especial
function gerarSenha() {
  const pick = (s) => s[randomInt(s.length)];
  const grupos = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%&*?'];
  const todos = grupos.join('');
  const chars = grupos.map(pick);
  while (chars.length < 14) chars.push(pick(todos));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const senhaForte = (s) =>
  s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s);

const senha = process.env.SENHA_TESTE || gerarSenha();
if (!senhaForte(senha)) {
  console.error('SENHA_TESTE não atende aos critérios (8+, maiúscula, minúscula, número, especial).');
  process.exit(1);
}

if (SIMULAR) {
  console.log('[simulação] nada será escrito.\n');
  for (const c of CONTAS) {
    console.log(`Auth: ${c.email}`);
    console.log(
      `Firestore users/{uid}:`,
      JSON.stringify({ nome: c.nome, email: c.email, role: c.role, condominioId: c.condominioId })
    );
  }
  console.log(`Firestore condominios/${CONDOMINIO_ID}`);
  console.log(`\nSenha (seria usada): ${senha}`);
  process.exit(0);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    'Defina GOOGLE_APPLICATION_CREDENTIALS com o caminho do JSON da service account (veja o topo do arquivo).'
  );
  process.exit(1);
}

const { initializeApp, applicationDefault } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore } = await import('firebase-admin/firestore');

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

for (const c of CONTAS) {
  let usuario;
  try {
    usuario = await auth.getUserByEmail(c.email);
    await auth.updateUser(usuario.uid, { password: senha, displayName: c.nome, emailVerified: true });
    console.log(`Auth: ${c.email} já existia, senha redefinida (${usuario.uid})`);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    usuario = await auth.createUser({
      email: c.email,
      password: senha,
      displayName: c.nome,
      emailVerified: true
    });
    console.log(`Auth: ${c.email} criado (${usuario.uid})`);
  }

  await db
    .collection('users')
    .doc(usuario.uid)
    .set({ nome: c.nome, email: c.email, role: c.role, condominioId: c.condominioId });
  console.log(`Firestore: users/${usuario.uid} role=${c.role} condominioId=${c.condominioId}`);
}

// Condomínio de teste: o nome normalizado é o que a tela "entrar no condomínio" busca
await db
  .collection('condominios')
  .doc(CONDOMINIO_ID)
  .set({ nome: 'Condomínio Teste', nomeNormalizado: CONDOMINIO_ID });
console.log(`Firestore: condominios/${CONDOMINIO_ID}`);

console.log('\n=== Contas de teste ===');
for (const c of CONTAS) console.log(`${c.role.padEnd(10)} ${c.email}`);
console.log(`Senha (igual para todas): ${senha}`);
