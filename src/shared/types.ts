/*
 * Contrato de datos entre la interfaz (src/ui, Desarrollador 1) y los datos (src/data, contract,
 * hub, firebase, Desarrollador 2). Todo es JSON plano: los montos van como texto en centavos de MXN
 * (el contrato los guarda como uint256) para que se puedan serializar y escribir a mano en los mocks.
 *
 * Cambios aquí solo en PRs chicos a main que revisen los dos: rompen las dos ramas.
 */

export type Direccion = `0x${string}`;

/** Los mismos pasos que `enum Status` del contrato, sin NONE. */
export type EstadoOrden = 'creado' | 'aceptado' | 'pago-reportado' | 'entregado' | 'completado' | 'cancelado';

/** Resumen para listas y filtros: todo lo que no está cerrado está pendiente. */
export type ResumenOrden = 'pendiente' | 'completado' | 'cancelado';

export interface Producto {
  /** Número del producto en el contrato (1, 2, 3…), como texto. */
  id: string;
  vendedor: Direccion;
  titulo: string;
  descripcion: string;
  /** Centavos de MXN como texto: «3500» = $35.00. El pago es tradicional, fuera de la app. */
  precioCentavos: string;
  /** El contrato no maneja inventario: null mientras no exista una fuente para el stock. */
  stock: number | null;
  categoria: string;
  /** Punto general del campus donde se entrega. Obligatorio en el contrato. */
  puntoEntrega: string;
  /** El contrato no guarda imágenes: null mientras no exista una fuente permitida. */
  imagenUrl: string | null;
  /** false si el vendedor lo pausó o lo borró. */
  disponible: boolean;
}

export interface Orden {
  /** bytes32 al azar que genera la app del comprador. */
  orderId: Direccion;
  productoId: string;
  tituloProducto: string;
  cantidad: number;
  totalCentavos: string;
  comprador: Direccion;
  vendedor: Direccion;
  estado: EstadoOrden;
  resumen: ResumenOrden;
  /** Hash de los datos del pedido que guarda el contrato, para verificarlo. */
  orderHash: Direccion;
  /** Hash de la transacción que creó el pedido, si se conoce. En listas suele ser null. */
  txHash: string | null;
  /** Segundos (block.timestamp) en que se creó. */
  timestamp: number;
}

/** Un paso del historial del pedido. */
export interface Paso {
  estado: EstadoOrden;
  por: Direccion;
  timestamp: number;
}

/** Reputación del vendedor, calculada solo con lo que registró el contrato. */
export interface Reputacion {
  completados: number;
  aceptados: number;
  cancelados: number;
  /** completados / aceptados en %, redondeado. null sin pedidos aceptados: no se inventa un %. */
  tasa: number | null;
}

export interface Venta {
  orderId: Direccion;
  productoId: string;
  tituloProducto: string;
  cantidad: number;
  totalCentavos: string;
  /** Segundos en que el comprador confirmó que lo recibió. */
  completadoEn: number;
}

export interface ResumenPeriodo {
  ventas: number;
  piezas: number;
  totalCentavos: string;
  /** null sin ventas. */
  promedioCentavos: string | null;
}

/** Reporte de «Mis ventas»: solo pedidos completados. */
export interface ReporteVentas {
  semana: ResumenPeriodo;
  mes: ResumenPeriodo;
  anio: ResumenPeriodo;
  total: ResumenPeriodo;
  /** Últimos 6 meses, del más viejo al actual. `mes` va de 0 a 11. */
  meses: { anio: number; mes: number; resumen: ResumenPeriodo }[];
  /** De la más reciente a la más vieja. */
  ventas: Venta[];
}

/** Lo que llena el vendedor en «Publicar producto». */
export interface NuevoProducto {
  titulo: string;
  descripcion: string;
  categoria: string;
  puntoEntrega: string;
  precioCentavos: string;
}

/** Acciones de un pedido, según quién eres y en qué estado está. */
export type AccionPedido = 'aceptar' | 'reportarPago' | 'entregar' | 'completar' | 'cancelar';

export type Resultado =
  | { ok: true; message: string; txHash?: string }
  | { ok: false; message: string };

/** Usuario con sesión iniciada (Firebase, o el de demostración en modo mock). */
export interface Sesion {
  uid: string;
  email: string;
}
