import { describe, expect, it } from 'vitest';
import { resumenDe } from '../shared/estados';
import type { Orden, Producto, Venta } from '../shared/types';
import { metricasDesde, semestreDe } from './metricas';

const YO = '0x0000000000000000000000000000000000000001';
const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';
const AHORA = new Date(2026, 9, 31, 12, 0); // sábado 31 oct 2026
const seg = (d: Date) => Math.floor(d.getTime() / 1000);

const orden = (n: number, comprador: `0x${string}`, estado: Orden['estado'], fecha: Date, productoId = '5', total = '1000'): Orden => ({
  orderId: `0x${n.toString(16).padStart(64, '0')}`, productoId, tituloProducto: `P${productoId}`, cantidad: 1, totalCentavos: total,
  comprador, vendedor: YO, estado, resumen: resumenDe(estado), orderHash: '0x', txHash: null, timestamp: seg(fecha),
});
const venta = (o: Orden, cantidad = 1): Venta => ({ orderId: o.orderId, productoId: o.productoId, tituloProducto: o.tituloProducto, cantidad, totalCentavos: o.totalCentavos, completadoEn: o.timestamp });
const producto = (id: string, disponible: boolean): Producto => ({ id, vendedor: YO, titulo: `P${id}`, descripcion: '', precioCentavos: '1000', stock: null, categoria: 'Ropa', puntoEntrega: 'Explanada', imagenUrl: null, disponible });

const recibidos = [
  orden(1, A, 'completado', new Date(2026, 7, 10, 10), '5', '2000'), // agosto, inicio de semestre
  orden(2, A, 'completado', new Date(2026, 9, 31, 10), '6', '1000'), // hoy
  orden(3, B, 'cancelado', new Date(2026, 9, 20, 18)),
  orden(4, B, 'creado', new Date(2026, 9, 25, 10)),
  orden(5, B, 'completado', new Date(2026, 0, 15, 9), '5', '3000'), // semestre pasado
];
const ventas = [venta(recibidos[0]!, 2), venta(recibidos[1]!), venta(recibidos[4]!, 3)];

describe('semestre', () => {
  it('agosto–diciembre es el 2 y enero–julio el 1', () => {
    expect(semestreDe(new Date(2026, 7, 1)).etiqueta).toBe('2026-2');
    expect(semestreDe(new Date(2026, 6, 31)).etiqueta).toBe('2026-1');
  });
});

describe('métricas de la tienda', () => {
  const m = metricasDesde({ recibidos, ventas, productos: [producto('5', true), producto('6', true), producto('7', false)] }, AHORA);

  it('finanzas: ingresos, semestre, ticket promedio y conversión de pedidos', () => {
    expect(m.periodo.semestre).toBe('2026-2');
    expect(m.metricas_financieras).toEqual({
      ingresos_totales_centavos: '6000',
      ingresos_semestre_centavos: '3000',
      pedidos_completados: 3,
      ticket_promedio_centavos: '2000',
      tasa_conversion_pedidos_pct: 60,
      tasa_conversion_visitas_pct: null,
    });
  });

  it('compradores activos, recurrentes, cancelación y picos', () => {
    const c = m.comportamiento_usuarios;
    expect(c.compradores_activos_dia).toBe(1);
    expect(c.compradores_activos_mes).toBe(2);
    expect(c.compradores_recurrentes).toBe(2);
    expect(c.tasa_cancelacion_pct).toBe(20);
    expect(c.tasa_abandono_carrito_pct).toBeNull();
    expect(c.horas_pico[0]).toEqual({ hora: 10, pedidos: 3 });
    expect(c.meses_pico[0]).toEqual({ mes: 9, pedidos: 3 });
  });

  it('más vendidos por piezas y productos activos/pausados, sin alertas inventadas', () => {
    expect(m.inventario_producto.mas_vendidos.map((p) => [p.producto_id, p.piezas, p.ingresos_centavos])).toEqual([['5', 5, '5000'], ['6', 1, '1000']]);
    expect(m.inventario_producto.productos_activos).toBe(2);
    expect(m.inventario_producto.productos_pausados).toBe(1);
    expect(m.inventario_producto.alertas_bajo_inventario).toBeNull();
  });

  it('sin pedidos no inventa porcentajes y el JSON se serializa', () => {
    const vacio = metricasDesde({ recibidos: [], ventas: [], productos: [] }, AHORA);
    expect(vacio.metricas_financieras.ticket_promedio_centavos).toBeNull();
    expect(vacio.metricas_financieras.tasa_conversion_pedidos_pct).toBeNull();
    expect(vacio.comportamiento_usuarios.horas_pico).toEqual([]);
    expect(() => JSON.parse(JSON.stringify(m))).not.toThrow();
  });
});
