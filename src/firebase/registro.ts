/*
 * Reglas del registro, sin Firebase para poder probarlas. firestore.rules repite el dominio del
 * correo del lado del servidor: si cambias DOMINIO_UANL, cambia también la regla.
 */

export const DOMINIO_UANL = '@uanl.edu.mx';

/** Firebase Auth exige al menos 6 caracteres. */
export const MIN_PASSWORD = 6;

export const normalizarCorreo = (correo: string) => correo.trim().toLowerCase();

/** Una sola @, usuario sin espacios y dominio exacto uanl.edu.mx. */
export function esCorreoUanl(correo: string): boolean {
  const c = normalizarCorreo(correo);
  if (!c.endsWith(DOMINIO_UANL)) return false;
  const usuario = c.slice(0, -DOMINIO_UANL.length);
  return usuario.length > 0 && !/[@\s]/.test(usuario);
}

/** null si el correo y la contraseña sirven; si no, el motivo para el usuario. */
export function validarCredenciales(correo: string, password: string): string | null {
  if (!esCorreoUanl(correo)) return `Usa tu correo institucional que termina en ${DOMINIO_UANL}.`;
  if (password.trim() === '') return 'La contraseña no puede quedar en blanco.';
  if (password.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  return null;
}
