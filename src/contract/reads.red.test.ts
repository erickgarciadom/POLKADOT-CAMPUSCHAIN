// Lecturas contra el contrato desplegado en Products Devnet. Necesita red: `pnpm test:red`.
import { describe, expect, it } from 'vitest';
import { computeOrderHash, newOrderId } from './campuschain';
import { revertMessage } from './errors';
import { createReads } from './reads';
import { createRpcContract } from './rpcReader';
import { readStatusTxHashes } from './txHashes';

const NOBODY = '0x00000000000000000000000000000000000c0ffe' as const;
const rpc = createRpcContract();
const reads = createReads(rpc);

describe('contrato desplegado', () => {
  it('lee y decodifica el catálogo completo', async () => {
    const products = await reads.products();
    for (const p of products) {
      expect(p.seller).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(typeof p.name).toBe('string');
      expect(typeof p.priceCents).toBe('bigint');
    }
  });

  it('un pedido que no existe se reporta como tal', async () => {
    await expect(reads.order(newOrderId())).rejects.toThrow('Ese pedido no existe.');
  });

  it('una cuenta sin actividad no tiene pedidos ni reputación', async () => {
    expect(await reads.buyerOrders(NOBODY)).toEqual([]);
    expect(await reads.sellerOrders(NOBODY)).toEqual([]);
    expect(await reads.stats(NOBODY)).toEqual({ accepted: 0, completed: 0, cancelled: 0 });
  });

  it('los eventos de un pedido desconocido salen vacíos, sin lanzar', async () => {
    expect((await readStatusTxHashes(newOrderId())).size).toBe(0);
  });

  it('simular un pedido de un producto inexistente revierte con un mensaje en español', async () => {
    const id = newOrderId();
    const hash = computeOrderHash({ id, productId: 999_999n, quantity: 1, totalCents: 0n, buyer: NOBODY, seller: NOBODY });
    const r = await rpc.createOrder.query(id, 999_999n, 1n, hash, { from: NOBODY });
    expect(r.success).toBe(false);
    expect(revertMessage(r.value)).toBe('Ese producto no existe.');
  });
});
