/*
 * KPIs de la tienda del vendedor (skill «metricas-ecommerce-universidad»). Función pura: la usan la
 * fuente real y la de mocks. Solo se calcula lo que sale de los pedidos y productos del contrato.
 */
import type { MetricasTienda, Orden, Producto, Venta } from '../shared/types';

const DIA = 24 * 3600;

/** «2026-2» de agosto a diciembre, «2026-1» de enero a julio. */
export function semestreDe(fecha: Date): { etiqueta: string; inicio: Date } {
  const anio = fecha.getFullYear();
  return fecha.getMonth() >= 7
    ? { etiqueta: `${anio}-2`, inicio: new Date(anio, 7, 1) }
    : { etiqueta: `${anio}-1`, inicio: new Date(anio, 0, 1) };
}

const pct = (parte: number, total: number) => (total === 0 ? null : Math.round((parte / total) * 1000) / 10);

/** Los `n` valores con más pedidos, de mayor a menor; empates por valor ascendente. */
function pico<K extends string>(fechas: Date[], clave: (d: Date) => number, nombre: K, n = 3) {
  const cuenta = new Map<number, number>();
  for (const d of fechas) cuenta.set(clave(d), (cuenta.get(clave(d)) ?? 0) + 1);
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, n)
    .map(([valor, pedidos]) => ({ [nombre]: valor, pedidos }) as { [P in K]: number } & { pedidos: number });
}

export interface EntradaMetricas {
  /** Todos los pedidos que recibí como vendedor, en cualquier estado. */
  recibidos: Orden[];
  /** Mis ventas completadas. */
  ventas: Venta[];
  /** Mis productos (disponibles y pausados). */
  productos: Producto[];
}

export function metricasDesde({ recibidos, ventas, productos }: EntradaMetricas, ahora: Date): MetricasTienda {
  const ahoraSeg = Math.floor(ahora.getTime() / 1000);
  const semestre = semestreDe(ahora);
  const inicioSemestre = Math.floor(semestre.inicio.getTime() / 1000);
  const suma = (vs: Venta[]) => vs.reduce((s, v) => s + BigInt(v.totalCentavos), 0n);
  const ingresos = suma(ventas);

  const compradores = (desde: number) => new Set(recibidos.filter((o) => o.timestamp >= desde).map((o) => o.comprador.toLowerCase())).size;
  const porComprador = new Map<string, number>();
  for (const o of recibidos) {
    if (o.estado === 'cancelado') continue;
    const c = o.comprador.toLowerCase();
    porComprador.set(c, (porComprador.get(c) ?? 0) + 1);
  }

  const fechas = recibidos.map((o) => new Date(o.timestamp * 1000));
  const categoria = new Map(productos.map((p) => [p.id, p.categoria]));
  const vendidos = new Map<string, MetricasTienda['inventario_producto']['mas_vendidos'][number]>();
  for (const v of ventas) {
    const actual = vendidos.get(v.productoId) ?? { producto_id: v.productoId, titulo: v.tituloProducto, categoria: categoria.get(v.productoId) ?? '', piezas: 0, ingresos_centavos: '0' };
    actual.piezas += v.cantidad;
    actual.ingresos_centavos = (BigInt(actual.ingresos_centavos) + BigInt(v.totalCentavos)).toString();
    vendidos.set(v.productoId, actual);
  }

  return {
    periodo: { generado: ahora.toISOString(), semestre: semestre.etiqueta, ventana_activos_dias: 30 },
    metricas_financieras: {
      ingresos_totales_centavos: ingresos.toString(),
      ingresos_semestre_centavos: suma(ventas.filter((v) => v.completadoEn >= inicioSemestre)).toString(),
      pedidos_completados: ventas.length,
      ticket_promedio_centavos: ventas.length ? (ingresos / BigInt(ventas.length)).toString() : null,
      tasa_conversion_pedidos_pct: pct(recibidos.filter((o) => o.estado === 'completado').length, recibidos.length),
      tasa_conversion_visitas_pct: null,
    },
    comportamiento_usuarios: {
      compradores_activos_dia: compradores(ahoraSeg - DIA),
      compradores_activos_mes: compradores(ahoraSeg - 30 * DIA),
      compradores_recurrentes: [...porComprador.values()].filter((n) => n >= 2).length,
      tasa_cancelacion_pct: pct(recibidos.filter((o) => o.estado === 'cancelado').length, recibidos.length),
      tasa_abandono_carrito_pct: null,
      horas_pico: pico(fechas, (d) => d.getHours(), 'hora'),
      dias_pico: pico(fechas, (d) => d.getDay(), 'dia'),
      meses_pico: pico(fechas, (d) => d.getMonth(), 'mes'),
    },
    inventario_producto: {
      mas_vendidos: [...vendidos.values()].sort((a, b) => b.piezas - a.piezas || Number(BigInt(b.ingresos_centavos) - BigInt(a.ingresos_centavos))).slice(0, 5),
      productos_activos: productos.filter((p) => p.disponible).length,
      productos_pausados: productos.filter((p) => !p.disponible).length,
      alertas_bajo_inventario: null,
    },
    notas: [
      'Montos en centavos de MXN. El pago es tradicional: «completado» quiere decir que el comprador confirmó que recibió el producto.',
      'Conversión de pedidos = completados / recibidos. La app no registra visitas, así que no hay conversión de visitas.',
      'No hay carrito: la tasa de cancelación (pedidos que el comprador canceló antes de que aceptaras) es lo más cercano al abandono.',
      'El contrato no guarda inventario: sin stock no hay alertas de bajo inventario.',
      'Horas, días y meses pico salen de cuándo se crearon tus pedidos, en la hora de este dispositivo.',
    ],
  };
}
