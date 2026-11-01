import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/*
 * Configuración web del proyecto de Firebase campuschain-1e093. No es secreta: Firebase la manda
 * a cada navegador. Lo que protege los datos son las reglas de firestore.rules.
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAVIfecFAhGM3JqWxIMJ6y-4WG_GoyfD4M',
  authDomain: 'campuschain-1e093.firebaseapp.com',
  projectId: 'campuschain-1e093',
  appId: '1:98185186889:web:f8b437540ed127ba1b7998',
} as const;

let instancia: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

/** Se inicia la primera vez que se usa, así los tests de lógica no cargan Firebase. */
export function firebase() {
  if (!instancia) {
    const app = initializeApp(FIREBASE_CONFIG);
    instancia = { app, auth: getAuth(app), db: getFirestore(app) };
  }
  return instancia;
}
