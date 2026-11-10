// Uso (rodar na sua máquina, uma vez):
//   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\caminho\fora-do-repositorio\conta-de-servico.json"
//   node scripts/migrar-insulfilm.js            (só lista as contas que seriam migradas)
//   node scripts/migrar-insulfilm.js --aplicar  (grava a migração)
// A chave da conta de serviço NUNCA vai para o repositório. Este script não a guarda nem a lê de arquivo do projeto.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { migrarInsulfilm } from '../_lib/migracao.js';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Defina GOOGLE_APPLICATION_CREDENTIALS apontando para o JSON da conta de serviço (fora do repositório).');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const aplicar = process.argv.includes('--aplicar');
const r = await migrarInsulfilm(getFirestore(), { aplicar });
console.log(`${r.afetados.length} conta(s) com o papel antigo "insulfilm":`);
for (const a of r.afetados) console.log(` - ${a.uid} ${a.nome} <${a.email}>`);
console.log(aplicar ? 'Migradas para funcionario + especialidade insulfilm.' : 'Dry-run: nada foi gravado. Use --aplicar para migrar.');
