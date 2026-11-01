import { Status, type Order, type WriteFn } from '../contract/campuschain';

export type OrderFn = Extract<WriteFn, 'acceptOrder' | 'reportPayment' | 'confirmDelivery' | 'completeOrder' | 'cancelOrder'>;

export interface OrderAction {
  fn: OrderFn;
  label: string;
  /** El estado al que pasa el pedido si la firma entra. */
  next: Status;
  /** Lo que la persona debe saber antes de firmar. */
  hint: string;
  danger?: boolean;
}

/**
 * Qué puede hacer `me` con el pedido ahora. La misma regla que el contrato (quién y en qué estado);
 * el contrato es el que decide, esto solo evita mostrar botones que van a revertir.
 */
export function orderActions(order: Order, me: string | null | undefined): OrderAction[] {
  if (!me) return [];
  const who = me.toLowerCase();
  const isSeller = order.seller.toLowerCase() === who;
  const isBuyer = order.buyer.toLowerCase() === who;
  const out: OrderAction[] = [];

  if (isSeller) {
    if (order.status === Status.CREATED) {
      out.push({ fn: 'acceptOrder', label: 'Aceptar pedido', next: Status.ACCEPTED, hint: 'El comprador te pagará en efectivo o transferencia, fuera de la app.' });
    }
    if (order.status === Status.ACCEPTED) {
      out.push({ fn: 'reportPayment', label: 'Declarar pago recibido', next: Status.PAYMENT_REPORTED, hint: 'Firmas que recibiste el pago. La blockchain registra tu declaración; no verifica el banco.' });
    }
    if (order.status === Status.PAYMENT_REPORTED) {
      out.push({ fn: 'confirmDelivery', label: 'Marcar como entregado', next: Status.DELIVERED, hint: 'Firmas que entregaste el producto. El comprador debe confirmar que lo recibió.' });
    }
  }
  if (isBuyer) {
    if (order.status === Status.DELIVERED) {
      out.push({ fn: 'completeOrder', label: 'Confirmar que lo recibí', next: Status.COMPLETED, hint: 'Solo con tu confirmación el pedido queda completado.' });
    }
    if (order.status === Status.CREATED) {
      out.push({ fn: 'cancelOrder', label: 'Cancelar pedido', next: Status.CANCELLED, hint: 'Solo se puede cancelar antes de que el vendedor acepte.', danger: true });
    }
  }
  return out;
}

/** El pedido espera algo de `me` (para resaltarlo en las listas). */
export const waitsForMe = (order: Order, me: string | null | undefined) => orderActions(order, me).some((a) => !a.danger);
