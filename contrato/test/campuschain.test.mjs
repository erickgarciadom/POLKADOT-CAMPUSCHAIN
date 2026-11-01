// Reglas de CampusChain.sol (el contrato del equipo) en una EVM local (harness.mjs). Sin red.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { encodeAbiParameters, keccak256, toHex } from 'viem';
import { deploy, expectRevert, player } from './harness.mjs';

const S = { NONE: 0, CREATED: 1, ACCEPTED: 2, PAYMENT_REPORTED: 3, DELIVERED: 4, COMPLETED: 5, CANCELLED: 6 };
const SELLER = player(1);
const BUYER = player(2);
const STRANGER = player(3);

const brownies = ['Brownies', 'Caseros, de chocolate', 'Comida', 'Explanada', 3500n];
const id = (n) => toHex(n, { size: 32 });
const ORDER = id(1);

/** El mismo hash que calcula la app (src/contract/campuschain.ts). */
const appHash = (orderId, productId, quantity, totalCents, buyer, seller) => keccak256(encodeAbiParameters(
  [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'address' }, { type: 'address' }],
  [orderId, productId, quantity, totalCents, buyer, seller],
));

/** Contrato con un producto de SELLER (id 1). */
async function withProduct() {
  const c = await deploy();
  await c.send(SELLER, 'createProduct', brownies);
  return c;
}

/** Contrato con el pedido ORDER de BUYER (2 brownies) en CREATED. */
async function withOrder() {
  const c = await withProduct();
  await c.send(BUYER, 'createOrder', [ORDER, 1n, 2n, appHash(ORDER, 1n, 2n, 7000n, BUYER, SELLER)]);
  return c;
}

/** Lleva ORDER hasta `steps` pasos del camino válido. */
async function orderAfter(steps) {
  const c = await withOrder();
  const path = [
    [SELLER, 'acceptOrder'],
    [SELLER, 'reportPayment'],
    [SELLER, 'confirmDelivery'],
    [BUYER, 'completeOrder'],
  ];
  for (const [from, fn] of path.slice(0, steps)) await c.send(from, fn, [ORDER]);
  return c;
}

const statusOf = async (c) => (await c.read('getOrder', [ORDER]))[6];

describe('catálogo', () => {
  it('publica un producto con su vendedor y disponible; los ids empiezan en 1', async () => {
    const c = await withProduct();
    const [seller, name, , category, pickup, price, available] = await c.read('getProduct', [1n]);
    assert.equal(seller, SELLER);
    assert.equal(name, 'Brownies');
    assert.equal(category, 'Comida');
    assert.equal(pickup, 'Explanada');
    assert.equal(price, 3500n);
    assert.equal(available, true);
    assert.equal(await c.read('productCount'), 1n);
    await expectRevert(c.read('getProduct', [0n]), 'ProductNotFound');
    await expectRevert(c.read('getProduct', [2n]), 'ProductNotFound');
  });

  it('solo el vendedor pausa su producto y pausado no se puede pedir', async () => {
    const c = await withProduct();
    await expectRevert(c.send(STRANGER, 'setAvailable', [1n, false]), 'NotSeller');
    await c.send(SELLER, 'setAvailable', [1n, false]);
    assert.equal((await c.read('getProduct', [1n]))[6], false);
    await expectRevert(c.send(BUYER, 'createOrder', [ORDER, 1n, 1n, ORDER]), 'ProductUnavailable');
  });
});

describe('crear pedido', () => {
  it('guarda comprador, vendedor, total y estado CREATED, y lo lista a los dos', async () => {
    const c = await withOrder();
    const [productId, buyer, seller, quantity, total, , status] = await c.read('getOrder', [ORDER]);
    assert.deepEqual([productId, buyer, seller, quantity, total, status], [1n, BUYER, SELLER, 2n, 7000n, S.CREATED]);
    assert.deepEqual(await c.read('getBuyerOrders', [BUYER]), [ORDER]);
    assert.deepEqual(await c.read('getSellerOrders', [SELLER]), [ORDER]);
    const history = await c.read('getHistory', [ORDER]);
    assert.equal(history.length, 1);
    assert.equal(history[0].status, S.CREATED);
    assert.equal(history[0].changedBy, BUYER);
  });

  it('rechaza id repetido, cantidad 0, producto inexistente y comprar lo propio', async () => {
    const c = await withOrder();
    await expectRevert(c.send(BUYER, 'createOrder', [ORDER, 1n, 1n, ORDER]), 'OrderExists');
    await expectRevert(c.send(BUYER, 'createOrder', [id(2), 1n, 0n, ORDER]), 'InvalidQuantity');
    await expectRevert(c.send(BUYER, 'createOrder', [id(2), 9n, 1n, ORDER]), 'ProductNotFound');
    await expectRevert(c.send(SELLER, 'createOrder', [id(2), 1n, 1n, ORDER]), 'SelfPurchase');
  });

  it('un pedido desconocido sale con estado NONE y no se puede verificar', async () => {
    const c = await withProduct();
    assert.equal(await statusOf(c), S.NONE);
    await expectRevert(c.read('verifyOrderHash', [ORDER, ORDER]), 'OrderNotFound');
  });

  it('el hash que calcula la app es el que se verifica', async () => {
    const c = await withOrder();
    const [productId, buyer, seller, quantity, total] = await c.read('getOrder', [ORDER]);
    assert.equal(await c.read('verifyOrderHash', [ORDER, appHash(ORDER, productId, quantity, total, buyer, seller)]), true);
    assert.equal(await c.read('verifyOrderHash', [ORDER, appHash(ORDER, productId, quantity + 1n, total, buyer, seller)]), false);
  });
});

describe('ciclo del pedido', () => {
  it('camino completo con historial de quién firmó cada paso', async () => {
    const c = await orderAfter(4);
    assert.equal(await statusOf(c), S.COMPLETED);
    const history = await c.read('getHistory', [ORDER]);
    assert.deepEqual(history.map((s) => s.status), [S.CREATED, S.ACCEPTED, S.PAYMENT_REPORTED, S.DELIVERED, S.COMPLETED]);
    assert.deepEqual(history.map((s) => s.changedBy), [BUYER, SELLER, SELLER, SELLER, BUYER]);
    const [accepted, completed, cancelled] = await c.read('getSellerStats', [SELLER]);
    assert.deepEqual([accepted, completed, cancelled], [1n, 1n, 0n]);
  });

  it('solo el vendedor acepta, reporta el pago y entrega', async () => {
    const c = await withOrder();
    await expectRevert(c.send(BUYER, 'acceptOrder', [ORDER]), 'NotSeller');
    await c.send(SELLER, 'acceptOrder', [ORDER]);
    await expectRevert(c.send(BUYER, 'reportPayment', [ORDER]), 'NotSeller');
    await c.send(SELLER, 'reportPayment', [ORDER]);
    await expectRevert(c.send(STRANGER, 'confirmDelivery', [ORDER]), 'NotSeller');
  });

  it('solo el comprador completa, y solo después de la entrega', async () => {
    const c = await orderAfter(2);
    await expectRevert(c.send(BUYER, 'completeOrder', [ORDER]), 'InvalidStatus');
    await c.send(SELLER, 'confirmDelivery', [ORDER]);
    await expectRevert(c.send(SELLER, 'completeOrder', [ORDER]), 'NotBuyer');
    await c.send(BUYER, 'completeOrder', [ORDER]);
  });

  it('no se saltan pasos y InvalidStatus dice el estado actual', async () => {
    const c = await withOrder();
    const e = await expectRevert(c.send(SELLER, 'reportPayment', [ORDER]), 'InvalidStatus');
    assert.equal(e.args[0], S.CREATED);
    await expectRevert(c.send(SELLER, 'confirmDelivery', [ORDER]), 'InvalidStatus');
  });

  it('el comprador cancela solo antes de que acepten, y cuenta para el vendedor', async () => {
    const c = await withOrder();
    await expectRevert(c.send(SELLER, 'cancelOrder', [ORDER]), 'NotBuyer');
    await c.send(BUYER, 'cancelOrder', [ORDER]);
    assert.equal(await statusOf(c), S.CANCELLED);
    await expectRevert(c.send(SELLER, 'acceptOrder', [ORDER]), 'InvalidStatus');
    assert.equal((await c.read('getSellerStats', [SELLER]))[2], 1n);

    const d = await orderAfter(1);
    await expectRevert(d.send(BUYER, 'cancelOrder', [ORDER]), 'InvalidStatus');
  });

  it('una acción sobre un pedido que no existe revierte con OrderNotFound', async () => {
    const c = await withProduct();
    await expectRevert(c.send(SELLER, 'acceptOrder', [ORDER]), 'OrderNotFound');
  });

  it('emite OrderCreated y OrderStatusChanged con el orderId (la app busca ahí los hashes de transacción)', async () => {
    const c = await withProduct();
    const created = await c.send(BUYER, 'createOrder', [ORDER, 1n, 1n, ORDER]);
    assert.equal(created.events.at(-1).eventName, 'OrderCreated');
    assert.equal(created.events.at(-1).args.orderId, ORDER);
    const accepted = await c.send(SELLER, 'acceptOrder', [ORDER]);
    assert.equal(accepted.events[0].eventName, 'OrderStatusChanged');
    assert.equal(accepted.events[0].args.newStatus, S.ACCEPTED);
  });
});
