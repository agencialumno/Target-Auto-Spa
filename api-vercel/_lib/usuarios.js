// Lógica de criar/remover usuários, sem dependência de Vercel ou do SDK real:
// recebe `auth` (firebase-admin/auth) e `db` (firebase-admin/firestore) por parâmetro,
// o que permite testar com objetos falsos.

export const PAPEIS = ['cliente', 'gerente', 'admin', 'insulfilm'];

export class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

const LIMITES = { nome: 100, email: 254, senha: 128, condominioId: 100, uid: 128 };
// uid do Firebase Auth: alfanumérico; condomínio: id de documento simples
const UID_RE = /^[A-Za-z0-9]{1,128}$/;
const CONDOMINIO_RE = /^[A-Za-z0-9_-]{1,100}$/;

function exigirObjeto(corpo) {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroHttp(400, 'Corpo inválido.');
  }
}

export const senhaForte = (s) =>
  typeof s === 'string' &&
  s.length >= 8 &&
  /[A-Z]/.test(s) &&
  /[a-z]/.test(s) &&
  /[0-9]/.test(s) &&
  /[^A-Za-z0-9]/.test(s);

// Valida o ID token do Firebase e confirma, no Firestore, que quem chama é admin.
// O papel vem sempre do banco, nunca do corpo da requisição nem do token.
export async function exigirAdmin({ auth, db }, authorization) {
  const m = /^Bearer (.+)$/.exec(authorization ?? '');
  if (!m) throw new ErroHttp(401, 'Faça login para continuar.');

  let decodificado;
  try {
    decodificado = await auth.verifyIdToken(m[1], true);
  } catch {
    throw new ErroHttp(401, 'Sessão inválida ou expirada. Entre novamente.');
  }

  const snap = await db.doc(`users/${decodificado.uid}`).get();
  if (!snap.exists || snap.data().role !== 'admin') {
    throw new ErroHttp(403, 'Apenas administradores podem fazer isso.');
  }
  return decodificado.uid;
}

export async function criarUsuario(deps, authorization, corpo) {
  const { auth, db } = deps;
  await exigirAdmin(deps, authorization);

  exigirObjeto(corpo);
  const nome = texto(corpo.nome);
  const email = texto(corpo.email).toLowerCase();
  const senha = corpo.senha;
  const role = corpo.role;
  const condominioId = texto(corpo.condominioId) || null;

  if (!nome) throw new ErroHttp(400, 'Informe o nome.');
  if (nome.length > LIMITES.nome) throw new ErroHttp(400, 'Nome grande demais.');
  if (email.length > LIMITES.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ErroHttp(400, 'E-mail inválido.');
  }
  if (typeof senha === 'string' && senha.length > LIMITES.senha) {
    throw new ErroHttp(400, 'Senha grande demais.');
  }
  if (condominioId && !CONDOMINIO_RE.test(condominioId)) {
    throw new ErroHttp(400, 'Condomínio inválido.');
  }
  if (!PAPEIS.includes(role)) throw new ErroHttp(400, 'Papel inválido.');
  if (!senhaForte(senha)) {
    throw new ErroHttp(
      400,
      'A senha precisa de 8+ caracteres, maiúscula, minúscula, número e caractere especial.'
    );
  }

  // Condomínio informado precisa existir (cliente e gerente)
  const vinculado = role === 'cliente' || role === 'gerente' ? condominioId : null;
  if (vinculado && !(await db.doc(`condominios/${vinculado}`).get()).exists) {
    throw new ErroHttp(404, 'Condomínio não encontrado.');
  }

  let usuario;
  try {
    usuario = await auth.createUser({ email, password: senha, displayName: nome });
  } catch (e) {
    if (e?.code === 'auth/email-already-exists') {
      throw new ErroHttp(409, 'Já existe uma conta com esse e-mail.');
    }
    throw new ErroHttp(500, 'Não foi possível criar a conta.');
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
    throw new ErroHttp(500, 'Não foi possível gravar o perfil.');
  }

  return { uid: usuario.uid };
}

export async function removerUsuario(deps, authorization, corpo) {
  const { auth, db } = deps;
  const adminUid = await exigirAdmin(deps, authorization);

  exigirObjeto(corpo);
  const uid = texto(corpo.uid);
  if (!UID_RE.test(uid)) throw new ErroHttp(400, 'Usuário inválido.');
  if (uid === adminUid) throw new ErroHttp(400, 'Você não pode remover a própria conta.');

  const alvo = await db.doc(`users/${uid}`).get();
  if (alvo.exists && alvo.data().role === 'admin') {
    const admins = await db.collection('users').where('role', '==', 'admin').count().get();
    if (admins.data().count <= 1) {
      throw new ErroHttp(400, 'Não é possível remover o último administrador.');
    }
  }

  try {
    await auth.deleteUser(uid);
  } catch (e) {
    // Conta já inexistente no Authentication: segue e limpa o perfil
    if (e?.code !== 'auth/user-not-found') {
      throw new ErroHttp(500, 'Não foi possível remover a conta.');
    }
  }
  await db.doc(`users/${uid}`).delete();

  return { ok: true };
}

// Troca (ou remove) o condomínio de um cliente ou gerente. O próprio usuário só define o condomínio
// uma vez (firestore.rules); mudanças posteriores passam por aqui, com o Admin SDK.
export async function definirCondominio(deps, authorization, corpo) {
  const { db } = deps;
  await exigirAdmin(deps, authorization);

  exigirObjeto(corpo);
  const uid = texto(corpo.uid);
  if (!UID_RE.test(uid)) throw new ErroHttp(400, 'Usuário inválido.');

  const pedido = corpo.condominioId;
  if (pedido !== null && typeof pedido !== 'string') throw new ErroHttp(400, 'Condomínio inválido.');
  const condominioId = pedido === null ? null : texto(pedido);
  if (condominioId !== null && !CONDOMINIO_RE.test(condominioId)) {
    throw new ErroHttp(400, 'Condomínio inválido.');
  }

  const alvo = await db.doc(`users/${uid}`).get();
  if (!alvo.exists) throw new ErroHttp(404, 'Usuário não encontrado.');
  const role = alvo.data().role;
  if (role !== 'cliente' && role !== 'gerente') {
    throw new ErroHttp(400, 'Só clientes e gerentes pertencem a um condomínio.');
  }

  if (condominioId !== null) {
    const condo = await db.doc(`condominios/${condominioId}`).get();
    if (!condo.exists) throw new ErroHttp(404, 'Condomínio não encontrado.');
  }

  await db.doc(`users/${uid}`).update({ condominioId });
  return { ok: true, uid, condominioId };
}
