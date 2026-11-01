import type { AbiEntry } from '@parity/product-sdk/contracts';
import { encodeAbiParameters, keccak256, toHex } from 'viem';
import abiJson from './campuschain.abi.json';

/** Generada con `pnpm --dir contrato abi` desde contrato/CampusChain.sol. No se edita a mano. */
export const campuschainAbi = abiJson as AbiEntry[];

export type Hex = `0x${string}`;
type Num = number | bigint;

export type QueryResult<T> = { success: true; value: T } | { success: false; value: unknown };

/** `origin`: cuenta SS58 para el Host. `from`: la misma cuenta en H160 para el ETH-RPC. */
export type ReadOptions = { origin?: string; from?: string; at?: 'best' | 'finalized' };

export type TxOptions = {
  waitFor?: 'best-block' | 'finalized';
  timeoutMs?: number;
  onStatus?: (status: unknown) => void;
};

export type TxResult = { txHash?: string; block?: { number?: number; hash?: string } };

type Read<Args extends unknown[], T> = {
  query: (...args: [...Args, ReadOptions?]) => Promise<QueryResult<T>>;
};

type Write<Args extends unknown[]> = Read<Args, unknown> & {
  tx: (...args: [...Args, TxOptions?]) => Promise<{ ok: true; value: TxResult } | { ok: false; error: unknown }>;
};

/** Las funciones de CampusChain.sol que usa la app, tipadas a mano porque la ABI se carga como JSON. */
export interface CampusChainContract {
  productCount: Read<[], Num>;
  getProduct: Read<[bigint], unknown>;
  getOrder: Read<[Hex], unknown>;
  getHistory: Read<[Hex], unknown>;
  getSellerStats: Read<[Hex], unknown>;
  verifyOrderHash: Read<[Hex, Hex], boolean>;
  getBuyerOrders: Read<[Hex], unknown>;
  getSellerOrders: Read<[Hex], unknown>;
  createProduct: Write<[string, string, string, string, bigint]>;
  setAvailable: Write<[bigint, boolean]>;
  createOrder: Write<[Hex, bigint, bigint, Hex]>;
  acceptOrder: Write<[Hex]>;
  reportPayment: Write<[Hex]>;
  confirmDelivery: Write<[Hex]>;
  completeOrder: Write<[Hex]>;
  cancelOrder: Write<[Hex]>;
}

export type WriteFn =
  | 'createProduct'
  | 'setAvailable'
  | 'createOrder'
  | 'acceptOrder'
  | 'reportPayment'
  | 'confirmDelivery'
  | 'completeOrder'
  | 'cancelOrder';

/* ----------------------------------------------------------------- estados */

/** El mismo orden que `enum Status` del contrato. NONE quiere decir que ese pedido no existe. */
export const Status = {
  NONE: 0,
  CREATED: 1,
  ACCEPTED: 2,
  PAYMENT_REPORTED: 3,
  DELIVERED: 4,
  COMPLETED: 5,
  CANCELLED: 6,
} as const;
export type Status = (typeof Status)[keyof typeof Status];

/** Textos de cada estado. El pago es una declaración del vendedor, nunca «pago verificado». */
export const STATUS_LABEL: Record<Status, string> = {
  0: 'Sin registrar',
  1: 'Creado',
  2: 'Aceptado',
  3: 'Pago reportado por vendedor',
  4: 'Entrega declarada por vendedor',
  5: 'Completado',
  6: 'Cancelado',
};

/** El camino feliz, para la barra de pasos. */
export const STATUS_PATH: readonly Status[] = [Status.CREATED, Status.ACCEPTED, Status.PAYMENT_REPORTED, Status.DELIVERED, Status.COMPLETED];

/** El contrato guarda la categoría como texto; la app ofrece estas. */
export const CATEGORIES = ['Comida', 'Accesorios', 'Escolar', 'Otro'] as const;

/**
 * Límites de la app, para avisar antes de firmar. El contrato solo exige cantidad mayor que 0;
 * estos evitan textos largos (más depósito de almacenamiento) y errores de dedo.
 */
export const LIMITS = {
  name: 60,
  description: 200,
  pickup: 40,
  maxPriceCents: 10_000_000,
  maxQuantity: 20,
} as const;

/* ------------------------------------------------------------------- tipos */

export interface Product {
  /** El contrato no lo devuelve: es el número con el que se leyó (1, 2, 3…). */
  id: bigint;
  seller: Hex;
  name: string;
  description: string;
  category: string;
  pickupPoint: string;
  priceCents: bigint;
  available: boolean;
}

export interface Order {
  /** bytes32 que generó la app del comprador al crear el pedido. */
  id: Hex;
  productId: bigint;
  buyer: Hex;
  seller: Hex;
  quantity: number;
  totalCents: bigint;
  orderHash: Hex;
  status: Status;
  createdAt: number;
}

export interface Step {
  status: Status;
  by: Hex;
  timestamp: number;
}

export interface SellerStats {
  accepted: number;
  completed: number;
  cancelled: number;
}

/* -------------------------------------------------------------- decodificar */

/*
 * viem devuelve las funciones con varias salidas (getProduct, getOrder, getSellerStats) como tupla
 * y las structs como objeto con nombre; el SDK del Host puede devolver cualquiera de las dos
 * formas. Se aceptan las dos, en el orden de la ABI.
 */

type Raw = Record<string, unknown> | unknown[];

const field = (raw: Raw, name: string, index: number): unknown =>
  Array.isArray(raw) ? raw[index] : raw[name];

const big = (v: unknown): bigint => (typeof v === 'bigint' ? v : BigInt((v as Num | string | undefined) ?? 0));
const num = (v: unknown): number => Number(big(v));
const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
const hex = (v: unknown): Hex => str(v) as Hex;

const asRaw = (value: unknown): Raw => {
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return value as Raw;
  throw new TypeError('Respuesta del contrato con forma inesperada');
};

const asStatus = (v: unknown): Status => {
  const n = num(v);
  if (n < 0 || n > 6) throw new RangeError(`Estado desconocido: ${n}`);
  return n as Status;
};

export function decodeProduct(id: bigint, value: unknown): Product {
  const r = asRaw(value);
  return {
    id,
    seller: hex(field(r, 'seller', 0)),
    name: str(field(r, 'name', 1)),
    description: str(field(r, 'description', 2)),
    category: str(field(r, 'category', 3)),
    pickupPoint: str(field(r, 'pickupPoint', 4)),
    priceCents: big(field(r, 'priceCents', 5)),
    available: Boolean(field(r, 'available', 6)),
  };
}

export function decodeOrder(id: Hex, value: unknown): Order {
  const r = asRaw(value);
  return {
    id,
    productId: big(field(r, 'productId', 0)),
    buyer: hex(field(r, 'buyer', 1)),
    seller: hex(field(r, 'seller', 2)),
    quantity: num(field(r, 'quantity', 3)),
    totalCents: big(field(r, 'totalCents', 4)),
    orderHash: hex(field(r, 'orderHash', 5)),
    status: asStatus(field(r, 'status', 6)),
    createdAt: num(field(r, 'createdAt', 7)),
  };
}

export function decodeStep(value: unknown): Step {
  const r = asRaw(value);
  return {
    status: asStatus(field(r, 'status', 0)),
    by: hex(field(r, 'changedBy', 1)),
    timestamp: num(field(r, 'timestamp', 2)),
  };
}

export function decodeStats(value: unknown): SellerStats {
  const r = asRaw(value);
  return {
    accepted: num(field(r, 'accepted', 0)),
    completed: num(field(r, 'completed', 1)),
    cancelled: num(field(r, 'cancelled', 2)),
  };
}

export const decodeList = <T>(value: unknown, decode: (v: unknown) => T): T[] =>
  (Array.isArray(value) ? value : []).map(decode);

/** Precio por pieza, para mostrarlo: el contrato guarda el total. */
export const unitCents = (o: Pick<Order, 'totalCents' | 'quantity'>) =>
  (o.quantity > 0 ? o.totalCents / BigInt(o.quantity) : o.totalCents);

/* --------------------------------------------------------------- id y hash */

/** Id nuevo de pedido: 32 bytes al azar. Si chocara con uno existente, el contrato revierte con OrderExists. */
export function newOrderId(): Hex {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * El hash del pedido: keccak256(abi.encode(orderId, productId, quantity, totalCents, buyer, seller)).
 * El contrato lo guarda tal cual lo manda la app. Para verificarlo se recalcula con lo que el
 * contrato devuelve en getOrder y se compara con verifyOrderHash.
 */
export function computeOrderHash(o: Pick<Order, 'id' | 'productId' | 'quantity' | 'totalCents' | 'buyer' | 'seller'>): Hex {
  return keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'address' }, { type: 'address' }],
    [o.id, o.productId, BigInt(o.quantity), o.totalCents, o.buyer, o.seller],
  ));
}
