import type { User } from 'firebase/auth';
import type { Hex } from '../contract/campuschain';
import type { Hub, Result, WriteRequest } from '../hub/hub';

/** Lo que recibe cada pantalla. */
export interface Ctx {
  hub: Hub;
  /** Usuario de Firebase con sesión iniciada (correo @uanl.edu.mx). */
  usuario: User;
  /** Cierra la sesión de Firebase y vuelve al inicio de sesión. */
  salir(): void;
  /** Tu cuenta H160, o null sin conectar. */
  me: Hex | null;
  go(path: string): void;
  /** Vuelve a dibujar la pantalla actual con datos nuevos. */
  refresh(): void;
  toast(message: string, tone?: 'ok' | 'error'): void;
  /** Conecta si hace falta. true si ya hay cuenta. */
  ensureAccount(): Promise<boolean>;
  /** Firma una escritura (conecta antes si hace falta). El popup de estados muestra el avance. */
  write(request: WriteRequest): Promise<Result>;
}
