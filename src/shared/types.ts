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

/**
 * Métricas de la tienda del vendedor (skill «metricas-ecommerce-universidad»), en JSON descargable.
 * Solo con datos reales del contrato. Lo que la app no registra (visitas, carrito, stock) va en
 * null y lo explica `notas`: nada se inventa.
 */
export interface MetricasTienda {
  periodo: {
    /** ISO 8601. */
    generado: string;
    /** «2026-2» = agosto–diciembre, «2026-1» = enero–junio (julio cuenta como verano, en el 1). */
    semestre: string;
    ventana_activos_dias: number;
  };
  metricas_financieras: {
    ingresos_totales_centavos: string;
    ingresos_semestre_centavos: string;
    pedidos_completados: number;
    /** AOV: ingresos / pedidos completados. */
    ticket_promedio_centavos: string | null;
    /** Pedidos completados / pedidos recibidos, en %. */
    tasa_conversion_pedidos_pct: number | null;
    /** Visitas → compra: la app no registra visitas. */
    tasa_conversion_visitas_pct: null;
  };
  comportamiento_usuarios: {
    /** Compradores distintos con un pedido en las últimas 24 h / 30 días. */
    compradores_activos_dia: number;
    compradores_activos_mes: number;
    compradores_recurrentes: number;
    /** Pedidos cancelados por el comprador / recibidos, en %. Lo más cercano al abandono. */
    tasa_cancelacion_pct: number | null;
    /** No hay carrito en la app. */
    tasa_abandono_carrito_pct: null;
    /** Hora local (0–23) con más pedidos, de mayor a menor. */
    horas_pico: { hora: number; pedidos: number }[];
    /** 0 = domingo. */
    dias_pico: { dia: number; pedidos: number }[];
    /** 0 = enero. Picos esperados: agosto y enero (inicio de semestre). */
    meses_pico: { mes: number; pedidos: number }[];
  };
  inventario_producto: {
    mas_vendidos: { producto_id: string; titulo: string; categoria: string; piezas: number; ingresos_centavos: string }[];
    productos_activos: number;
    productos_pausados: number;
    /** El contrato no guarda stock: sin datos no hay alertas. */
    alertas_bajo_inventario: { producto_id: string; titulo: string; stock: number }[] | null;
  };
  notas: string[];
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
