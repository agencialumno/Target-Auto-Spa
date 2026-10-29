import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

// Firebase, Firestore e o plugin nativo são substituídos por mocks
const m = vi.hoisted(() => ({
  signInWithCredential: vi.fn(),
  credential: vi.fn((arg: { idToken: string; rawNonce: string }) => ({ tipo: 'credencial-apple', arg })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  invoke: vi.fn<(comando: string, args: { payload: { scope: string[]; nonce: string } }) => Promise<unknown>>()
}));

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithCredential: m.signInWithCredential,
  GoogleAuthProvider: class {},
  OAuthProvider: class {
    credential = m.credential;
  },
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn()
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...caminho: string[]) => ({ caminho: caminho.join('/') }),
  getDoc: m.getDoc,
  setDoc: m.setDoc,
  updateDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn()
}));
vi.mock('./firebase', () => ({ auth: {}, db: {} }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: m.invoke }));

import { authStore } from './auth.svelte';

const jwt = (payload: object) =>
  ['h', Buffer.from(JSON.stringify(payload)).toString('base64url'), 's'].join('.');
const TOKEN = jwt({ aud: 'br.com.lumno.targetautospa', iss: 'https://appleid.apple.com' });

const usuario = { uid: 'u1', displayName: null as string | null, email: 'a@x.com' };
const perfil = { nome: 'Ana Souza', email: 'a@x.com', role: 'cliente', condominioId: null };

// Primeira leitura: perfil não existe; depois da gravação: existe
function perfilAindaNaoExiste() {
  let gravado = false;
  m.setDoc.mockImplementation(async () => {
    gravado = true;
  });
  m.getDoc.mockImplementation(async () => ({
    exists: () => gravado,
    data: () => perfil
  }));
}

function perfilJaExiste() {
  m.getDoc.mockResolvedValue({ exists: () => true, data: () => perfil });
}

beforeEach(() => {
  vi.clearAllMocks();
  authStore.erro = '';
  authStore.perfil = null;
  m.signInWithCredential.mockResolvedValue({ user: usuario });
});

describe('entrarComApple: sucesso', () => {
  it('envia à Apple o SHA-256 (hex minúsculo) do rawNonce entregue ao Firebase', async () => {
    perfilAindaNaoExiste();
    m.invoke.mockResolvedValue({ identityToken: TOKEN, givenName: 'Ana', familyName: 'Souza' });

    await authStore.entrarComApple();

    const [comando, args] = m.invoke.mock.calls[0]!;
    expect(comando).toBe('plugin:sign-in-with-apple|get_apple_id_credential');
    expect(args.payload.scope).toEqual(['fullName', 'email']);

    const { idToken, rawNonce } = m.credential.mock.calls[0]![0];
    expect(idToken).toBe(TOKEN);
    expect(rawNonce).toMatch(/^[0-9A-Za-z\-._]{32}$/);
    expect(args.payload.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(args.payload.nonce).toBe(createHash('sha256').update(rawNonce).digest('hex'));
    expect(authStore.erro).toBe('');
  });

  it('cada tentativa usa um nonce novo', async () => {
    perfilJaExiste();
    m.invoke.mockResolvedValue({ identityToken: TOKEN, givenName: null, familyName: null });
    await authStore.entrarComApple();
    await authStore.entrarComApple();
    const [a, b] = m.credential.mock.calls.map((c) => c[0].rawNonce);
    expect(a).not.toBe(b);
  });

  it('primeira autorização: grava o nome informado pela Apple como cliente', async () => {
    perfilAindaNaoExiste();
    m.invoke.mockResolvedValue({ identityToken: TOKEN, givenName: 'Ana', familyName: 'Souza' });
    await authStore.entrarComApple();

    expect(m.setDoc).toHaveBeenCalledTimes(1);
    expect(m.setDoc.mock.calls[0]![0]).toEqual({ caminho: 'users/u1' });
    expect(m.setDoc.mock.calls[0]![1]).toEqual({
      nome: 'Ana Souza',
      email: 'a@x.com',
      role: 'cliente',
      condominioId: null
    });
    expect(authStore.perfil?.role).toBe('cliente');
  });

  it('primeira autorização sem nome (usuário ocultou): usa displayName ou "Cliente"', async () => {
    perfilAindaNaoExiste();
    m.invoke.mockResolvedValue({ identityToken: TOKEN, givenName: null, familyName: null });
    await authStore.entrarComApple();
    expect((m.setDoc.mock.calls[0]![1] as { nome: string }).nome).toBe('Cliente');
  });

  it('só o nome próprio informado: não deixa "undefined" no nome', async () => {
    perfilAindaNaoExiste();
    m.invoke.mockResolvedValue({ identityToken: TOKEN, givenName: 'Ana', familyName: null });
    await authStore.entrarComApple();
    expect((m.setDoc.mock.calls[0]![1] as { nome: string }).nome).toBe('Ana');
  });

  it('logins seguintes (Apple não reenvia nome/e-mail): não sobrescreve o perfil existente', async () => {
    perfilJaExiste();
    m.invoke.mockResolvedValue({ identityToken: TOKEN, givenName: null, familyName: null });
    await authStore.entrarComApple();
    expect(m.setDoc).not.toHaveBeenCalled();
    expect(authStore.perfil?.nome).toBe('Ana Souza');
  });

  it('e-mail vem do Firebase (o do token da Apple não é usado para o perfil)', async () => {
    perfilAindaNaoExiste();
    m.invoke.mockResolvedValue({ identityToken: TOKEN, givenName: 'Ana', familyName: 'S', email: 'outro@x.com' });
    await authStore.entrarComApple();
    expect((m.setDoc.mock.calls[0]![1] as { email: string }).email).toBe('a@x.com');
  });
});

describe('entrarComApple: falhas', () => {
  it('cancelamento: mensagem amigável, não chama o Firebase e rejeita', async () => {
    m.invoke.mockRejectedValue(
      "The operation couldn't be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)"
    );
    await expect(authStore.entrarComApple()).rejects.toBeDefined();
    expect(authStore.erro).toBe('Login cancelado.');
    expect(m.signInWithCredential).not.toHaveBeenCalled();
  });

  it('plugin ausente (fora do iPhone)', async () => {
    m.invoke.mockRejectedValue('Command get_apple_id_credential not found');
    await expect(authStore.entrarComApple()).rejects.toBeDefined();
    expect(authStore.erro).toMatch(/só está disponível no app para iPhone/);
  });

  it('token ausente: erro claro e sem chamar o Firebase', async () => {
    m.invoke.mockResolvedValue({ identityToken: null, givenName: null, familyName: null });
    await expect(authStore.entrarComApple()).rejects.toBeDefined();
    expect(authStore.erro).toContain('A Apple não devolveu a credencial.');
    expect(authStore.erro).toContain('apple/sem-token');
    expect(m.signInWithCredential).not.toHaveBeenCalled();
  });

  it('Firebase recusa (auth/invalid-credential): mostra o código real, NÃO "e-mail ou senha"', async () => {
    m.invoke.mockResolvedValue({ identityToken: TOKEN, givenName: null, familyName: null });
    m.signInWithCredential.mockRejectedValue({ code: 'auth/invalid-credential' });
    await expect(authStore.entrarComApple()).rejects.toBeDefined();
    expect(authStore.erro).toContain('auth/invalid-credential');
    expect(authStore.erro).not.toMatch(/e-mail ou senha/i);
  });

  it('erro de rede do Firebase', async () => {
    m.invoke.mockResolvedValue({ identityToken: TOKEN, givenName: null, familyName: null });
    m.signInWithCredential.mockRejectedValue({ code: 'auth/network-request-failed' });
    await expect(authStore.entrarComApple()).rejects.toBeDefined();
    expect(authStore.erro).toContain('auth/network-request-failed');
  });

  it('não deixa o erro anterior grudado em um login que dá certo', async () => {
    authStore.erro = 'erro antigo';
    perfilJaExiste();
    m.invoke.mockResolvedValue({ identityToken: TOKEN, givenName: null, familyName: null });
    await authStore.entrarComApple();
    expect(authStore.erro).toBe('');
  });
});
