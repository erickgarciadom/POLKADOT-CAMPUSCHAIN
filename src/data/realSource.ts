/*
 * CampusData con los datos reales: lecturas del contrato (hub.reads), firmas por el Host (hub.write,
 * que simula antes de firmar y muestra el popup) y los productos borrados en Firebase.
 */
import { computeOrderHash, newOrderId, type Hex, type Order, type Product } from '../contract/campuschain';
import { FIRST_VISIBLE_PRODUCT } from '../contract/config';
import { readStatusTxHashes, rememberTxHash } from '../contract/txHashes';
import { marcarBorrado, productosBorrados } from '../firebase/borrados';
import type { Hub, Result } from '../hub/hub';
import { esCompletado, ventaDe } from '../lib/sales';
import type { CampusData } from '../shared/datasource';
import { estadoDesdeStatus, etiquetaEstado, FUNCION_DE, opcionesPedido, statusDesdeEstado } from '../shared/estados';
import type { Direccion, EstadoOrden, Resultado, Sesion, Venta } from '../shared/types';
import { esVisible, ordenDesde, pasoDesde, productoDesde, reporteDesde, reputacionDesde } from './adapters';
import { metricasDesde } from './metricas';

const NO_ACCOUNT: Resultado = { ok: false, message: 'Conecta tu cuenta primero.' };

const resultado = (r: Result): Resultado => (r.ok ? { ok: true, message: r.message, txHash: r.txHash } : { ok: false, message: r.message });

export function createRealSource(hub: Hub, sesion: Sesion): CampusData {
  const reads = hub.reads;
  const yo = (): Hex | null => hub.getState().account?.h160 ?? null;
  const borrados = () => productosBorrados(sesion.uid).catch(() => new Set<string>());

  /** Título de cada producto de una lista de pedidos, sin repetir lecturas. */
  const titulos = async (orders: Order[]) => {
    const ids = [...new Set(orders.map((o) => o.productId.toString()))];
    const list = await Promise.all(ids.map((id) => reads.product(BigInt(id))));
    return new Map(list.map((p) => [p.id.toString(), p.name]));
  };
  const ordenes = async (orders: Order[]) => {
    const t = await titulos(orders);
    return orders.map((o) => ordenDesde(o, t.get(o.productId.toString()) ?? `Producto #${o.productId}`));
  };
  /** Mis pedidos completados como vendedor, con la fecha del paso «Completado». */
  const misVentas = async (): Promise<Venta[]> => {
    const me = yo();
    if (!me) return [];
    const completados = (await reads.sellerOrders(me)).filter(esCompletado);
    const t = await titulos(completados);
    return Promise.all(completados.map(async (o) => {
      const v = ventaDe(o, await reads.history(o.id));
      return {
        orderId: o.id,
        productoId: o.productId.toString(),
        tituloProducto: t.get(o.productId.toString()) ?? `Producto #${o.productId}`,
        cantidad: v.quantity,
        totalCentavos: v.totalCents.toString(),
        completadoEn: v.completadoEn,
      };
    }));
  };

  // Los productos de antes de FIRST_VISIBLE_PRODUCT ya no se muestran en las listas.
  const nuevos = (list: Product[]) => list.filter((p) => esVisible(p.id, FIRST_VISIBLE_PRODUCT)).reverse().map(productoDesde);

  const fuente: CampusData = {
    async catalogo() {
      return nuevos((await reads.products()).filter((p) => p.available));
    },
    async producto(id) {
      return productoDesde(await reads.product(BigInt(id)));
    },
    async reputacion(vendedor) {
      return reputacionDesde(await reads.stats(vendedor));
    },
    async productosDe(vendedor) {
      return nuevos((await reads.sellerProducts(vendedor)).filter((p) => p.available));
    },
    async misProductos() {
      const me = yo();
      if (!me) return [];
      const [list, fuera] = await Promise.all([reads.sellerProducts(me), borrados()]);
      // Los borrados siguen en el contrato (no disponibles); se quitan de la lista.
      return nuevos(list.filter((p) => p.available || !fuera.has(p.id.toString())));
    },
    async borrado(id) {
      return (await borrados()).has(id);
    },

    async misPedidos() {
      const me = yo();
      return me ? ordenes(await reads.buyerOrders(me)) : [];
    },
    async pedidosRecibidos() {
      const me = yo();
      return me ? ordenes(await reads.sellerOrders(me)) : [];
    },
    async pedido(orderId) {
      const [o, history] = await Promise.all([reads.order(orderId), reads.history(orderId)]);
      const p = await reads.product(o.productId);
      return { orden: ordenDesde(o, p.name), producto: productoDesde(p), historial: history.map(pasoDesde) };
    },
    async txHashes(orderId) {
      const out: Partial<Record<EstadoOrden, string>> = {};
      for (const [status, hash] of await readStatusTxHashes(orderId)) {
        if (status !== 0) out[estadoDesdeStatus(status)] = hash;
      }
      return out;
    },
    async verificarPedido(orderId) {
      const o = await reads.order(orderId);
      const hash = computeOrderHash(o);
      return { coincide: await reads.verifyHash(orderId, hash), hash };
    },
    async reporteVentas(ahora) {
      return reporteDesde(await misVentas(), ahora);
    },
    async metricas(ahora) {
      const me = yo();
      if (!me) return metricasDesde({ recibidos: [], ventas: [], productos: [] }, ahora);
      const [recibidos, ventas, productos] = await Promise.all([fuente.pedidosRecibidos(), misVentas(), fuente.misProductos()]);
      return metricasDesde({ recibidos, ventas, productos }, ahora);
    },

    async publicarProducto(n) {
      const me = yo();
      if (!me) return NO_ACCOUNT;
      const antes = (await reads.sellerProducts(me)).length;
      return resultado(await hub.write({
        fn: 'createProduct',
        args: [n.titulo, n.descripcion, n.categoria, n.puntoEntrega, BigInt(n.precioCentavos)],
        title: 'Publicar producto',
        landed: async () => (await reads.sellerProducts(me)).length > antes,
        rejected: 'El contrato rechazó el producto.',
        saved: 'Producto publicado en el catálogo.',
      }));
    },
    async cambiarDisponible(id, disponible) {
      return resultado(await hub.write({
        fn: 'setAvailable',
        args: [BigInt(id), disponible],
        title: disponible ? 'Reactivar producto' : 'Pausar producto',
        landed: async () => (await reads.product(BigInt(id))).available === disponible,
        rejected: 'El contrato rechazó el cambio.',
        saved: disponible ? 'Producto disponible otra vez.' : 'Producto pausado.',
      }));
    },
    async borrarProducto(id) {
      const me = yo();
      if (!me) return NO_ACCOUNT;
      const p = await reads.product(BigInt(id));
      if (p.seller.toLowerCase() !== me.toLowerCase()) return { ok: false, message: 'Solo quien publicó el producto puede borrarlo.' };
      // El contrato no borra: se saca del catálogo (si ya estaba pausado no hace falta firmar).
      if (p.available) {
        const r = await hub.write({
          fn: 'setAvailable',
          args: [p.id, false],
          title: 'Borrar producto',
          landed: async () => !(await reads.product(p.id)).available,
          rejected: 'El contrato rechazó el borrado.',
          saved: 'Producto borrado del catálogo.',
        });
        if (!r.ok) return resultado(r);
      }
      try {
        await marcarBorrado(sesion.uid, p.id, p.seller);
        return { ok: true, message: 'Producto borrado.' };
      } catch (error) {
        const detalle = error instanceof Error ? error.message : String(error);
        return { ok: false, message: `El producto ya no está en el catálogo, pero no se guardó el borrado: ${detalle}` };
      }
    },
    async crearPedido(productoId, cantidad) {
      const me = yo();
      if (!me) return NO_ACCOUNT;
      const p = await reads.product(BigInt(productoId));
      // El id y el hash los pone la app; el contrato los guarda tal cual.
      const orderId = newOrderId();
      const totalCents = p.priceCents * BigInt(cantidad);
      const orderHash = computeOrderHash({ id: orderId, productId: p.id, quantity: cantidad, totalCents, buyer: me, seller: p.seller });
      const r = await hub.write({
        fn: 'createOrder',
        args: [orderId, p.id, BigInt(cantidad), orderHash],
        title: 'Crear pedido',
        landed: async () => {
          await reads.order(orderId);
          return true;
        },
        rejected: 'El contrato rechazó el pedido.',
        saved: 'Pedido creado y registrado en la blockchain.',
      });
      return r.ok ? { ...resultado(r), orderId } : resultado(r);
    },
    async accionPedido(orderId: Direccion, accion) {
      const o = await reads.order(orderId);
      // Las mismas reglas que muestran los botones: si la acción no te toca, no se pide firma.
      const opcion = opcionesPedido(ordenDesde(o, ''), yo()).find((x) => x.accion === accion);
      if (!opcion) return { ok: false, message: 'Esa acción no está disponible para ti en este pedido.' };
      const next = statusDesdeEstado(opcion.siguiente);
      const r = await hub.write({
        fn: FUNCION_DE[accion],
        args: [o.id],
        title: opcion.etiqueta,
        landed: async () => (await reads.order(o.id)).status === next,
        rejected: 'El contrato rechazó la acción.',
        saved: `Listo: ${etiquetaEstado(opcion.siguiente)}.`,
      });
      if (r.ok) rememberTxHash(o.id, next, r.txHash);
      return resultado(r);
    },
  };
  return fuente;
}
