import type { SellerStats } from '../contract/campuschain';

export interface Reputation {
  completed: number;
  accepted: number;
  /** Aceptados que todavía no se completan (en curso o sin confirmar por el comprador). */
  open: number;
  cancelled: number;
  /** completed / accepted * 100, redondeado. null si no hay pedidos aceptados: no se inventa un %. */
  completionRate: number | null;
}

/**
 * Reputación calculada solo con lo que registró el contrato. Es un indicador del historial, no
 * una garantía de honestidad: la interfaz siempre muestra el tamaño de la muestra.
 */
export function reputationOf(s: SellerStats): Reputation {
  return {
    completed: s.completed,
    accepted: s.accepted,
    open: Math.max(0, s.accepted - s.completed),
    cancelled: s.cancelled,
    completionRate: s.accepted === 0 ? null : Math.round((s.completed / s.accepted) * 100),
  };
}

/** Una línea corta para tarjetas: «3 completados de 4 aceptados». */
export function reputationLine(r: Reputation): string {
  if (r.accepted === 0) return 'Sin pedidos completados todavía';
  return `${r.completed} completado${r.completed === 1 ? '' : 's'} de ${r.accepted} aceptado${r.accepted === 1 ? '' : 's'}`;
}
