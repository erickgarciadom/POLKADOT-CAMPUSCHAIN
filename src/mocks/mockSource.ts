/*
 * CampusData en memoria, para trabajar la interfaz sin Host, sin red y sin Firebase.
 * Aplica las mismas reglas de acciones que la app real (shared/estados) para que los botones se
 * comporten igual. Los cambios se pierden al recargar.
 */
import { reporteDesde } from '../data/adapters';
import { metricasDesde } from '../data/metricas';
import type { CampusData } from '../shared/datasource';
import { opcionesPedido, resumenDe } from '../shared/estados';
import type { Orden, Paso, Producto, Resultado, Venta } from '../shared/types';
import { historialDe, ORDENES, PRODUCTOS, YO } from './fixtures';

const espera = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const mismo = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function createMockSource(): CampusData {
  const productos: Producto[] = PRODUCTOS.map((p) => ({ ...p }));
  const ordenes: Orden[] = ORDENES.map((o) => ({ ...o }));
  const historiales = new Map<string, Paso[]>(ordenes.map((o) => [o.orderId, historialDe(o)]));
  const borrados = new Set<string>();
  const ahora = () => Math.floor(Date.now() / 1000);

  const buscar = (id: string) => {
    const p = productos.find((x) => x.id === id);
    if (!p) throw new Error('Ese producto no existe.');
    return p;
  };
  const pedido = (id: string) => {
    const o = ordenes.find((x) => mismo(x.orderId, id));
    if (!o) throw new Error('Ese pedido no existe.');
    return o;
  };
  const nuevos = (list: Producto[]) => [...list].sort((a, b) => Number(b.id) - Number(a.id)).map((p) => ({ ...p }));
  const ok = (message: string): Resultado => ({ ok: true, message });
  const misVentas = (): Venta[] => ordenes
    .filter((o) => o.estado === 'completado' && mismo(o.vendedor, YO))
    .map((o) => ({
      orderId: o.orderId,
      productoId: o.productoId,
      tituloProducto: o.tituloProducto,
      cantidad: o.cantidad,
      totalCentavos: o.totalCentavos,
      completadoEn: historiales.get(o.orderId)?.find((s) => s.estado === 'completado')?.timestamp ?? o.timestamp,
    }));

  return {
    async catalogo() {
      await espera();
      return nuevos(productos.filter((p) => p.disponible));
    },
    async producto(id) {
      await espera();
      return { ...buscar(id) };
    },
    async reputacion(vendedor) {
      const suyas = ordenes.filter((o) => mismo(o.vendedor, vendedor));
      const aceptados = suyas.filter((o) => o.estado !== 'creado' && o.estado !== 'cancelado').length;
      const completados = suyas.filter((o) => o.estado === 'completado').length;
      return {
        completados,
        aceptados,
        cancelados: suyas.filter((o) => o.estado === 'cancelado').length,
        tasa: aceptados === 0 ? null : Math.round((completados / aceptados) * 100),
      };
    },
    async productosDe(vendedor) {
      return nuevos(productos.filter((p) => p.disponible && mismo(p.vendedor, vendedor)));
    },
    async misProductos() {
      await espera();
      return nuevos(productos.filter((p) => mismo(p.vendedor, YO) && !borrados.has(p.id)));
    },
    async borrado(id) {
      return borrados.has(id);
    },

    async misPedidos() {
      await espera();
      return ordenes.filter((o) => mismo(o.comprador, YO)).map((o) => ({ ...o }));
    },
    async pedidosRecibidos() {
      await espera();
      return ordenes.filter((o) => mismo(o.vendedor, YO)).map((o) => ({ ...o }));
    },
    async pedido(orderId) {
      await espera();
      const o = pedido(orderId);
      return { orden: { ...o }, producto: { ...buscar(o.productoId) }, historial: [...(historiales.get(o.orderId) ?? [])] };
    },
    async txHashes() {
      return {};
    },
    async verificarPedido(orderId) {
      return { coincide: true, hash: pedido(orderId).orderHash };
    },
    async reporteVentas(fecha) {
      await espera();
      return reporteDesde(misVentas(), fecha);
    },
    async metricas(fecha) {
      await espera();
      return metricasDesde({
        recibidos: ordenes.filter((o) => mismo(o.vendedor, YO)).map((o) => ({ ...o })),
        ventas: misVentas(),
        productos: productos.filter((p) => mismo(p.vendedor, YO) && !borrados.has(p.id)),
      }, fecha);
    },

    async publicarProducto(n) {
      await espera(600);
      const id = String(Math.max(0, ...productos.map((p) => Number(p.id))) + 1);
      productos.push({ id, vendedor: YO, titulo: n.titulo, descripcion: n.descripcion, precioCentavos: n.precioCentavos, stock: null, categoria: n.categoria, puntoEntrega: n.puntoEntrega, imagenUrl: null, disponible: true });
      return ok('Producto publicado (modo mock).');
    },
    async cambiarDisponible(id, disponible) {
      await espera(600);
      const p = buscar(id);
      if (!mismo(p.vendedor, YO)) return { ok: false, message: 'Solo el vendedor puede hacer esto.' };
      p.disponible = disponible;
      return ok(disponible ? 'Producto disponible otra vez.' : 'Producto pausado.');
    },
    async borrarProducto(id) {
      await espera(600);
      const p = buscar(id);
      if (!mismo(p.vendedor, YO)) return { ok: false, message: 'Solo quien publicó el producto puede borrarlo.' };
      p.disponible = false;
      borrados.add(id);
      return ok('Producto borrado.');
    },
    async crearPedido(productoId, cantidad) {
      await espera(600);
      const p = buscar(productoId);
      if (!p.disponible) return { ok: false, message: 'Este producto no está disponible.' };
      if (mismo(p.vendedor, YO)) return { ok: false, message: 'No puedes comprar tu propio producto.' };
      const orderId = `0x${crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')}` as Orden['orderId'];
      const o: Orden = {
        orderId, productoId, tituloProducto: p.titulo, cantidad,
        totalCentavos: String(BigInt(p.precioCentavos) * BigInt(cantidad)),
        comprador: YO, vendedor: p.vendedor, estado: 'creado', resumen: 'pendiente',
        orderHash: orderId, txHash: null, timestamp: ahora(),
      };
      ordenes.push(o);
      historiales.set(orderId, [{ estado: 'creado', por: YO, timestamp: o.timestamp }]);
      return { ...ok('Pedido creado (modo mock).'), orderId };
    },
    async accionPedido(orderId, accion) {
      await espera(600);
      const o = pedido(orderId);
      const opcion = opcionesPedido(o, YO).find((x) => x.accion === accion);
      if (!opcion) return { ok: false, message: 'Esa acción no está disponible para ti en este pedido.' };
      o.estado = opcion.siguiente;
      o.resumen = resumenDe(o.estado);
      historiales.get(o.orderId)?.push({ estado: o.estado, por: YO, timestamp: ahora() });
      return ok(`Listo: ${opcion.etiqueta} (modo mock).`);
    },
  };
}
