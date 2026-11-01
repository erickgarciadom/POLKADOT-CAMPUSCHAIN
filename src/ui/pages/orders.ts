import { shortAddress } from '../../lib/format';
import { formatMxn, formatTimestamp } from '../../lib/money';
import { CAMINO, meToca, opcionesPedido, type OpcionPedido } from '../../shared/estados';
import type { Direccion, Orden } from '../../shared/types';
import type { Ctx } from '../context';
import { h, replace } from '../dom';
import { bloque, empty, estadoBadge, explorerTx, external, personLink } from '../parts';

/** «Pedido 0x1a2b…9f0e»: el id es un bytes32, demasiado largo para mostrarlo entero. */
export const orderLabel = (id: string) => `Pedido ${shortAddress(id)}`;

/** Precio por pieza, para mostrarlo: el contrato guarda el total. */
const unitario = (o: Pick<Orden, 'totalCentavos' | 'cantidad'>) =>
  formatMxn(o.cantidad > 0 ? BigInt(o.totalCentavos) / BigInt(o.cantidad) : BigInt(o.totalCentavos));

/** Fila de un pedido en una lista. */
export function orderRow(o: Orden, ctx: Ctx): HTMLElement {
  const mine = meToca(o, ctx.me);
  return h('a', { class: `card row${mine ? ' row-attention' : ''}`, href: `#/o/${o.orderId}` },
    h('div', { class: 'row-main' },
      h('strong', null, o.tituloProducto),
      h('span', { class: 'muted small' }, `${o.cantidad} × ${unitario(o)} · ${formatTimestamp(o.timestamp)}`),
    ),
    h('div', { class: 'row-side' }, estadoBadge(o.estado), mine ? h('span', { class: 'small attention' }, 'Te toca') : null),
  );
}

export function orderList(ctx: Ctx, orders: Orden[], emptyText: string): HTMLElement {
  if (!orders.length) return empty(emptyText);
  const sorted = [...orders].sort((a, b) => Number(meToca(b, ctx.me)) - Number(meToca(a, ctx.me)) || b.timestamp - a.timestamp);
  return h('div', { class: 'list' }, ...sorted.map((o) => orderRow(o, ctx)));
}

/** #/pedidos — lo que compraste. */
export async function myOrdersPage(ctx: Ctx): Promise<HTMLElement> {
  if (!ctx.me) {
    return h('div', null, h('h1', null, 'Mis pedidos'),
      empty('Conecta tu cuenta para ver tus pedidos.', h('button', { class: 'btn btn-primary', onclick: () => ctx.ensureAccount().then((ok) => ok && ctx.refresh()) }, 'Conectar cuenta')));
  }
  const orders = await ctx.data.misPedidos();
  return h('div', null,
    h('h1', null, 'Mis pedidos'),
    orderList(ctx, orders, 'Todavía no haces pedidos. Explora el catálogo.'),
  );
}

/** Barra de pasos del pedido. */
function progressBar(o: Orden): HTMLElement {
  if (o.estado === 'cancelado') return h('div', { class: 'steps' }, h('div', { class: 'step done' }, 'Creado'), h('div', { class: 'step cancel' }, 'Cancelado'));
  const at = CAMINO.indexOf(o.estado);
  const short = ['Creado', 'Aceptado', 'Pago reportado', 'Entregado', 'Completado'];
  return h('div', { class: 'steps' }, ...CAMINO.map((_, i) => h('div', { class: `step${i < at ? ' done' : i === at ? ' now' : ''}` }, short[i]!)));
}

/** #/o/:id — pedido verificable: estado, acciones, historial on-chain y hash. */
export async function orderPage(ctx: Ctx, id: Direccion): Promise<HTMLElement> {
  const { orden: o, producto, historial } = await ctx.data.pedido(id);
  const who = (a: Direccion) => personLink(a, ctx.me);
  const role = (a: Direccion) => (a.toLowerCase() === o.comprador.toLowerCase() ? 'comprador' : a.toLowerCase() === o.vendedor.toLowerCase() ? 'vendedor' : '');

  const act = async (op: OpcionPedido) => {
    const r = await ctx.data.accionPedido(o.orderId, op.accion);
    if (r.ok) ctx.refresh();
  };

  const actions = opcionesPedido(o, ctx.me);
  const actionCard = actions.length
    ? h('div', { class: 'card card-accent accion' },
      h('h2', null, 'Te toca'),
      ...actions.map((a) => h('div', { class: 'action' },
        h('button', { class: `btn btn-block ${a.peligro ? 'btn-danger' : 'btn-primary'}`, onclick: () => act(a) }, a.etiqueta),
        h('p', { class: 'muted small' }, a.ayuda))),
    )
    : null;

  // Hash de cada transacción: llega después, de los eventos del contrato.
  const txCells = new Map<string, HTMLElement>();
  const timeline = h('ol', { class: 'timeline' }, ...historial.map((s) => {
    const tx = h('span', { class: 'small muted' }, 'Buscando transacción…');
    txCells.set(s.estado, tx);
    return h('li', null,
      h('div', { class: 'tl-head' }, estadoBadge(s.estado), h('span', { class: 'small muted' }, formatTimestamp(s.timestamp))),
      h('p', { class: 'small' }, 'Firmado por ', who(s.por), role(s.por) ? ` · ${role(s.por)}` : ''),
      h('p', { class: 'small' }, tx),
    );
  }));
  void ctx.data.txHashes(o.orderId).then((hashes) => {
    for (const [estado, cell] of txCells) {
      const hash = hashes[estado as keyof typeof hashes];
      replace(cell, hash ? external(explorerTx(hash), `Transacción ${shortAddress(hash)}`) : 'Transacción no disponible en el RPC');
    }
  });

  const verifyOut = h('div', { class: 'verify-out' });
  const verify = async () => {
    replace(verifyOut, h('span', { class: 'muted small' }, 'Comprobando…'));
    try {
      const { coincide, hash } = await ctx.data.verificarPedido(o.orderId);
      replace(verifyOut,
        h('p', { class: coincide ? 'ok' : 'bad' }, coincide
          ? 'El hash coincide: los datos de este pedido son los que se registraron al crearlo.'
          : 'El hash NO coincide con estos datos. Si el pedido se creó desde otra app, puede que calcule el hash de otra forma.'),
        h('p', { class: 'mono small break' }, hash),
      );
    } catch (error) {
      replace(verifyOut, h('p', { class: 'bad' }, 'No se pudo comprobar. Reintenta.'));
      console.warn('[campuschain] verifyOrderHash', error);
    }
  };

  return h('div', null,
    h('a', { class: 'back', href: ctx.me && o.vendedor.toLowerCase() === ctx.me.toLowerCase() ? '#/vender' : '#/pedidos' }, 'Pedidos'),
    h('div', { class: 'card resumen' },
      h('div', { class: 'product-top' }, h('span', { class: 'muted mono' }, orderLabel(o.orderId)), estadoBadge(o.estado)),
      h('h1', null, h('a', { href: `#/p/${producto.id}` }, producto.titulo)),
      progressBar(o),
      h('dl', { class: 'facts' },
        h('dt', null, 'Cantidad'), h('dd', null, `${o.cantidad} × ${unitario(o)}`),
        h('dt', null, 'Total'), h('dd', null, h('strong', null, formatMxn(BigInt(o.totalCentavos)))),
        h('dt', null, 'Entrega'), h('dd', null, producto.puntoEntrega),
        h('dt', null, 'Comprador'), h('dd', null, who(o.comprador)),
        h('dt', null, 'Vendedor'), h('dd', null, who(o.vendedor)),
      ),
      ['pago-reportado', 'entregado', 'completado'].includes(o.estado)
        ? h('p', { class: 'note' }, '«Pago reportado» es una declaración firmada por el vendedor. La blockchain registra quién la hizo y cuándo; no verifica el banco ni el efectivo.')
        : null,
    ),
    actionCard,
    bloque('historial', 'Historial en la blockchain', timeline),
    bloque('verificar', 'Verificar el pedido',
      h('p', { class: 'muted small' }, 'La app recalcula el hash con los datos que guarda el contrato (id del pedido, producto, cantidad, total, comprador y vendedor) y le pregunta al contrato si es el que quedó registrado al crearlo.'),
      h('button', { class: 'btn', onclick: verify }, 'Verificar hash'),
      verifyOut,
    ),
  );
}
