import { describe, expect, it } from 'vitest';
import { Status, type Order, type Product } from '../contract/campuschain';
import { esVisible, ordenDesde, pasoDesde, productoDesde, reporteDesde, reputacionDesde } from './adapters';

const SELLER = '0x0000000000000000000000000000000000000001';
const BUYER = '0x0000000000000000000000000000000000000002';
const ID = `0x${'ab'.repeat(32)}` as const;

const product: Product = { id: 7n, seller: SELLER, name: 'Brownies', description: 'Caseros', category: 'Comida', pickupPoint: 'Explanada', priceCents: 3500n, available: true };
const order = (status: Order['status']): Order => ({ id: ID, productId: 7n, buyer: BUYER, seller: SELLER, quantity: 2, totalCents: 7000n, orderHash: '0xab', status, createdAt: 10 });

describe('productos visibles', () => {
  it('oculta los productos anteriores al primero visible', () => {
    expect([1n, 4n, 5n, 9n].filter((id) => esVisible(id, 5n))).toEqual([5n, 9n]);
    expect(esVisible(1n, 1n)).toBe(true);
  });
});

describe('del contrato a shared/types', () => {
  it('producto: bigint a texto, sin stock ni imagen', () => {
    expect(productoDesde(product)).toEqual({
      id: '7', vendedor: SELLER, titulo: 'Brownies', descripcion: 'Caseros', precioCentavos: '3500',
      stock: null, categoria: 'Comida', puntoEntrega: 'Explanada', imagenUrl: null, disponible: true,
    });
  });

  it('orden: estado con nombre y resumen pendiente/completado/cancelado', () => {
    const o = ordenDesde(order(Status.PAYMENT_REPORTED), 'Brownies');
    expect(o).toMatchObject({ orderId: ID, productoId: '7', tituloProducto: 'Brownies', totalCentavos: '7000', estado: 'pago-reportado', resumen: 'pendiente', txHash: null, timestamp: 10 });
    expect(ordenDesde(order(Status.COMPLETED), 'x').resumen).toBe('completado');
    expect(ordenDesde(order(Status.CANCELLED), 'x').resumen).toBe('cancelado');
    expect(() => ordenDesde(order(Status.NONE), 'x')).toThrow();
  });

  it('el JSON de una orden se puede serializar (sin bigint)', () => {
    expect(() => JSON.stringify(ordenDesde(order(Status.CREATED), 'x'))).not.toThrow();
  });

  it('paso y reputación', () => {
    expect(pasoDesde({ status: Status.ACCEPTED, by: SELLER, timestamp: 5 })).toEqual({ estado: 'aceptado', por: SELLER, timestamp: 5 });
    expect(reputacionDesde({ accepted: 4, completed: 3, cancelled: 1 })).toEqual({ completados: 3, aceptados: 4, cancelados: 1, tasa: 75 });
    expect(reputacionDesde({ accepted: 0, completed: 0, cancelled: 0 }).tasa).toBeNull();
  });

  it('reporte de ventas con montos como texto, la venta más reciente primero', () => {
    const ahora = new Date(2026, 9, 31, 12);
    const seg = (d: Date) => Math.floor(d.getTime() / 1000);
    const r = reporteDesde([
      { orderId: ID, productoId: '7', tituloProducto: 'A', cantidad: 1, totalCentavos: '1000', completadoEn: seg(new Date(2026, 5, 1)) },
      { orderId: ID, productoId: '7', tituloProducto: 'B', cantidad: 2, totalCentavos: '3000', completadoEn: seg(new Date(2026, 9, 30)) },
    ], ahora);
    expect(r.semana).toEqual({ ventas: 1, piezas: 2, totalCentavos: '3000', promedioCentavos: '3000' });
    expect(r.anio.totalCentavos).toBe('4000');
    expect(r.meses).toHaveLength(6);
    expect(r.ventas.map((v) => v.tituloProducto)).toEqual(['B', 'A']);
    expect(reporteDesde([], ahora).total.promedioCentavos).toBeNull();
  });
});
