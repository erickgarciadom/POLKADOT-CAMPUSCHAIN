import { describe, expect, it } from 'vitest';
import { resumenDe } from '../shared/estados';
import { historialDe, ORDENES, PRODUCTOS, YO } from './fixtures';
import { createMockSource } from './mockSource';

describe('datos de ejemplo', () => {
  it('cada orden apunta a un producto que existe, con total y resumen coherentes', () => {
    for (const o of ORDENES) {
      const p = PRODUCTOS.find((x) => x.id === o.productoId);
      expect(p, o.orderId).toBeDefined();
      expect(o.tituloProducto).toBe(p!.titulo);
      expect(BigInt(o.totalCentavos)).toBe(BigInt(p!.precioCentavos) * BigInt(o.cantidad));
      expect(o.resumen).toBe(resumenDe(o.estado));
      expect(historialDe(o).at(-1)!.estado).toBe(o.estado);
    }
  });
});

describe('fuente mock', () => {
  it('el catálogo solo trae disponibles y «Mis ventas» solo completadas', async () => {
    const data = createMockSource();
    expect((await data.catalogo()).every((p) => p.disponible)).toBe(true);
    const r = await data.reporteVentas(new Date());
    expect(r.ventas.length).toBe(ORDENES.filter((o) => o.estado === 'completado' && o.vendedor === YO).length);
  });

  it('borrar: solo el vendedor, y sale de mis productos', async () => {
    const data = createMockSource();
    const ajeno = PRODUCTOS.find((p) => p.vendedor !== YO)!;
    expect((await data.borrarProducto(ajeno.id)).ok).toBe(false);
    const mio = PRODUCTOS.find((p) => p.vendedor === YO && p.disponible)!;
    expect((await data.borrarProducto(mio.id)).ok).toBe(true);
    expect((await data.misProductos()).some((p) => p.id === mio.id)).toBe(false);
    expect(await data.borrado(mio.id)).toBe(true);
  });

  it('un pedido avanza solo con acciones permitidas', async () => {
    const data = createMockSource();
    const recibido = ORDENES.find((o) => o.vendedor === YO && o.estado === 'creado')!;
    expect((await data.accionPedido(recibido.orderId, 'completar')).ok).toBe(false);
    expect((await data.accionPedido(recibido.orderId, 'aceptar')).ok).toBe(true);
    expect((await data.pedido(recibido.orderId)).orden.estado).toBe('aceptado');
  });
});
