// Login do painel web com o Firebase JS SDK (popup do Google). Só é usado no build web.
import { GoogleAuthProvider, browserPopupRedirectResolver, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '$lib/firebase';

// O auth do app é criado sem resolver (o WebView do Tauri trava com ele); no navegador o
// resolver é passado só na chamada do popup, então auth.svelte.ts e firebase.ts não mudam.
export async function entrarComGoogleWeb() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider, browserPopupRedirectResolver);
}

export const sairWeb = () => signOut(auth);
