import { describe, expect, it } from 'vitest';
import { computeOrderHash, decodeOrder, decodeProduct, decodeStep, newOrderId, Status, unitCents, type Order } from '../contract/campuschain';
import { revertMessage } from '../contract/errors';
import { formatMxn, parsePriceCents } from './money';
import { orderActions, waitsForMe } from './orderActions';
import { reputationLine, reputationOf } from './reputation';
import { classifyTxError, NO_DEPOSIT_MESSAGE } from './txErrors';

const SELLER = '0x0000000000000000000000000000000000000001';
const BUYER = '0x0000000000000000000000000000000000000002';
const OTHER = '0x0000000000000000000000000000000000000003';
const ID = `0x${'ab'.repeat(32)}` as const;

const order = (status: Status): Order => ({
  id: ID,
  productId: 1n,
  buyer: BUYER,
  seller: SELLER,
  quantity: 2,
  totalCents: 7000n,
  orderHash: '0x',
  status,
  createdAt: 1,
});

const fns = (s: Status, me: string | null) => orderActions(order(s), me).map((a) => a.fn);

describe('acciones del pedido', () => {
  it('el vendedor avanza el pedido paso a paso', () => {
    expect(fns(Status.CREATED, SELLER)).toEqual(['acceptOrder']);
    expect(fns(Status.ACCEPTED, SELLER)).toEqual(['reportPayment']);
    expect(fns(Status.PAYMENT_REPORTED, SELLER)).toEqual(['confirmDelivery']);
    expect(fns(Status.DELIVERED, SELLER)).toEqual([]);
  });

  it('el comprador cancela en CREATED y completa después de la entrega', () => {
    expect(fns(Status.CREATED, BUYER)).toEqual(['cancelOrder']);
    expect(fns(Status.ACCEPTED, BUYER)).toEqual([]);
    expect(fns(Status.DELIVERED, BUYER)).toEqual(['completeOrder']);
  });

  it('un tercero, o sin cuenta, no ve acciones; compara sin importar mayúsculas', () => {
    expect(fns(Status.CREATED, OTHER)).toEqual([]);
    expect(fns(Status.CREATED, null)).toEqual([]);
    expect(fns(Status.CREATED, SELLER.toUpperCase().replace('0X', '0x'))).toEqual(['acceptOrder']);
  });

  it('cerrado o sin registrar no tiene acciones', () => {
    expect(fns(Status.COMPLETED, BUYER)).toEqual([]);
    expect(fns(Status.CANCELLED, SELLER)).toEqual([]);
    expect(fns(Status.NONE, SELLER)).toEqual([]);
  });

  it('cancelar no cuenta como «te toca»', () => {
    expect(waitsForMe(order(Status.CREATED), BUYER)).toBe(false);
    expect(waitsForMe(order(Status.CREATED), SELLER)).toBe(true);
  });
});

describe('reputación', () => {
  it('calcula la tasa con los aceptados', () => {
    const r = reputationOf({ accepted: 4, completed: 3, cancelled: 1 });
    expect(r.completionRate).toBe(75);
    expect(r.open).toBe(1);
    expect(reputationLine(r)).toBe('3 completados de 4 aceptados');
  });

  it('sin pedidos aceptados no muestra porcentaje', () => {
    const r = reputationOf({ accepted: 0, completed: 0, cancelled: 1 });
    expect(r.completionRate).toBeNull();
    expect(reputationLine(r)).toBe('Sin pedidos completados todavía');
  });
});

describe('dinero', () => {
  it('lee precios escritos a mano', () => {
    expect(parsePriceCents('35')).toBe(3500n);
    expect(parsePriceCents('35.5')).toBe(3550n);
    expect(parsePriceCents('$1,200.00')).toBe(120000n);
    expect(parsePriceCents('0')).toBeNull();
    expect(parsePriceCents('3.555')).toBeNull();
    expect(parsePriceCents('-5')).toBeNull();
    expect(parsePriceCents('')).toBeNull();
  });

  it('formatea MXN y saca el precio por pieza del total', () => {
    expect(formatMxn(3500n)).toMatch(/\$\s?35\.00/);
    expect(unitCents(order(Status.CREATED))).toBe(3500n);
  });
});

describe('contrato', () => {
  it('decodifica getOrder como tupla (viem) o como objeto', () => {
    const tuple = [1n, BUYER, SELLER, 2n, 7000n, '0xab', 4, 10n];
    const fromTuple = decodeOrder(ID, tuple);
    expect(fromTuple.status).toBe(Status.DELIVERED);
    expect(fromTuple.totalCents).toBe(7000n);
    expect(fromTuple.id).toBe(ID);
    const fromObject = decodeOrder(ID, { productId: 1n, buyer: BUYER, seller: SELLER, quantity: 2n, totalCents: 7000n, orderHash: '0xab', status: 4, createdAt: 10n });
    expect(fromObject).toEqual(fromTuple);
  });

  it('decodifica getProduct y el historial', () => {
    const p = decodeProduct(3n, [SELLER, 'Brownies', 'Caseros', 'Comida', 'Explanada', 3500n, true]);
    expect(p).toMatchObject({ id: 3n, category: 'Comida', priceCents: 3500n, available: true });
    expect(decodeStep({ status: 1, changedBy: BUYER, timestamp: 5n })).toEqual({ status: Status.CREATED, by: BUYER, timestamp: 5 });
  });

  it('el id nuevo es un bytes32 distinto cada vez', () => {
    const a = newOrderId();
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(newOrderId()).not.toBe(a);
  });

  it('el hash cambia si cambia cualquier dato', () => {
    const base = order(Status.CREATED);
    expect(computeOrderHash(base)).not.toBe(computeOrderHash({ ...base, quantity: 3 }));
    expect(computeOrderHash(base)).not.toBe(computeOrderHash({ ...base, totalCents: 7001n }));
    expect(computeOrderHash(base)).toBe(computeOrderHash({ ...base }));
  });

  it('traduce los reverts del contrato', () => {
    expect(revertMessage({ error: 'NotSeller', args: [] })).toBe('Solo el vendedor puede hacer esto.');
    expect(revertMessage({ error: 'InvalidStatus', args: [2] })).toContain('Aceptado');
    expect(revertMessage('execution reverted: SelfPurchase')).toBe('No puedes comprar tu propio producto.');
    expect(revertMessage('algo raro')).toBeNull();
  });

  it('reconoce la falta de PAS para el depósito de almacenamiento', () => {
    const revive = { type: 'Module', value: { type: 'Revive', value: { type: 'StorageDepositNotEnoughFunds' } } };
    expect(revertMessage(revive)).toBe(NO_DEPOSIT_MESSAGE);
    const problem = classifyTxError(revive, 100n * 10n ** 10n, 10n ** 10n, (v) => String(v));
    expect(problem.kind).toBe('no-deposit');
    expect(problem.message).toContain('SS58');
  });
});
