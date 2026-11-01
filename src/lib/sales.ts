/*
 * Métricas de ventas del vendedor. Solo cuentan los pedidos COMPLETADOS: el comprador confirmó que
 * recibió el producto. La fecha de cada venta es la del paso «Completado» en el historial del contrato.
 */
import { Status, type Hex, type Order, type Step } from '../contract/campuschain';

export interface Venta {
  id: Hex;
  productId: bigint;
  quantity: number;
  totalCents: bigint;
  /** Segundos (block.timestamp) en que el comprador completó el pedido. */
  completadoEn: number;
}

export interface Resumen {
  ventas: number;
  piezas: number;
  totalCents: bigint;
  /** null sin ventas. */
  promedioCents: bigint | null;
}

export const esCompletado = (o: Pick<Order, 'status'>) => o.status === Status.COMPLETED;

/** Venta a partir del pedido y su historial; sin paso «Completado» usa la fecha de creación. */
export function ventaDe(o: Order, history: Step[]): Venta {
  const paso = history.find((s) => s.status === Status.COMPLETED);
  return { id: o.id, productId: o.productId, quantity: o.quantity, totalCents: o.totalCents, completadoEn: paso?.timestamp ?? o.createdAt };
}

export function resumir(ventas: Venta[]): Resumen {
  const totalCents = ventas.reduce((s, v) => s + v.totalCents, 0n);
  return {
    ventas: ventas.length,
    piezas: ventas.reduce((s, v) => s + v.quantity, 0),
    totalCents,
    promedioCents: ventas.length ? totalCents / BigInt(ventas.length) : null,
  };
}

const segundos = (d: Date) => Math.floor(d.getTime() / 1000);

/** Últimos 7 días, mes en curso y año en curso (hora local), más el total. */
export function porPeriodo(ventas: Venta[], ahora: Date) {
  const semana = segundos(ahora) - 7 * 24 * 3600;
  const mes = segundos(new Date(ahora.getFullYear(), ahora.getMonth(), 1));
  const anio = segundos(new Date(ahora.getFullYear(), 0, 1));
  const desde = (t: number) => resumir(ventas.filter((v) => v.completadoEn >= t));
  return { semana: desde(semana), mes: desde(mes), anio: desde(anio), total: resumir(ventas) };
}

/** Los últimos `n` meses, del más viejo al actual: { año, mes (0-11), resumen }. */
export function porMes(ventas: Venta[], ahora: Date, n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - (n - 1 - i), 1);
    const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
    const enMes = ventas.filter((v) => v.completadoEn >= segundos(inicio) && v.completadoEn < segundos(fin));
    return { anio: inicio.getFullYear(), mes: inicio.getMonth(), resumen: resumir(enMes) };
  });
}
