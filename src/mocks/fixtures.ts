/*
 * Datos de ejemplo para `pnpm dev --mode mock`. Siguen los tipos de src/shared/types.ts: si alguien
 * cambia el contrato de datos, tsc y fixtures.test.ts fallan aquí.
 * YO es la cuenta «conectada» en modo mock.
 */
import type { Direccion, Orden, Paso, Producto, Sesion } from '../shared/types';

export const YO: Direccion = '0x1111111111111111111111111111111111111111';
const ANA: Direccion = '0x2222222222222222222222222222222222222222';
const LUIS: Direccion = '0x3333333333333333333333333333333333333333';

export const SESION_DEMO: Sesion = { uid: 'mock-uid', email: 'demo@uanl.edu.mx' };
export const SS58_DEMO = '5DemoCuentaDeEjemploSoloParaModoMockNoEsReal00000';

const DIA = 24 * 3600;
const ahora = Math.floor(Date.now() / 1000);
const haceDias = (d: number) => ahora - d * DIA;

const producto = (id: number, vendedor: Direccion, titulo: string, precio: number, categoria: string, extra: Partial<Producto> = {}): Producto => ({
  id: String(id),
  vendedor,
  titulo,
  descripcion: '',
  precioCentavos: String(precio),
  stock: null,
  categoria,
  puntoEntrega: 'Explanada',
  imagenUrl: null,
  disponible: true,
  ...extra,
});

export const PRODUCTOS: Producto[] = [
  producto(1, ANA, 'Brownies de chocolate', 3500, 'Comida', { descripcion: 'Caseros, porción individual.', puntoEntrega: 'Cafetería' }),
  producto(2, LUIS, 'Pulsera tejida', 6000, 'Accesorios', { descripcion: 'Colores a elegir.' }),
  producto(3, YO, 'Apuntes de Cálculo I', 12000, 'Escolar', { descripcion: 'Impresos y engargolados.', puntoEntrega: 'Biblioteca' }),
  producto(4, YO, 'Galletas de avena', 2500, 'Comida', { descripcion: 'Paquete de 6.' }),
  producto(5, ANA, 'Calculadora científica', 30000, 'Escolar', { disponible: false }),
  producto(6, YO, 'Llavero de la facultad', 4000, 'Accesorios', { disponible: false }),
  producto(7, YO, 'Sudadera de la Facultad de Ingeniería', 45000, 'Ropa', { descripcion: 'Bordada, tallas S a XL.', puntoEntrega: 'Facultad de Ingeniería' }),
  producto(8, YO, 'Kit de útiles para inicio de semestre', 18000, 'Escolar', { descripcion: 'Cuadernos, plumas y calculadora básica.', puntoEntrega: 'Biblioteca' }),
];

/** Segundos de una fecha del último agosto o enero ya pasados: los picos de inicio de semestre. */
const ultimo = (mes: number, dia: number, hora: number) => {
  const hoy = new Date();
  const anio = hoy.getMonth() >= mes ? hoy.getFullYear() : hoy.getFullYear() - 1;
  return Math.floor(new Date(anio, mes, dia, hora).getTime() / 1000);
};

const id = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Direccion;

const orden = (n: number, productoId: number, comprador: Direccion, vendedor: Direccion, cantidad: number, estado: Orden['estado'], creado: number): Orden => {
  const p = PRODUCTOS.find((x) => x.id === String(productoId))!;
  return {
    orderId: id(n),
    productoId: p.id,
    tituloProducto: p.titulo,
    cantidad,
    totalCentavos: String(BigInt(p.precioCentavos) * BigInt(cantidad)),
    comprador,
    vendedor,
    estado,
    resumen: estado === 'completado' ? 'completado' : estado === 'cancelado' ? 'cancelado' : 'pendiente',
    orderHash: id(1000 + n),
    txHash: null,
    timestamp: creado,
  };
};

export const ORDENES: Orden[] = [
  // Compras mías.
  orden(1, 1, YO, ANA, 2, 'entregado', haceDias(2)),
  orden(2, 2, YO, LUIS, 1, 'creado', haceDias(1)),
  // Ventas mías: completadas (cuentan en «Mis ventas») y en curso.
  orden(3, 3, ANA, YO, 1, 'completado', haceDias(3)),
  orden(4, 4, LUIS, YO, 4, 'completado', haceDias(20)),
  orden(5, 3, LUIS, YO, 1, 'completado', haceDias(70)),
  orden(6, 4, ANA, YO, 2, 'creado', haceDias(0)),
  orden(7, 4, LUIS, YO, 1, 'cancelado', haceDias(5)),
  // Inicio de semestre: agosto y enero concentran las ventas de sudaderas y útiles.
  orden(8, 7, ANA, YO, 1, 'completado', ultimo(7, 8, 11)),
  orden(9, 7, LUIS, YO, 2, 'completado', ultimo(7, 9, 12)),
  orden(10, 8, ANA, YO, 1, 'completado', ultimo(7, 12, 11)),
  orden(11, 8, LUIS, YO, 3, 'completado', ultimo(0, 13, 10)),
  orden(12, 7, ANA, YO, 1, 'completado', ultimo(0, 15, 11)),
  orden(13, 7, LUIS, YO, 1, 'aceptado', haceDias(1)),
];

const CAMINO: Orden['estado'][] = ['creado', 'aceptado', 'pago-reportado', 'entregado', 'completado'];

/** Historial coherente con el estado: un paso por hora desde que se creó. */
export function historialDe(o: Orden): Paso[] {
  if (o.estado === 'cancelado') {
    return [{ estado: 'creado', por: o.comprador, timestamp: o.timestamp }, { estado: 'cancelado', por: o.comprador, timestamp: o.timestamp + 3600 }];
  }
  return CAMINO.slice(0, CAMINO.indexOf(o.estado) + 1).map((estado, i) => ({
    estado,
    por: estado === 'creado' || estado === 'completado' ? o.comprador : o.vendedor,
    timestamp: o.timestamp + i * 3600,
  }));
}
