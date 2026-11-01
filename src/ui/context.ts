import type { Hex } from '../contract/campuschain';
import type { Hub, Result, WriteRequest } from '../hub/hub';

/** Lo que recibe cada pantalla. */
export interface Ctx {
  hub: Hub;
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
