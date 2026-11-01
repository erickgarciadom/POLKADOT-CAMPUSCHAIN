/*
 * Productos que su vendedor borró. El contrato no puede borrar un producto: «Borrar» lo marca no
 * disponible en la cadena (setAvailable false, solo el vendedor puede) y aquí se guarda que fue un
 * borrado y no una pausa, para que ya no aparezca en «Mis productos» ni se pueda reactivar desde la app.
 * Va en usuarios/{uid}/borrados/{id}: solo el dueño de la sesión lo lee y lo escribe.
 */
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { USUARIOS } from './auth';
import { firebase } from './config';

const ruta = (uid: string) => collection(firebase().db, USUARIOS, uid, 'borrados');

export async function marcarBorrado(uid: string, productId: bigint, vendedor: string): Promise<void> {
  await setDoc(doc(ruta(uid), productId.toString()), { vendedor: vendedor.toLowerCase(), borradoEn: serverTimestamp() });
}

/** Ids (como texto) de los productos que este usuario borró. */
export async function productosBorrados(uid: string): Promise<Set<string>> {
  const snap = await getDocs(ruta(uid));
  return new Set(snap.docs.map((d) => d.id));
}
