/**
 * Un solo lugar que convierte una transacción fallida en: qué pasó (en español), por qué y qué
 * debe hacer la app. Todas las escrituras pasan por aquí, así que un fallo nuevo se atiende una vez.
 */

export type TxErrorKind =
  /** El usuario canceló o rechazó la firma en el teléfono. */
  | 'rejected'
  /** Invalid.Payment y a la cuenta de verdad le falta PGAS. */
  | 'no-gas'
  /** Invalid.Payment aunque la cuenta tiene PGAS: la Polkadot App armó mal la comisión. */
  | 'host-payment'
  /** Revive StorageDepositNotEnoughFunds: la cuenta no tiene PAS para el depósito de almacenamiento. */
  | 'no-deposit'
  /** Stale / Future / nonce o vigencia desfasados: la sesión de firma se desfasó. */
  | 'session'
  /** Sin respuesta a tiempo (la tx pudo haber entrado). */
  | 'timeout'
  /** Se cayó la conexión con el Host o la cadena. */
  | 'connection'
  /** Cualquier otra cosa. */
  | 'other';

/** Lo que ofrece la ventana de error. */
export type TxAction = 'retry' | 'reconnect' | 'gas' | 'reload';

export interface TxProblem {
  kind: TxErrorKind;
  message: string;
  /** En orden de preferencia; el primero es el botón principal. */
  actions: TxAction[];
  /** Texto crudo del error, para «Copiar detalles». */
  raw: string;
}

const text = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)) ?? String(error);
  } catch {
    return String(error);
  }
};

/*
 * Guardar datos nuevos en un contrato cobra un depósito de almacenamiento en PAS, aparte de la
 * comisión. El PGAS del Host paga la comisión, no el depósito.
 */
export const NO_DEPOSIT = /StorageDepositNotEnoughFunds/;
export const NO_DEPOSIT_MESSAGE =
  'Tu cuenta no tiene PAS para el depósito de almacenamiento. En Cuenta copia tu dirección SS58, pide PAS en faucet.polkadot.io (Paseo → Asset Hub) y reintenta.';

const PAYMENT = /Invalid\.?\s*Payment/i;
const SESSION = /Invalid\.?\s*(Stale|Future|AncientBirthBlock|BadProof|BadSigner)|\bnonce\b|outdated/i;
const REJECTED = /reject|denied|cancel|declin|user (refused|closed)|SigningRejected/i;
const TIMEOUT = /sin respuesta en|timed? ?out|TxTimeout/i;
const CONNECTION = /disconnect|not connected|websocket|socket|network|Host provider|connection (closed|lost)|ECONN|fetch failed/i;

/**
 * @param pgas Saldo PGAS en unidades base leído justo ahora (null = desconocido).
 * @param low  Saldo debajo del cual un fallo de pago significa «sin PGAS».
 */
export function classifyTxError(error: unknown, pgas: bigint | null, low: bigint, formatPgas: (v: bigint) => string): TxProblem {
  const raw = text(error);
  if (NO_DEPOSIT.test(raw)) return { kind: 'no-deposit', message: NO_DEPOSIT_MESSAGE, actions: ['retry'], raw };
  if (PAYMENT.test(raw)) {
    if (pgas !== null && pgas >= low) {
      return {
        kind: 'host-payment',
        message: `Tienes ${formatPgas(pgas)} PGAS, pero la Polkadot App no aplicó el pago de la comisión. Reconecta y reintenta; si se repite, actualiza la Polkadot App.`,
        actions: ['reconnect', 'reload'],
        raw,
      };
    }
    return {
      kind: 'no-gas',
      message: pgas === null
        ? 'La red rechazó el pago de la comisión. Pide gas (PGAS) y reintenta.'
        : `Te quedan ${formatPgas(pgas)} PGAS: no alcanza para la comisión. Pide más gas y reintenta.`,
      actions: ['gas', 'reconnect'],
      raw,
    };
  }
  if (SESSION.test(raw)) {
    return { kind: 'session', message: 'La sesión de firma se desfasó de la red. Reconecta y reintenta.', actions: ['reconnect', 'reload'], raw };
  }
  if (REJECTED.test(raw)) {
    return { kind: 'rejected', message: 'No se aprobó la firma en la Polkadot App. Puedes intentarlo otra vez.', actions: ['retry'], raw };
  }
  if (TIMEOUT.test(raw)) {
    return {
      kind: 'timeout',
      message: 'La Polkadot App no respondió a tiempo. Revisa tu teléfono; si no ves la solicitud, reconecta y reintenta.',
      actions: ['retry', 'reconnect'],
      raw,
    };
  }
  if (CONNECTION.test(raw)) {
    return { kind: 'connection', message: 'Se perdió la conexión con la Polkadot App. Reconecta y reintenta.', actions: ['reconnect', 'reload'], raw };
  }
  return { kind: 'other', message: raw.replace(/^Error:\s*/, ''), actions: ['retry', 'reconnect'], raw };
}

/** Estos se pueden resolver reconectando una vez en automático, antes de mostrar el error. */
export const autoReconnect = (kind: TxErrorKind) => kind === 'host-payment' || kind === 'session' || kind === 'connection';
