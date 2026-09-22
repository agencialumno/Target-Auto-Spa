import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
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
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      await setDoc(doc(db, "users", cred.user.uid), {
        nome,
        email,
        role: "cliente",
        condominioId: null,
      });
      this.perfil = await this.buscarPerfil(cred.user.uid);
    } catch (e: any) {
      this.erro = traduzErro(e.code);
      throw e;
    }
  }

  async entrar(email: string, senha: string) {
    this.erro = "";
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (e: any) {
      this.erro = traduzErro(e.code);
      throw e;
    }
  }

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

  async entrarComApple() {
    this.erro = "";
    try {
      const provider = new OAuthProvider("apple.com");
      const cred = await signInWithPopup(auth, provider);
      await this.garantirPerfil(cred.user);
    } catch (e: any) {
      this.erro = traduzErro(e.code);
      throw e;
    }
  }

  // Google/Apple podem ser o primeiro login: cria o perfil de cliente se ainda não existir
  private async garantirPerfil(user: User) {
    const existente = await this.buscarPerfil(user.uid);
    if (!existente) {
      await setDoc(doc(db, "users", user.uid), {
        nome: user.displayName ?? "Cliente",
        email: user.email ?? "",
        role: "cliente",
        condominioId: null,
      });
    }
    this.perfil = await this.buscarPerfil(user.uid);
  }

  async sair() {
    await signOut(auth);
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
    if (snap.empty) return "nao-encontrado";

    const condominioId = snap.docs[0].id;
    await updateDoc(doc(db, "users", this.usuario.uid), { condominioId });
    this.perfil = await this.buscarPerfil(this.usuario.uid);
    return "ok";
  }
}

function traduzErro(codigo: string) {
  const mapa: Record<string, string> = {
    "auth/email-already-in-use": "Este e-mail já tem uma conta.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/popup-closed-by-user": "Login cancelado.",
  };
  return mapa[codigo] ?? "Não foi possível completar. Tente novamente.";
}

export const authStore = new Auth();
