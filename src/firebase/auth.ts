/*
 * Registro e inicio de sesión con correo y contraseña (Firebase Auth). Cada registro deja un
 * documento usuarios/{uid}; al iniciar sesión se comprueba que ese registro exista y sea del mismo
 * correo. Firebase guarda la contraseña cifrada: la app nunca la escribe en Firestore.
 */
import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebase } from './config';
import { normalizarCorreo, validarCredenciales } from './registro';

export const USUARIOS = 'usuarios';

const MENSAJES: Record<string, string> = {
  'auth/email-already-in-use': 'Ese correo ya está registrado. Inicia sesión.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/weak-password': 'La contraseña es muy débil.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/network-request-failed': 'No hay conexión con Firebase. Revisa tu red.',
  'permission-denied': 'Firebase rechazó el registro. Usa tu correo @uanl.edu.mx.',
};

/** Texto para el usuario a partir de un error de Firebase. */
export function mensajeFirebase(error: unknown): string {
  if (error instanceof FirebaseError) return MENSAJES[error.code] ?? `Error de Firebase (${error.code}).`;
  return error instanceof Error ? error.message : String(error);
}

/** Filtro 1: correo @uanl.edu.mx y contraseña no vacía. Crea la cuenta y su registro. */
export async function registrar(correo: string, password: string): Promise<User> {
  const motivo = validarCredenciales(correo, password);
  if (motivo) throw new Error(motivo);
  const { auth, db } = firebase();
  try {
    const { user } = await createUserWithEmailAndPassword(auth, normalizarCorreo(correo), password);
    try {
      await setDoc(doc(db, USUARIOS, user.uid), { email: user.email, creadoEn: serverTimestamp() });
    } catch (error) {
      // Sin registro en la base el login fallaría: se borra la cuenta para poder intentar de nuevo.
      await deleteUser(user).catch(() => undefined);
      throw error;
    }
    return user;
  } catch (error) {
    throw new Error(mensajeFirebase(error));
  }
}

/** ¿El usuario tiene su registro en usuarios/{uid} con el mismo correo? */
async function tieneRegistro(user: User): Promise<boolean> {
  const snap = await getDoc(doc(firebase().db, USUARIOS, user.uid));
  return snap.exists() && snap.data().email === user.email;
}

/** Filtro 2: compara lo que se escribe con lo registrado (Auth) y con el registro en la base. */
export async function iniciarSesion(correo: string, password: string): Promise<User> {
  const motivo = validarCredenciales(correo, password);
  if (motivo) throw new Error(motivo);
  const { auth } = firebase();
  try {
    const { user } = await signInWithEmailAndPassword(auth, normalizarCorreo(correo), password);
    if (!(await tieneRegistro(user))) {
      await signOut(auth);
      throw new Error('Tu cuenta no tiene registro en la base de datos. Regístrate de nuevo.');
    }
    return user;
  } catch (error) {
    throw new Error(mensajeFirebase(error));
  }
}

/** Sesión que Firebase recuerda de una visita anterior, ya comprobada contra la base. */
export async function sesionGuardada(): Promise<User | null> {
  const { auth } = firebase();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  if (await tieneRegistro(user).catch(() => false)) return user;
  await signOut(auth);
  return null;
}

export const cerrarSesion = () => signOut(firebase().auth);

export const usuarioActual = (): User | null => firebase().auth.currentUser;
