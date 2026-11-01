import { describe, expect, it } from 'vitest';
import { Status, type Order } from '../contract/campuschain';
import { esCompletado, porMes, porPeriodo, resumir, ventaDe, type Venta } from './sales';

const ID = `0x${'cd'.repeat(32)}` as const;
const seg = (d: Date) => Math.floor(d.getTime() / 1000);
const AHORA = new Date(2026, 9, 31, 12, 0, 0); // 31 oct 2026, hora local

const venta = (fecha: Date, totalCents: bigint, quantity = 1): Venta => ({ id: ID, productId: 1n, quantity, totalCents, completadoEn: seg(fecha) });

const VENTAS = [
  venta(new Date(2026, 9, 30), 5000n, 2), // ayer: semana, mes y año
  venta(new Date(2026, 9, 2), 3000n), // este mes, fuera de la semana
  venta(new Date(2026, 5, 15), 2000n), // junio: solo año
  venta(new Date(2025, 11, 20), 1000n), // año pasado: solo total
];

describe('ventas', () => {
  it('solo cuenta los pedidos completados', () => {
    expect(esCompletado({ status: Status.COMPLETED })).toBe(true);
    for (const s of [Status.CREATED, Status.ACCEPTED, Status.PAYMENT_REPORTED, Status.DELIVERED, Status.CANCELLED]) {
      expect(esCompletado({ status: s })).toBe(false);
    }
  });

  it('toma la fecha del paso Completado del historial', () => {
    const o: Order = { id: ID, productId: 2n, buyer: '0x1', seller: '0x2', quantity: 3, totalCents: 900n, orderHash: '0x', status: Status.COMPLETED, createdAt: 10 };
    expect(ventaDe(o, [{ status: Status.CREATED, by: '0x1', timestamp: 10 }, { status: Status.COMPLETED, by: '0x1', timestamp: 99 }]).completadoEn).toBe(99);
    expect(ventaDe(o, []).completadoEn).toBe(10);
  });

  it('resume ventas, piezas, total y promedio', () => {
    expect(resumir(VENTAS)).toEqual({ ventas: 4, piezas: 5, totalCents: 11000n, promedioCents: 2750n });
    expect(resumir([])).toEqual({ ventas: 0, piezas: 0, totalCents: 0n, promedioCents: null });
  });

  it('separa semana, mes, año y total', () => {
    const p = porPeriodo(VENTAS, AHORA);
    expect(p.semana.totalCents).toBe(5000n);
    expect(p.mes.totalCents).toBe(8000n);
    expect(p.anio.totalCents).toBe(10000n);
    expect(p.total.totalCents).toBe(11000n);
  });

  it('agrupa por mes, del más viejo al actual', () => {
    const meses = porMes(VENTAS, AHORA, 6);
    expect(meses.map((m) => m.mes)).toEqual([4, 5, 6, 7, 8, 9]);
    expect(meses[1]!.resumen.totalCents).toBe(2000n);
    expect(meses[5]!.resumen.ventas).toBe(2);
    expect(meses[2]!.resumen.ventas).toBe(0);
  });
});
