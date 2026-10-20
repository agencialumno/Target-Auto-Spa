import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { depuracao } from "./debug.svelte";
import { invoke } from "@tauri-apps/api/core";
import { gerarNonce, sha256Hex } from "./nonce";

// Erros do plugin chegam como texto (reject do Swift), não como { code }
function erroApple(e: any): string {
  if (e?.code) return e.code;
  const msg = String(e?.message ?? e ?? "");
  // 1001 = ASAuthorizationError.canceled
  if (/1001|canceled|cancelled/i.test(msg)) return "apple/cancelado";
  if (/not allowed|command .* not found|plugin/i.test(msg)) return "apple/indisponivel";
  return "apple/erro";
}

const TIMEOUT_MS = 15000;

// Evita o botão preso em "Aguarde..." quando o Firebase nunca responde
function comTimeout<T>(promessa: Promise<T>, etapa: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject({ code: `timeout/${etapa}` }), TIMEOUT_MS);
    promessa.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export type Papel = "cliente" | "gerente" | "admin" | "insulfilm";

export type Perfil = {
  nome: string;
  email: string;
  role: Papel;
  condominioId: string | null;
};

class Auth {
  usuario = $state<User | null>(null);
  perfil = $state<Perfil | null>(null);
  carregando = $state(true);
  erro = $state("");

  constructor() {
    onAuthStateChanged(auth, async (user) => {
      this.usuario = user;
      if (user) {
        this.perfil = await this.buscarPerfil(user.uid);
      } else {
        this.perfil = null;
      }
      this.carregando = false;
    });
  }

  private async buscarPerfil(uid: string): Promise<Perfil | null> {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as Perfil) : null;
  }

  async cadastrar(nome: string, email: string, senha: string) {
    this.erro = "";
    try {
      depuracao.registrar("cadastrar: criando conta");
      const cred = await comTimeout(
        createUserWithEmailAndPassword(auth, email, senha),
        "criar-conta",
      );
      depuracao.registrar("cadastrar: conta criada, gravando perfil");
      await comTimeout(
        setDoc(doc(db, "users", cred.user.uid), {
          nome,
          email,
          role: "cliente",
          condominioId: null,
        }),
        "gravar-perfil",
      );
      this.perfil = await comTimeout(this.buscarPerfil(cred.user.uid), "ler-perfil");
      depuracao.registrar("cadastrar: ok");
    } catch (e: any) {
      this.erro = traduzErro(e?.code);
      depuracao.registrar(`erro: ${e?.code ?? ""} ${e?.message ?? ""}`);
      throw e;
    }
  }

  async entrar(email: string, senha: string) {
    this.erro = "";
    try {
      depuracao.registrar("entrar: enviando credenciais");
      await comTimeout(signInWithEmailAndPassword(auth, email, senha), "entrar");
      depuracao.registrar("entrar: ok");
    } catch (e: any) {
      this.erro = traduzErro(e?.code);
      depuracao.registrar(`erro: ${e?.code ?? ""} ${e?.message ?? ""}`);
      throw e;
    }
  }

  // Google e Apple usam signInWithPopup, que não funciona no WebView do Tauri/iOS.
  // Precisam de outro fluxo (signInWithRedirect com URL scheme customizado, ou plugin nativo de OAuth).
  async entrarComGoogle() {
    this.erro = "";
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await this.garantirPerfil(cred.user);
    } catch (e: any) {
      this.erro = traduzErro(e.code);
      throw e;
    }
  }

  // "Sign in with Apple" nativo (plugin tauri-plugin-sign-in-with-apple, só iOS):
  // a Apple recebe o SHA-256 do nonce e o Firebase recebe o nonce original.
  async entrarComApple() {
    this.erro = "";
    try {
      const rawNonce = gerarNonce();
      const nonce = await sha256Hex(rawNonce);
      depuracao.registrar("apple: abrindo folha nativa");

      // Sem timeout aqui: a pessoa pode demorar na folha da Apple
      const apple = await invoke<{
        identityToken: string | null;
        givenName: string | null;
        familyName: string | null;
      }>("plugin:sign-in-with-apple|get_apple_id_credential", {
        payload: { scope: ["fullName", "email"], nonce },
      });
      if (!apple.identityToken) {
        throw { code: "apple/sem-token" };
      }

      const credencial = new OAuthProvider("apple.com").credential({
        idToken: apple.identityToken,
        rawNonce,
      });
      const cred = await comTimeout(
        signInWithCredential(auth, credencial),
        "apple",
      );
      // A Apple só informa o nome na primeira autorização
      const nome = [apple.givenName, apple.familyName]
        .filter(Boolean)
        .join(" ")
        .trim();
      await comTimeout(this.garantirPerfil(cred.user, nome), "apple-perfil");
      depuracao.registrar("apple: ok");
    } catch (e: any) {
      const codigo = erroApple(e);
      this.erro = traduzErro(codigo);
      depuracao.registrar(`erro apple: ${codigo} ${e?.message ?? e}`);
      throw e;
    }
  }

  // Google/Apple podem ser o primeiro login: cria o perfil de cliente se ainda não existir
  private async garantirPerfil(user: User, nomeInformado = "") {
    const existente = await this.buscarPerfil(user.uid);
    if (!existente) {
      await setDoc(doc(db, "users", user.uid), {
        nome: nomeInformado || user.displayName || "Cliente",
        email: user.email ?? "",
        role: "cliente",
        condominioId: null,
      });
    }
    this.perfil = await this.buscarPerfil(user.uid);
  }

  async sair() {
    await signOut(auth);
    // Limpa já, sem esperar o onAuthStateChanged: quem navega para "/" logo depois do
    // sair() não pode ainda enxergar o usuário e o perfil antigos
    this.usuario = null;
    this.perfil = null;
    this.erro = "";
  }

  // Busca o condomínio pelo nome (case-insensitive simples) e vincula ao usuário logado
  async entrarNoCondominio(
    nomeBuscado: string,
  ): Promise<"ok" | "nao-encontrado"> {
    if (!this.usuario) throw new Error("Não autenticado");
    const nomeNormalizado = nomeBuscado.trim().toLowerCase();
    const q = query(
      collection(db, "condominios"),
      where("nomeNormalizado", "==", nomeNormalizado),
      limit(1),
    );
    const snap = await getDocs(q);

    // TEMPORÁRIO: qualquer nome de condomínio é aceito até definirmos a regra certa.
    // Se não existir em `condominios`, usa o nome normalizado como condominioId.
    // Para voltar a exigir cadastro prévio: `if (snap.empty) return "nao-encontrado";`
    const condominioId = snap.empty ? nomeNormalizado : snap.docs[0].id;
    await updateDoc(doc(db, "users", this.usuario.uid), { condominioId });
    this.perfil = await this.buscarPerfil(this.usuario.uid);
    return "ok";
  }
}

function traduzErro(codigo?: string) {
  const mapa: Record<string, string> = {
    "auth/email-already-in-use": "Este e-mail já tem uma conta.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/popup-closed-by-user": "Login cancelado.",
    "apple/cancelado": "Login cancelado.",
    "apple/indisponivel": "Entrar com Apple só está disponível no app para iPhone.",
    "apple/sem-token": "A Apple não devolveu a credencial. Tente novamente.",
    "auth/network-request-failed": "Sem conexão com o Firebase. Verifique a internet.",
  };
  if (codigo?.startsWith("timeout/")) {
    return `Tempo esgotado ao falar com o Firebase (${codigo}).`;
  }
  const texto = mapa[codigo ?? ""];
  if (texto) return texto;
  return `Não foi possível completar. Tente novamente. (${codigo ?? "erro desconhecido"})`;
}

export const authStore = new Auth();
