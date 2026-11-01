/**
 * Estados visibles de cada interacción con el Host (conectar o firmar una acción del contrato).
 * Máquina pura: hub.ts la alimenta y el popup de estados solo la dibuja (ui/txPopup.ts).
 *
 * Qué estado sale de dónde (@parity/product-sdk 0.39.0 → product-sdk-tx 0.5.3, `onStatus` de `.tx()`):
 *  - REAL, de nuestro código: `simulando` (nuestro `.query()`), `actualizando` (nuestra relectura),
 *    `conectando` (sesión de firma + cuenta del Product) y `permiso-gas` (SmartContractAllowance).
 *  - REAL, del SDK: `enviando` ← onStatus('signing'), que llega DESPUÉS de aprobar en el teléfono;
 *    `confirmando` ← onStatus('broadcasting') y onStatus('in-block').
 *  - INFERIDO: `firma`. El SDK no avisa cuando el Host muestra la solicitud; se pone justo antes de `.tx()`.
 *  Nunca se marca `enviando` ni `confirmando` sin el evento del SDK.
 */
import type { TxErrorKind } from '../lib/txErrors';

export type ProgressOp = 'conectar' | 'firmar';

export type ProgressStep =
  | 'conectando'
  | 'permiso-gas'
  | 'simulando'
  | 'firma'
  | 'enviando'
  | 'confirmando'
  | 'actualizando'
  | 'listo'
  | 'error';

export interface Progress {
  op: ProgressOp;
  /** Qué se está firmando, para el título del popup («Aceptar pedido»). */
  title: string;
  step: ProgressStep;
  /** Pasos alcanzados, en orden y sin repetir. */
  reached: ProgressStep[];
  message: string;
  kind?: TxErrorKind;
}

export const PROGRESS_TEXT: Record<ProgressStep, string> = {
  conectando: 'Conectando tu cuenta…',
  'permiso-gas': 'Esperando el permiso de gas en tu teléfono…',
  simulando: 'Comprobando con el contrato…',
  firma: 'Esperando tu firma en el teléfono…',
  enviando: 'Enviando a la blockchain…',
  confirmando: 'Confirmando en la blockchain…',
  actualizando: 'Leyendo de la blockchain…',
  listo: 'Listo',
  error: 'No se pudo completar',
};

export const STEP_LABEL: Record<ProgressStep, string> = {
  conectando: 'Conectar cuenta',
  'permiso-gas': 'Permiso de gas',
  simulando: 'Simulación',
  firma: 'Firma en tu teléfono',
  enviando: 'Enviando',
  confirmando: 'Confirmando en la blockchain',
  actualizando: 'Releyendo el contrato',
  listo: 'Listo',
  error: 'Error',
};

export const STEPS: Record<ProgressOp, ProgressStep[]> = {
  conectar: ['conectando', 'permiso-gas'],
  firmar: ['simulando', 'firma', 'enviando', 'confirmando', 'actualizando'],
};

export const KIND_TITLE: Record<TxErrorKind, string> = {
  rejected: 'Firma rechazada o cancelada',
  timeout: 'Sin respuesta a tiempo',
  'no-gas': 'Sin gas',
  'no-deposit': 'Sin PAS para el depósito',
  'host-payment': 'Problema de conexión',
  session: 'Problema de conexión',
  connection: 'Problema de conexión',
  other: 'No se pudo completar',
};

const RESTART: readonly ProgressStep[] = ['firma', 'conectando', 'permiso-gas'];
const TERMINAL: readonly ProgressStep[] = ['listo', 'error'];

export function begin(op: ProgressOp, title: string): Progress {
  const step = STEPS[op][0]!;
  return { op, title, step, reached: [step], message: PROGRESS_TEXT[step] };
}

/** Avanza solo hacia adelante dentro del orden de la operación. Un paso hacia atrás se ignora. */
export function advance(p: Progress, step: ProgressStep): Progress {
  if (TERMINAL.includes(p.step)) return p;
  if (step === p.step) return p;
  const order = STEPS[p.op];
  const to = order.indexOf(step);
  const from = order.indexOf(p.step);
  const allowed = TERMINAL.includes(step) || RESTART.includes(step) || from === -1 || to === -1 || to >= from;
  if (!allowed) return p;
  const kept = to === -1 ? p.reached : p.reached.filter((s) => order.indexOf(s) === -1 || order.indexOf(s) < to);
  const reached = kept.includes(step) || TERMINAL.includes(step) ? kept : [...kept, step];
  return { ...p, step, reached, message: PROGRESS_TEXT[step] };
}

export function finish(p: Progress, result: { ok: true; message: string } | { ok: false; message: string; kind?: TxErrorKind }): Progress {
  if (result.ok) return { ...p, step: 'listo', message: result.message };
  const done: Progress = { op: p.op, title: p.title, step: 'error', reached: p.reached, message: result.message };
  if (result.kind) done.kind = result.kind;
  return done;
}

/** Estado del SDK (`onStatus`) → paso visible. Lo que no sabemos mostrar con verdad da null. */
export function stepForSdkStatus(status: unknown): ProgressStep | null {
  if (status === 'signing') return 'enviando';
  if (status === 'broadcasting' || status === 'in-block') return 'confirmando';
  return null;
}

export type StepStatus = 'hecho' | 'actual' | 'pendiente' | 'fallo';

export interface ProgressView {
  title: string;
  steps: Array<{ step: ProgressStep; label: string; status: StepStatus }>;
  line: string;
  tone: 'curso' | 'listo' | 'error';
}

/** Lo que dibuja ui/txPopup.ts. null = no se muestra. */
export function progressView(p: Progress | null): ProgressView | null {
  if (!p) return null;
  const order = STEPS[p.op];
  const done = p.step === 'listo' || p.step === 'error';
  // Un paso de recuperación fuera del orden (pedir gas o reconectar al firmar) cuenta dentro de «firma».
  const current: ProgressStep | null = done ? null : order.includes(p.step) ? p.step : 'firma';
  const lastReached = [...p.reached].reverse().find((s) => order.includes(s));
  const steps = order.map((step) => {
    let status: StepStatus = 'pendiente';
    if (step === current) status = 'actual';
    else if (p.step === 'error' && step === lastReached) status = 'fallo';
    else if (p.reached.includes(step)) status = 'hecho';
    return { step, label: STEP_LABEL[step], status };
  });
  const line = p.step === 'error' && p.kind ? `${KIND_TITLE[p.kind]}. ${p.message}` : p.message;
  return { title: p.title, steps, line, tone: p.step === 'listo' ? 'listo' : p.step === 'error' ? 'error' : 'curso' };
}
