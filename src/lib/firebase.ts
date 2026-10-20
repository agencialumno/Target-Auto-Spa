import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCZ-jCllQs0VDOW7dI_By2lie8BlYe8JOk",
  authDomain: "target-auto-spa-33842.firebaseapp.com",
  projectId: "target-auto-spa-33842",
  storageBucket: "target-auto-spa-33842.firebasestorage.app",
  messagingSenderId: "922031193937",
  appId: "1:922031193937:web:f0a81745a2275242079d70",
};

export const firebaseApp = initializeApp(firebaseConfig);
// No WebView do Tauri/iOS o getAuth() trava: ele carrega o popupRedirectResolver (iframe em
// firebaseapp.com) e espera por ele. Inicializamos sem resolver; as persistências são tentadas
// em ordem caso o IndexedDB não esteja disponível.
function criarAuth() {
  try {
    return initializeAuth(firebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
    });
  } catch {
    // Já inicializado (recarga a quente em desenvolvimento)
    return getAuth(firebaseApp);
  }
}

export const auth = criarAuth();
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
// Mesma região de functions/index.js
export const functions = getFunctions(firebaseApp, "southamerica-east1");
