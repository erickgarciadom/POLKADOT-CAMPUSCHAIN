/*
 * Del formato del contrato (bigint, Status numérico, nombres en inglés) a los tipos de shared/.
 * Funciones puras: se prueban en adapters.test.ts.
 */
import type { Order, Product, SellerStats, Step } from '../contract/campuschain';
import { reputationOf } from '../lib/reputation';
import { porMes, porPeriodo, resumir, type Resumen, type Venta as VentaLib } from '../lib/sales';
import { estadoDesdeStatus, resumenDe } from '../shared/estados';
import type { Orden, Paso, Producto, ReporteVentas, Reputacion, ResumenPeriodo, Venta } from '../shared/types';

export function productoDesde(p: Product): Producto {
  return {
    id: p.id.toString(),
    vendedor: p.seller,
    titulo: p.name,
    descripcion: p.description,
    precioCentavos: p.priceCents.toString(),
    stock: null,
    categoria: p.category,
    puntoEntrega: p.pickupPoint,
    imagenUrl: null,
    disponible: p.available,
  };
}

/** `titulo` sale del producto: el pedido solo guarda su id. */
export function ordenDesde(o: Order, titulo: string, txHash: string | null = null): Orden {
  const estado = estadoDesdeStatus(o.status);
  return {
    orderId: o.id,
    productoId: o.productId.toString(),
    tituloProducto: titulo,
    cantidad: o.quantity,
    totalCentavos: o.totalCents.toString(),
    comprador: o.buyer,
    vendedor: o.seller,
    estado,
    resumen: resumenDe(estado),
    orderHash: o.orderHash,
    txHash,
    timestamp: o.createdAt,
  };
}

export const pasoDesde = (s: Step): Paso => ({ estado: estadoDesdeStatus(s.status), por: s.by, timestamp: s.timestamp });

export function reputacionDesde(s: SellerStats): Reputacion {
  const r = reputationOf(s);
  return { completados: r.completed, aceptados: r.accepted, cancelados: r.cancelled, tasa: r.completionRate };
}

const periodo = (r: Resumen): ResumenPeriodo => ({
  ventas: r.ventas,
  piezas: r.piezas,
  totalCentavos: r.totalCents.toString(),
  promedioCentavos: r.promedioCents === null ? null : r.promedioCents.toString(),
});

/** Reporte de ventas a partir de ventas ya completadas (las de la cadena o las de los mocks). */
export function reporteDesde(ventas: Venta[], ahora: Date): ReporteVentas {
  const lib: VentaLib[] = ventas.map((v) => ({
    id: v.orderId,
    productId: BigInt(v.productoId),
    quantity: v.cantidad,
    totalCents: BigInt(v.totalCentavos),
    completadoEn: v.completadoEn,
  }));
  const p = porPeriodo(lib, ahora);
  return {
    semana: periodo(p.semana),
    mes: periodo(p.mes),
    anio: periodo(p.anio),
    total: periodo(resumir(lib)),
    meses: porMes(lib, ahora, 6).map((m) => ({ anio: m.anio, mes: m.mes, resumen: periodo(m.resumen) })),
    ventas: [...ventas].sort((a, b) => b.completadoEn - a.completadoEn),
  };
}
