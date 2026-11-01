/*
 * Estados y acciones de un pedido con los tipos de shared/. Las reglas de quién puede hacer qué
 * siguen en lib/orderActions.ts (espejo del contrato); aquí solo se traducen nombres.
 */
import { Status, STATUS_LABEL, type Order } from '../contract/campuschain';
import { orderActions, type OrderFn } from '../lib/orderActions';
import type { AccionPedido, EstadoOrden, Orden, ResumenOrden } from './types';

/** Índice = número de `enum Status` del contrato (0 = NONE, que no es un estado de pedido). */
const POR_NUMERO: readonly (EstadoOrden | null)[] = [null, 'creado', 'aceptado', 'pago-reportado', 'entregado', 'completado', 'cancelado'];

export function estadoDesdeStatus(status: Status): EstadoOrden {
  const e = POR_NUMERO[status];
  if (!e) throw new RangeError(`Estado sin pedido: ${status}`);
  return e;
}

export const statusDesdeEstado = (e: EstadoOrden): Status => POR_NUMERO.indexOf(e) as Status;

export const resumenDe = (e: EstadoOrden): ResumenOrden =>
  e === 'completado' ? 'completado' : e === 'cancelado' ? 'cancelado' : 'pendiente';

/** Texto de cada estado. El pago es una declaración del vendedor, nunca «pago verificado». */
export const etiquetaEstado = (e: EstadoOrden): string => STATUS_LABEL[statusDesdeEstado(e)];

/** El camino feliz, para la barra de pasos. */
export const CAMINO: readonly EstadoOrden[] = ['creado', 'aceptado', 'pago-reportado', 'entregado', 'completado'];

const ACCION_DE: Record<OrderFn, AccionPedido> = {
  acceptOrder: 'aceptar',
  reportPayment: 'reportarPago',
  confirmDelivery: 'entregar',
  completeOrder: 'completar',
  cancelOrder: 'cancelar',
};

export const FUNCION_DE: Record<AccionPedido, OrderFn> = {
  aceptar: 'acceptOrder',
  reportarPago: 'reportPayment',
  entregar: 'confirmDelivery',
  completar: 'completeOrder',
  cancelar: 'cancelOrder',
};

export interface OpcionPedido {
  accion: AccionPedido;
  etiqueta: string;
  /** Estado al que pasa si la firma entra. */
  siguiente: EstadoOrden;
  ayuda: string;
  peligro: boolean;
}

const comoOrder = (o: Orden): Order => ({
  id: o.orderId,
  productId: BigInt(o.productoId),
  buyer: o.comprador,
  seller: o.vendedor,
  quantity: o.cantidad,
  totalCents: BigInt(o.totalCentavos),
  orderHash: o.orderHash,
  status: statusDesdeEstado(o.estado),
  createdAt: o.timestamp,
});

/** Qué puede hacer `yo` con el pedido ahora. */
export function opcionesPedido(o: Orden, yo: string | null): OpcionPedido[] {
  return orderActions(comoOrder(o), yo).map((a) => ({
    accion: ACCION_DE[a.fn],
    etiqueta: a.label,
    siguiente: estadoDesdeStatus(a.next),
    ayuda: a.hint,
    peligro: a.danger === true,
  }));
}

/** El pedido espera algo de `yo` (cancelar no cuenta). */
export const meToca = (o: Orden, yo: string | null) => opcionesPedido(o, yo).some((a) => !a.peligro);
