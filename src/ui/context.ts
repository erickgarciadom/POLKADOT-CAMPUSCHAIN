import type { Hub } from '../hub/hub';
import type { CampusData } from '../shared/datasource';
import type { Direccion, Sesion } from '../shared/types';

/** Lo que recibe cada pantalla. */
export interface Ctx {
  /** Estado de la conexión con el Host (cuenta, popup de firmas). Los datos van por `data`. */
  hub: Hub;
  /** Lecturas y escrituras: reales (contrato + Firebase) o de ejemplo en modo mock. */
  data: CampusData;
  /** Usuario con sesión iniciada (correo @uanl.edu.mx). */
  usuario: Sesion;
  /** Cierra la sesión y vuelve al inicio de sesión. */
  salir(): void;
  /** Tu cuenta H160, o null sin conectar. */
  me: Direccion | null;
  go(path: string): void;
  /** Vuelve a dibujar la pantalla actual con datos nuevos. */
  refresh(): void;
  toast(message: string, tone?: 'ok' | 'error'): void;
  /** Conecta si hace falta. true si ya hay cuenta. */
  ensureAccount(): Promise<boolean>;
}
