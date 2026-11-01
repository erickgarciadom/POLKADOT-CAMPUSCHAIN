/*
 * Lo que las pantallas le piden a los datos. Hay dos implementaciones:
 *  - src/data/realSource.ts: contrato (lecturas y firmas por el Host) + Firebase.
 *  - src/mocks/mockSource.ts: datos en memoria para `pnpm dev --mode mock`.
 * «Yo» es la cuenta conectada: la fuente la conoce, las pantallas no la pasan.
 */
import type {
  AccionPedido,
  Direccion,
  NuevoProducto,
  Orden,
  Paso,
  Producto,
  ReporteVentas,
  Reputacion,
  Resultado,
} from './types';

export interface DetallePedido {
  orden: Orden;
  producto: Producto;
  historial: Paso[];
}

export interface CampusData {
  /* ------------------------------------------------------------ lecturas */

  /** Productos disponibles de todos los vendedores, el más nuevo primero. */
  catalogo(): Promise<Producto[]>;
  producto(id: string): Promise<Producto>;
  reputacion(vendedor: Direccion): Promise<Reputacion>;
  /** Productos disponibles de un vendedor, el más nuevo primero. */
  productosDe(vendedor: Direccion): Promise<Producto[]>;
  /** Mis productos (disponibles y pausados), sin los que borré. El más nuevo primero. */
  misProductos(): Promise<Producto[]>;
  /** ¿Borré yo este producto? */
  borrado(id: string): Promise<boolean>;

  /** Pedidos que hice como comprador. */
  misPedidos(): Promise<Orden[]>;
  /** Pedidos que recibí como vendedor. */
  pedidosRecibidos(): Promise<Orden[]>;
  pedido(orderId: Direccion): Promise<DetallePedido>;
  /** Hash de transacción de cada paso del pedido. Puede venir incompleto; nunca falla. */
  txHashes(orderId: Direccion): Promise<Partial<Record<Paso['estado'], string>>>;
  /** Recalcula el hash del pedido y lo compara con el del contrato. */
  verificarPedido(orderId: Direccion): Promise<{ coincide: boolean; hash: string }>;
  /** «Mis ventas»: solo pedidos completados donde soy el vendedor. */
  reporteVentas(ahora: Date): Promise<ReporteVentas>;

  /* ----------------------------------------------------------- escrituras */

  publicarProducto(nuevo: NuevoProducto): Promise<Resultado>;
  cambiarDisponible(id: string, disponible: boolean): Promise<Resultado>;
  /** Solo el vendedor. Lo saca del catálogo y de «Mis productos». */
  borrarProducto(id: string): Promise<Resultado>;
  /** Si sale bien, `orderId` es el pedido nuevo. */
  crearPedido(productoId: string, cantidad: number): Promise<Resultado & { orderId?: Direccion }>;
  accionPedido(orderId: Direccion, accion: AccionPedido): Promise<Resultado>;
}
