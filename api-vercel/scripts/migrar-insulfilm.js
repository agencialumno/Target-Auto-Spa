// Uso (rodar na sua máquina, uma vez), com Application Default Credentials, sem arquivo de chave:
//   gcloud auth application-default login
//   node scripts/migrar-insulfilm.js            (só lista as contas que seriam migradas)
//   node scripts/migrar-insulfilm.js --aplicar  (grava a migração)
// Nenhuma chave é lida nem guardada. O projeto pode ser trocado com GCLOUD_PROJECT.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { migrarInsulfilm } from '../_lib/migracao.js';

const projectId = process.env.GCLOUD_PROJECT || 'target-auto-spa-33842';

initializeApp({ credential: applicationDefault(), projectId });
const aplicar = process.argv.includes('--aplicar');

try {
  const r = await migrarInsulfilm(getFirestore(), { aplicar });
  console.log(`${r.afetados.length} conta(s) com o papel antigo "insulfilm" no projeto ${projectId}:`);
  for (const a of r.afetados) console.log(` - uid=${a.uid} email=${a.email} nome=${a.nome}`);
  console.log(aplicar ? 'Migradas para funcionario + especialidade insulfilm.' : 'Listagem: nada foi gravado. Use --aplicar para migrar.');
} catch (e) {
  if (/Could not load the default credentials|invalid_grant|reauth/i.test(String(e?.message))) {
    console.error('Sem credenciais. Rode: gcloud auth application-default login');
    process.exit(2);
  }
  throw e;
}
