/*
 * Lecturas del contrato que usa la interfaz. Todas van por `reader` (ETH-RPC con respaldo del Host)
 * y no necesitan firma ni cuenta.
 */
import { describeError, withTimeout } from '../lib/format';
import {
  decodeList,
  decodeOrder,
  decodeProduct,
  decodeStats,
  decodeStep,
  Status,
  type CampusChainContract,
  type Hex,
  type Order,
  type Product,
  type QueryResult,
  type SellerStats,
  type Step,
} from './campuschain';
import { MAX_ITEMS_READ, READ_PARALLEL, READ_TIMEOUT_MS } from './config';

export interface Reads {
  /** Todos los productos, del 1 al último (hasta MAX_ITEMS_READ). */
  products(): Promise<Product[]>;
  product(id: bigint): Promise<Product>;
  order(id: Hex): Promise<Order>;
  history(id: Hex): Promise<Step[]>;
  verifyHash(id: Hex, hash: Hex): Promise<boolean>;
  buyerOrders(buyer: Hex): Promise<Order[]>;
  sellerOrders(seller: Hex): Promise<Order[]>;
  sellerProducts(seller: Hex): Promise<Product[]>;
  stats(seller: Hex): Promise<SellerStats>;
}

function unwrap<T>(result: QueryResult<T>, label: string): T {
  if (!result.success) throw new Error(`${label} revirtió: ${describeError(result.value)}`);
  return result.value;
}

const toBig = (value: unknown): bigint => (typeof value === 'bigint' ? value : BigInt((value as number | string | undefined) ?? 0));

/** `run` para cada elemento, con a lo más `limit` lecturas a la vez, en el orden original. */
async function mapLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await run(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export function createReads(reader: CampusChainContract): Reads {
  const q = async <T>(label: string, run: () => Promise<QueryResult<T>>): Promise<T> =>
    unwrap(await withTimeout(run(), READ_TIMEOUT_MS, label), label);

  const product = async (id: bigint) => decodeProduct(id, await q('getProduct', () => reader.getProduct.query(id)));

  const order = async (id: Hex) => {
    const o = decodeOrder(id, await q('getOrder', () => reader.getOrder.query(id)));
    // getOrder no revierte con un id desconocido: devuelve ceros con estado NONE.
    if (o.status === Status.NONE) throw new Error('Ese pedido no existe.');
    return o;
  };

  const products = async () => {
    const total = Math.min(Number(toBig(await q('productCount', () => reader.productCount.query()))), MAX_ITEMS_READ);
    const ids = Array.from({ length: total }, (_, i) => BigInt(i + 1));
    return mapLimit(ids, READ_PARALLEL, product);
  };

  /** Pedidos a partir de la lista de ids que devuelve el contrato (los más recientes al final). */
  const ordersOf = async (label: string, run: () => Promise<QueryResult<unknown>>) => {
    const ids = decodeList(await q(label, run), (v) => String(v) as Hex).slice(-MAX_ITEMS_READ);
    return mapLimit(ids, READ_PARALLEL, order);
  };

  return {
    products,
    product,
    order,
    history: async (id) => decodeList(await q('getHistory', () => reader.getHistory.query(id)), decodeStep),
    verifyHash: async (id, hash) => Boolean(await q('verifyOrderHash', () => reader.verifyOrderHash.query(id, hash))),
    buyerOrders: (buyer) => ordersOf('getBuyerOrders', () => reader.getBuyerOrders.query(buyer)),
    sellerOrders: (seller) => ordersOf('getSellerOrders', () => reader.getSellerOrders.query(seller)),
    // El contrato no lista los productos de un vendedor: se filtran del catálogo.
    sellerProducts: async (seller) => (await products()).filter((p) => p.seller.toLowerCase() === seller.toLowerCase()),
    stats: async (seller) => decodeStats(await q('getSellerStats', () => reader.getSellerStats.query(seller))),
  };
}
