// SOMENTE LEITURA. Executa em produção as mesmas consultas do dashboard (count/sum/get com limit pequeno)
// e imprime OK ou o erro completo do Firestore (em FAILED_PRECONDITION vem o link do índice que falta).
// Uso (na sua máquina), com Application Default Credentials, sem arquivo de chave:
//   gcloud auth application-default login
//   node scripts/diagnostico-indices.js
// O projeto pode ser trocado com GCLOUD_PROJECT. Nada é gravado.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, AggregateField } from 'firebase-admin/firestore';

const projectId = process.env.GCLOUD_PROJECT || 'target-auto-spa-33842';
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const agora = new Date();
const a = agora.getFullYear();
const m = agora.getMonth();
const periodos = {
  atual: [new Date(a, m, 1), new Date(a, m + 1, 1)],
  anterior: [new Date(a, m - 1, 1), new Date(a, m, 1)]
};
const STATUS = ['agendado', 'em_andamento', 'finalizado', 'cancelado'];
const ag = () => db.collection('agendamentos');

const consultas = [];
const add = (nome, fn) => consultas.push([nome, fn]);

for (const [rot, [ini, fim]] of Object.entries(periodos)) {
  for (const s of STATUS) {
    const base = () => ag().where('status', '==', s).where('inicio', '>=', ini).where('inicio', '<', fim);
    add(`contagem por status (${s}, ${rot}) SEM orderBy [forma antiga]`, () => base().count().get());
    add(`contagem por status (${s}, ${rot}) COM orderBy inicio desc [forma atual]`, () => base().orderBy('inicio', 'desc').count().get());
  }
  add(`faturamento sum/count (${rot})`, () =>
    ag()
      .where('pagamento.status', '==', 'pago')
      .where('pagamento.pagoEm', '>=', periodos[rot][0])
      .where('pagamento.pagoEm', '<', periodos[rot][1])
      .aggregate({ total: AggregateField.sum('total'), pagos: AggregateField.count() })
      .get()
  );
}
for (const p of ['cliente', 'gerente', 'funcionario', 'admin']) {
  add(`usuários por papel (${p})`, () => db.collection('users').where('role', '==', p).count().get());
}
add('custos orderBy competencia desc limit', () => db.collection('custos').orderBy('competencia', 'desc').limit(5).get());
add('detalhe do período: inicio range + orderBy inicio desc + limit', () =>
  ag().where('inicio', '>=', periodos.atual[0]).where('inicio', '<', periodos.atual[1]).orderBy('inicio', 'desc').limit(5).get()
);
add('últimas movimentações: atividades orderBy em desc limit', () => db.collection('atividades').orderBy('em', 'desc').limit(5).get());
add('tela do usuário: clienteId == + orderBy inicio desc', () => ag().where('clienteId', '==', 'x').orderBy('inicio', 'desc').limit(1).get());
add('tela do usuário: funcionarioId == + orderBy inicio desc', () => ag().where('funcionarioId', '==', 'x').orderBy('inicio', 'desc').limit(1).get());
add('tela do usuário: contagem clienteId ==', () => ag().where('clienteId', '==', 'x').count().get());
add('atividades: atorUid == + em range + orderBy em desc', () =>
  db.collection('atividades').where('atorUid', '==', 'x').where('em', '>=', periodos.anterior[0]).orderBy('em', 'desc').limit(1).get()
);
add('atividades: acao == + alvoId == + orderBy em desc', () =>
  db.collection('atividades').where('acao', '==', 'login_admin').where('alvoId', '==', 'x').orderBy('em', 'desc').limit(1).get()
);

let falhas = 0;
for (const [nome, fn] of consultas) {
  try {
    const r = await fn();
    const detalhe = r.data ? JSON.stringify(r.data()) : `${r.size} doc(s)`;
    console.log(`OK     ${nome} -> ${detalhe}`);
  } catch (e) {
    if (/Could not load the default credentials|invalid_grant|reauth/i.test(String(e?.message))) {
      console.error('Sem credenciais. Rode: gcloud auth application-default login');
      process.exit(2);
    }
    falhas++;
    console.log(`FALHOU ${nome}\n       code=${e?.code} ${e?.message}\n`);
  }
}
console.log(`\n${consultas.length - falhas} OK, ${falhas} com erro. Nada foi gravado.`);
