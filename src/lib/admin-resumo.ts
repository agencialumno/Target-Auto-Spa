import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from './firebase';

// Contagens para as linhas de contexto dos cartões da tela inicial do admin (só leitura)
export async function contarUsuarios(): Promise<number> {
  return (await getCountFromServer(collection(db, 'users'))).data().count;
}

export async function contarCondominios(): Promise<number> {
  return (await getCountFromServer(collection(db, 'condominios'))).data().count;
}

export const plural = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;
