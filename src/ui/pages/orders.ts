import { computeOrderHash, Status, STATUS_LABEL, STATUS_PATH, unitCents, type Hex, type Order, type Product } from '../../contract/campuschain';
import { readStatusTxHashes, rememberTxHash } from '../../contract/txHashes';
import { shortAddress } from '../../lib/format';
import { formatMxn, formatTimestamp } from '../../lib/money';
import { orderActions, waitsForMe, type OrderAction } from '../../lib/orderActions';
import type { Ctx } from '../context';
import { h, replace } from '../dom';
import { empty, explorerTx, external, personLink, section, statusBadge } from '../parts';

/** «Pedido 0x1a2b…9f0e»: el id es un bytes32, demasiado largo para mostrarlo entero. */
export const orderLabel = (id: Hex) => `Pedido ${shortAddress(id)}`;

/** Productos de una lista de pedidos, sin repetir lecturas. */
async function productsOf(ctx: Ctx, orders: Order[]): Promise<Map<string, Product>> {
  const ids = [...new Set(orders.map((o) => o.productId.toString()))];
  const list = await Promise.all(ids.map((id) => ctx.hub.reads.product(BigInt(id))));
  return new Map(list.map((p) => [p.id.toString(), p]));
}

/** Fila de un pedido en una lista. */
export function orderRow(o: Order, product: Product | undefined, ctx: Ctx): HTMLElement {
  const mine = waitsForMe(o, ctx.me);
  return h('a', { class: `card row${mine ? ' row-attention' : ''}`, href: `#/o/${o.id}` },
    h('div', { class: 'row-main' },
      h('strong', null, product?.name ?? `Producto #${o.productId}`),
      h('span', { class: 'muted small' }, `${o.quantity} × ${formatMxn(unitCents(o))} · ${formatTimestamp(o.createdAt)}`),
    ),
    h('div', { class: 'row-side' }, statusBadge(o.status), mine ? h('span', { class: 'small attention' }, 'Te toca') : null),
  );
}

export async function orderList(ctx: Ctx, orders: Order[], emptyText: string): Promise<HTMLElement> {
  if (!orders.length) return empty(emptyText);
  const products = await productsOf(ctx, orders);
  const sorted = [...orders].sort((a, b) => Number(waitsForMe(b, ctx.me)) - Number(waitsForMe(a, ctx.me)) || b.createdAt - a.createdAt);
  return h('div', { class: 'list' }, ...sorted.map((o) => orderRow(o, products.get(o.productId.toString()), ctx)));
}

/** #/pedidos — lo que compraste. */
export async function myOrdersPage(ctx: Ctx): Promise<HTMLElement> {
  if (!ctx.me) {
    return h('div', null, h('h1', null, 'Mis pedidos'),
      empty('Conecta tu cuenta para ver tus pedidos.', h('button', { class: 'btn btn-primary', onclick: () => ctx.ensureAccount().then((ok) => ok && ctx.refresh()) }, 'Conectar cuenta')));
  }
  const orders = await ctx.hub.reads.buyerOrders(ctx.me);
  return h('div', null,
    h('h1', null, 'Mis pedidos'),
    await orderList(ctx, orders, 'Todavía no haces pedidos. Explora el catálogo.'),
  );
}

/** Barra de pasos del pedido. */
function progressBar(o: Order): HTMLElement {
  if (o.status === Status.CANCELLED) return h('div', { class: 'steps' }, h('div', { class: 'step done' }, 'Creado'), h('div', { class: 'step cancel' }, 'Cancelado'));
  const at = STATUS_PATH.indexOf(o.status);
  const short = ['Creado', 'Aceptado', 'Pago reportado', 'Entregado', 'Completado'];
  return h('div', { class: 'steps' }, ...STATUS_PATH.map((_, i) => h('div', { class: `step${i < at ? ' done' : i === at ? ' now' : ''}` }, short[i]!)));
}

/** #/o/:id — pedido verificable: estado, acciones, historial on-chain y hash. */
export async function orderPage(ctx: Ctx, id: Hex): Promise<HTMLElement> {
  const reads = ctx.hub.reads;
  const [o, history] = await Promise.all([reads.order(id), reads.history(id)]);
  const product = await reads.product(o.productId);
  const who = (a: Hex) => personLink(a, ctx.me);
  const role = (a: Hex) => (a.toLowerCase() === o.buyer.toLowerCase() ? 'comprador' : a.toLowerCase() === o.seller.toLowerCase() ? 'vendedor' : '');

  /** Firma una acción del pedido y guarda el hash de la transacción para el historial. */
  const act = async (fn: OrderAction) => {
    const r = await ctx.write({
      fn: fn.fn,
      args: [o.id],
      title: fn.label,
      landed: async () => (await reads.order(o.id)).status === fn.next,
      rejected: 'El contrato rechazó la acción.',
      saved: `Listo: ${STATUS_LABEL[fn.next]}.`,
    });
    if (r.ok) {
      rememberTxHash(o.id, fn.next, r.txHash);
      ctx.refresh();
    }
  };

  const actions = orderActions(o, ctx.me);
  const actionCard = actions.length
    ? h('div', { class: 'card card-accent' },
      h('h2', null, 'Te toca'),
      ...actions.map((a) => h('div', { class: 'action' },
        h('button', { class: `btn btn-block ${a.danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => act(a) }, a.label),
        h('p', { class: 'muted small' }, a.hint))),
    )
    : null;

  // Hash de cada transacción: llega después, de los eventos del contrato.
  const txCells = new Map<Status, HTMLElement>();
  const timeline = h('ol', { class: 'timeline' }, ...history.map((s) => {
    const tx = h('span', { class: 'small muted' }, 'Buscando transacción…');
    txCells.set(s.status, tx);
    return h('li', null,
      h('div', { class: 'tl-head' }, statusBadge(s.status), h('span', { class: 'small muted' }, formatTimestamp(s.timestamp))),
      h('p', { class: 'small' }, 'Firmado por ', who(s.by), role(s.by) ? ` · ${role(s.by)}` : ''),
      h('p', { class: 'small' }, tx),
    );
  }));
  void readStatusTxHashes(o.id).then((hashes) => {
    for (const [status, cell] of txCells) {
      const hash = hashes.get(status);
      replace(cell, hash ? external(explorerTx(hash), `Transacción ${shortAddress(hash)}`) : 'Transacción no disponible en el RPC');
    }
  });

  const verifyOut = h('div', { class: 'verify-out' });
  const verify = async () => {
    replace(verifyOut, h('span', { class: 'muted small' }, 'Comprobando…'));
    try {
      const local = computeOrderHash(o);
      const ok = await reads.verifyHash(o.id, local);
      replace(verifyOut,
        h('p', { class: ok ? 'ok' : 'bad' }, ok
          ? '✓ El hash coincide: los datos de este pedido son los que se registraron al crearlo.'
          : '✗ El hash NO coincide con estos datos. Si el pedido se creó desde otra app, puede que calcule el hash de otra forma.'),
        h('p', { class: 'mono small break' }, local),
      );
    } catch (error) {
      replace(verifyOut, h('p', { class: 'bad' }, 'No se pudo comprobar. Reintenta.'));
      console.warn('[campuschain] verifyOrderHash', error);
    }
  };

  return h('div', null,
    h('a', { class: 'back', href: ctx.me && o.seller.toLowerCase() === ctx.me.toLowerCase() ? '#/vender' : '#/pedidos' }, '← Pedidos'),
    h('div', { class: 'card' },
      h('div', { class: 'product-top' }, h('span', { class: 'muted mono' }, orderLabel(o.id)), statusBadge(o.status)),
      h('h1', null, h('a', { href: `#/p/${product.id}` }, product.name)),
      progressBar(o),
      h('dl', { class: 'facts' },
        h('dt', null, 'Cantidad'), h('dd', null, `${o.quantity} × ${formatMxn(unitCents(o))}`),
        h('dt', null, 'Total'), h('dd', null, h('strong', null, formatMxn(o.totalCents))),
        h('dt', null, 'Entrega'), h('dd', null, `📍 ${product.pickupPoint}`),
        h('dt', null, 'Comprador'), h('dd', null, who(o.buyer)),
        h('dt', null, 'Vendedor'), h('dd', null, who(o.seller)),
      ),
      o.status >= Status.PAYMENT_REPORTED && o.status !== Status.CANCELLED
        ? h('p', { class: 'note' }, 'ℹ️ «Pago reportado» es una declaración firmada por el vendedor. La blockchain registra quién la hizo y cuándo; no verifica el banco ni el efectivo.')
        : null,
    ),
    actionCard,
    section('Historial en la blockchain', timeline),
    section('Verificar el pedido',
      h('p', { class: 'muted small' }, 'La app recalcula el hash con los datos que guarda el contrato (id del pedido, producto, cantidad, total, comprador y vendedor) y le pregunta al contrato si es el que quedó registrado al crearlo.'),
      h('button', { class: 'btn', onclick: verify }, 'Verificar hash'),
      verifyOut,
    ),
  );
}
