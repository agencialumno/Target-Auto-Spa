import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Plugin nativo, Firebase e Firestore são substituídos por mocks (o fluxo real só roda no aparelho)
const m = vi.hoisted(() => ({
  signInWithCredential: vi.fn(),
  googleCredential: vi.fn((idToken: string, accessToken?: string) => ({ tipo: 'credencial-google', idToken, accessToken })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  invoke: vi.fn(),
  cfg: { ios: 'ios-123.apps.googleusercontent.com', web: 'web-456.apps.googleusercontent.com' }
}));

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithCredential: m.signInWithCredential,
  GoogleAuthProvider: { credential: m.googleCredential },
  OAuthProvider: class {
    credential = vi.fn();
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
vi.mock('./config', () => ({
  DEPURACAO: false,
  API_BASE: 'x',
  get GOOGLE_IOS_CLIENT_ID() {
    return m.cfg.ios;
  },
  get GOOGLE_WEB_CLIENT_ID() {
    return m.cfg.web;
  }
}));

import { authStore } from './auth.svelte';

const jwt = (payload: object) =>
  ['h', Buffer.from(JSON.stringify(payload)).toString('base64url'), 's'].join('.');
const ID_TOKEN = jwt({ aud: 'ios-123.apps.googleusercontent.com', iss: 'https://accounts.google.com' });

const usuario = { uid: 'g1', displayName: 'Ana Souza' as string | null, email: 'ana@gmail.com' };
const perfil = { nome: 'Ana Souza', email: 'ana@gmail.com', role: 'cliente', condominioId: null };

function plataforma(ua: string) {
  vi.stubGlobal('navigator', { userAgent: ua });
}
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36';

function usuarioNovo() {
  let gravado = false;
  m.setDoc.mockImplementation(async () => {
    gravado = true;
  });
  m.getDoc.mockImplementation(async () => ({ exists: () => gravado, data: () => perfil }));
}

function usuarioExistente(dados: Record<string, unknown> = perfil) {
  m.getDoc.mockResolvedValue({ exists: () => true, data: () => dados });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.cfg.ios = 'ios-123.apps.googleusercontent.com';
  m.cfg.web = 'web-456.apps.googleusercontent.com';
  authStore.erro = '';
  authStore.perfil = null;
  plataforma(IPHONE);
  m.signInWithCredential.mockResolvedValue({ user: usuario });
  m.invoke.mockResolvedValue({ idToken: ID_TOKEN, accessToken: 'acesso-1' });
});

afterEach(() => vi.unstubAllGlobals());

describe('entrarComGoogle: sucesso', () => {
  it('iOS: usa o client ID iOS, pede openid/email/profile e entrega idToken+accessToken ao Firebase', async () => {
    usuarioExistente();
    await authStore.entrarComGoogle();

    const [comando, args] = m.invoke.mock.calls[0];
    expect(comando).toBe('plugin:google-auth|sign_in');
    expect(args.payload.clientId).toBe('ios-123.apps.googleusercontent.com');
    expect(args.payload.scopes).toEqual(['openid', 'email', 'profile']);

    expect(m.googleCredential).toHaveBeenCalledWith(ID_TOKEN, 'acesso-1');
    expect(m.signInWithCredential).toHaveBeenCalledTimes(1);
    expect(m.signInWithCredential.mock.calls[0][1]).toMatchObject({ tipo: 'credencial-google' });
    expect(authStore.erro).toBe('');
  });

  it('Android: usa o client ID de aplicativo da Web', async () => {
    plataforma(ANDROID);
    usuarioExistente();
    await authStore.entrarComGoogle();
    expect(m.invoke.mock.calls[0][1].payload.clientId).toBe('web-456.apps.googleusercontent.com');
  });

  it('sem accessToken ainda funciona (só idToken)', async () => {
    usuarioExistente();
    m.invoke.mockResolvedValue({ idToken: ID_TOKEN, accessToken: null });
    await authStore.entrarComGoogle();
    expect(m.googleCredential).toHaveBeenCalledWith(ID_TOKEN, undefined);
  });
});

describe('entrarComGoogle: usuário novo e existente', () => {
  it('novo: cria perfil de cliente, sem condomínio, com o nome do Google', async () => {
    usuarioNovo();
    await authStore.entrarComGoogle();

    expect(m.setDoc).toHaveBeenCalledTimes(1);
    expect(m.setDoc.mock.calls[0][0]).toEqual({ caminho: 'users/g1' });
    expect(m.setDoc.mock.calls[0][1]).toEqual({
      nome: 'Ana Souza',
      email: 'ana@gmail.com',
      role: 'cliente',
      condominioId: null
    });
    expect(authStore.perfil?.role).toBe('cliente');
  });

  it('novo sem nome no Google: usa "Cliente"', async () => {
    usuarioNovo();
    m.signInWithCredential.mockResolvedValue({ user: { ...usuario, displayName: null } });
    await authStore.entrarComGoogle();
    expect(m.setDoc.mock.calls[0][1].nome).toBe('Cliente');
  });

  it('existente: não sobrescreve o perfil (papel e condomínio ficam como estão)', async () => {
    usuarioExistente({ nome: 'Gui', email: 'gui@x.com', role: 'gerente', condominioId: 'torre-10' });
    await authStore.entrarComGoogle();
    expect(m.setDoc).not.toHaveBeenCalled();
    expect(authStore.perfil?.role).toBe('gerente');
    expect(authStore.perfil?.condominioId).toBe('torre-10');
  });
});

describe('entrarComGoogle: falhas', () => {
  it('cancelamento no Android: mensagem amigável e não chama o Firebase', async () => {
    plataforma(ANDROID);
    m.invoke.mockRejectedValue('Sign-in cancelled: activity is cancelled by the user');
    await expect(authStore.entrarComGoogle()).rejects.toBeDefined();
    expect(authStore.erro).toBe('Login cancelado.');
    expect(m.signInWithCredential).not.toHaveBeenCalled();
  });

  it('cancelamento no iOS (ASWebAuthenticationSession error 1)', async () => {
    m.invoke.mockRejectedValue(
      "The operation couldn't be completed. (com.apple.AuthenticationServices.WebAuthenticationSession error 1.)"
    );
    await expect(authStore.entrarComGoogle()).rejects.toBeDefined();
    expect(authStore.erro).toBe('Login cancelado.');
    expect(m.signInWithCredential).not.toHaveBeenCalled();
  });

  it('plugin ausente (fora do app nativo)', async () => {
    m.invoke.mockRejectedValue('Command sign_in not found');
    await expect(authStore.entrarComGoogle()).rejects.toBeDefined();
    expect(authStore.erro).toMatch(/só está disponível no app/);
  });

  it('token ausente: erro claro, com código, sem chamar o Firebase', async () => {
    m.invoke.mockResolvedValue({ idToken: null, accessToken: 'x' });
    await expect(authStore.entrarComGoogle()).rejects.toBeDefined();
    expect(authStore.erro).toContain('O Google não devolveu a credencial.');
    expect(authStore.erro).toContain('google/sem-token');
    expect(m.signInWithCredential).not.toHaveBeenCalled();
  });

  it('client ID não configurado: avisa e nem abre o login nativo', async () => {
    m.cfg.ios = '';
    await expect(authStore.entrarComGoogle()).rejects.toBeDefined();
    expect(authStore.erro).toContain('ainda não configurado');
    expect(authStore.erro).toContain('google/nao-configurado');
    expect(m.invoke).not.toHaveBeenCalled();
  });

  it('Firebase recusa (auth/invalid-credential): mostra o código real, NÃO "e-mail ou senha"', async () => {
    m.signInWithCredential.mockRejectedValue({ code: 'auth/invalid-credential' });
    await expect(authStore.entrarComGoogle()).rejects.toBeDefined();
    expect(authStore.erro).toContain('auth/invalid-credential');
    expect(authStore.erro).not.toMatch(/e-mail ou senha/i);
  });

  it('conta já existe com outro método de login', async () => {
    m.signInWithCredential.mockRejectedValue({ code: 'auth/account-exists-with-different-credential' });
    await expect(authStore.entrarComGoogle()).rejects.toBeDefined();
    expect(authStore.erro).toContain('outro método de login');
    expect(authStore.erro).toContain('auth/account-exists-with-different-credential');
  });

  it('erro de rede do Firebase', async () => {
    m.signInWithCredential.mockRejectedValue({ code: 'auth/network-request-failed' });
    await expect(authStore.entrarComGoogle()).rejects.toBeDefined();
    expect(authStore.erro).toContain('auth/network-request-failed');
  });

  it('erro nativo desconhecido mostra o código genérico', async () => {
    m.invoke.mockRejectedValue('falha estranha');
    await expect(authStore.entrarComGoogle()).rejects.toBeDefined();
    expect(authStore.erro).toContain('google/erro');
  });

  it('login que dá certo limpa o erro anterior', async () => {
    authStore.erro = 'erro antigo';
    usuarioExistente();
    await authStore.entrarComGoogle();
    expect(authStore.erro).toBe('');
  });
});
