import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCZ-jCllQs0VDOW7dI_By2lie8BlYe8JOk",
  authDomain: "target-auto-spa-33842.firebaseapp.com",
  projectId: "target-auto-spa-33842",
  storageBucket: "target-auto-spa-33842.firebasestorage.app",
  messagingSenderId: "922031193937",
  appId: "1:922031193937:web:f0a81745a2275242079d70",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
