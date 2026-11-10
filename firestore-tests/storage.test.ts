import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';

// Roda contra os emuladores de Firestore e Storage: `npm run test:rules`
let env: RulesTestEnvironment;

const PERFIS: Record<string, { role: string; condominioId: string | null }> = {
  ana: { role: 'cliente', condominioId: 'c1' },
  bia: { role: 'cliente', condominioId: 'c2' },
  gui: { role: 'gerente', condominioId: 'c1' },
  gabi: { role: 'gerente', condominioId: 'c2' },
  gnulo: { role: 'gerente', condominioId: null },
  fun: { role: 'funcionario', condominioId: null },
  fran: { role: 'funcionario', condominioId: null },
  adm: { role: 'admin', condominioId: null },
  ins: { role: 'insulfilm', condominioId: null }
};

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const JPG = { contentType: 'image/jpeg' };

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-target-auto-spa',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') }
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, p] of Object.entries(PERFIS)) {
      await setDoc(doc(db, 'users', uid), { nome: uid, email: `${uid}@ex.com`, ...p });
    }
    const base = { itens: [], total: 0, funcionarioId: null };
    // agA: de ana (c1), atribuído a fun, em andamento; agB: de bia (c2), sem funcionário;
    // agFim: de ana, atribuído a fun, já finalizado; agNulo: sem condomínio
    await setDoc(doc(db, 'agendamentos', 'agA'), { ...base, clienteId: 'ana', condominioId: 'c1', status: 'em_andamento', funcionarioId: 'fun' });
    await setDoc(doc(db, 'agendamentos', 'agB'), { ...base, clienteId: 'bia', condominioId: 'c2', status: 'agendado' });
    await setDoc(doc(db, 'agendamentos', 'agFim'), { ...base, clienteId: 'ana', condominioId: 'c1', status: 'finalizado', funcionarioId: 'fun' });
    await setDoc(doc(db, 'agendamentos', 'agNulo'), { ...base, clienteId: 'bia', condominioId: null, status: 'agendado' });
    // Uma foto já existente para testar leitura e exclusão
    await uploadBytes(ref(ctx.storage(), 'agendamentos/agA/checklist/antes_frente.jpg'), JPEG, JPG);
  });
});

const storage = (uid: string | null) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).storage();
const arq = (uid: string | null, ag: string, nome = 'antes_frente.jpg') =>
  ref(storage(uid), `agendamentos/${ag}/checklist/${nome}`);

describe('storage: leitura das fotos do checklist', () => {
  it('cliente dono, funcionário atribuído, gerente do condomínio e admin leem', async () => {
    for (const uid of ['ana', 'fun', 'gui', 'adm']) {
      await assertSucceeds(getBytes(arq(uid, 'agA')));
    }
  });

  it('outro cliente, outro funcionário, gerente de outro condomínio ou sem condomínio, insulfilm e anônimo NÃO leem', async () => {
    for (const uid of ['bia', 'fran', 'gabi', 'gnulo', 'ins', null]) {
      await assertFails(getBytes(arq(uid, 'agA')));
    }
  });
});

describe('storage: envio das fotos', () => {
  it('funcionário atribuído, gerente do condomínio e admin enviam JPEG', async () => {
    await assertSucceeds(uploadBytes(arq('fun', 'agA', 'depois_frente.jpg'), JPEG, JPG));
    await assertSucceeds(uploadBytes(arq('gui', 'agA', 'antes_traseira.jpg'), JPEG, JPG));
    await assertSucceeds(uploadBytes(arq('adm', 'agA', 'antes_rodas.jpg'), JPEG, JPG));
    await assertSucceeds(uploadBytes(arq('fun', 'agA'), JPEG, JPG)); // regravar a mesma foto
  });

  it('cliente dono NÃO envia foto (nem do próprio atendimento)', async () => {
    await assertFails(uploadBytes(arq('ana', 'agA', 'antes_x.jpg'), JPEG, JPG));
  });

  it('outro funcionário, gerente de outro condomínio, sem condomínio, insulfilm e anônimo NÃO enviam', async () => {
    for (const uid of ['fran', 'gabi', 'gnulo', 'ins', 'bia', null]) {
      await assertFails(uploadBytes(arq(uid, 'agA', 'antes_x.jpg'), JPEG, JPG));
    }
  });

  it('funcionário não envia em agendamento que não é dele nem em atendimento finalizado', async () => {
    await assertFails(uploadBytes(arq('fun', 'agB', 'antes_x.jpg'), JPEG, JPG));
    await assertFails(uploadBytes(arq('fun', 'agFim', 'depois_x.jpg'), JPEG, JPG));
  });

  it('gerente sem condomínio não envia em agendamento sem condomínio (null == null)', async () => {
    await assertFails(uploadBytes(arq('gnulo', 'agNulo', 'antes_x.jpg'), JPEG, JPG));
  });

  it('só image/jpeg: PNG, PDF e tipo ausente são recusados', async () => {
    await assertFails(uploadBytes(arq('fun', 'agA', 'antes_a.jpg'), JPEG, { contentType: 'image/png' }));
    await assertFails(uploadBytes(arq('fun', 'agA', 'antes_b.jpg'), JPEG, { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(arq('fun', 'agA', 'antes_c.jpg'), JPEG, { contentType: 'text/html' }));
  });

  it('até 5 MB', async () => {
    await assertSucceeds(uploadBytes(arq('fun', 'agA', 'antes_ok.jpg'), new Uint8Array(5 * 1024 * 1024), JPG));
    await assertFails(uploadBytes(arq('fun', 'agA', 'antes_grande.jpg'), new Uint8Array(5 * 1024 * 1024 + 1), JPG));
  });

  it('nome fora do padrão antes_/depois_ + .jpg é recusado', async () => {
    for (const nome of ['foto.jpg', 'antes_x.png', 'antes_X.jpg', 'durante_x.jpg', 'antes_x.jpg.html']) {
      await assertFails(uploadBytes(arq('fun', 'agA', nome), JPEG, JPG));
    }
  });

  it('caminhos fora de agendamentos/*/checklist/ são negados para todos', async () => {
    for (const uid of ['adm', 'gui', 'fun', 'ana']) {
      await assertFails(uploadBytes(ref(storage(uid), `outros/${uid}.jpg`), JPEG, JPG));
      await assertFails(uploadBytes(ref(storage(uid), 'agendamentos/agA/outra/antes_x.jpg'), JPEG, JPG));
      await assertFails(getBytes(ref(storage(uid), 'outros/x.jpg')));
    }
  });
});

describe('storage: exclusão', () => {
  it('só admin apaga', async () => {
    for (const uid of ['ana', 'fun', 'gui', 'bia', null]) {
      await assertFails(deleteObject(arq(uid, 'agA')));
    }
    await assertSucceeds(deleteObject(arq('adm', 'agA')));
  });
});
