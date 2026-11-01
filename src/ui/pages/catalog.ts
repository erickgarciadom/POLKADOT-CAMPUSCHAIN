import { CATEGORIES, computeOrderHash, LIMITS, newOrderId, type Product } from '../../contract/campuschain';
import { formatMxn } from '../../lib/money';
import { reputationLine, reputationOf } from '../../lib/reputation';
import type { Ctx } from '../context';
import { h, replace } from '../dom';
import { empty, personLink, reputationBlock } from '../parts';

/** #/ — productos disponibles, con búsqueda y categorías. */
export async function catalogPage(ctx: Ctx): Promise<HTMLElement> {
  const products = (await ctx.hub.reads.products()).filter((p) => p.available).reverse();
  const sellers = [...new Set(products.map((p) => p.seller.toLowerCase()))];
  const stats = new Map(await Promise.all(sellers.map(async (s) => [s, reputationOf(await ctx.hub.reads.stats(s as `0x${string}`))] as const)));

  // Las categorías de la app primero y después cualquier otra que ya esté en el contrato.
  const categories = [...new Set([...CATEGORIES, ...products.map((p) => p.category).filter(Boolean)])];

  let query = '';
  let category: string | null = null;
  const list = h('div', { class: 'grid' });

  const card = (p: Product) => h('a', { class: 'card product', href: `#/p/${p.id}` },
    h('div', { class: 'product-top' },
      h('span', { class: 'chip' }, p.category || 'Otro'),
      h('strong', { class: 'price' }, formatMxn(p.priceCents)),
    ),
    h('h3', null, p.name),
    p.description ? h('p', { class: 'muted clamp' }, p.description) : null,
    h('p', { class: 'small' }, '📍 ', p.pickupPoint),
    h('p', { class: 'small muted' }, 'Vendedor · ', reputationLine(stats.get(p.seller.toLowerCase())!)),
  );

  const draw = () => {
    const q = query.trim().toLowerCase();
    const shown = products.filter((p) =>
      (category === null || p.category === category)
      && (q === '' || `${p.name} ${p.description} ${p.pickupPoint}`.toLowerCase().includes(q)));
    replace(list, ...(shown.length ? shown.map(card) : [empty(products.length ? 'Nada coincide con tu búsqueda.' : 'Todavía no hay productos. ¡Publica el primero en Vender!')]));
  };

  const chips = h('div', { class: 'chips' });
  const drawChips = () => replace(chips,
    ...[null, ...categories].map((c) =>
      h('button', {
        class: `chip chip-btn${category === c ? ' on' : ''}`,
        type: 'button',
        onclick: () => {
          category = c;
          drawChips();
          draw();
        },
      }, c === null ? 'Todo' : c)));
  drawChips();
  draw();

  return h('div', null,
    h('div', { class: 'hero' },
      h('h1', null, 'Comercio universitario con confianza verificable'),
      h('p', { class: 'muted' }, 'Cada pedido deja un historial en Polkadot: quién lo aceptó, quién declaró el pago y la entrega, y cuándo lo confirmó el comprador.'),
    ),
    h('input', {
      class: 'input search',
      type: 'search',
      placeholder: 'Buscar brownies, pulseras, apuntes…',
      'aria-label': 'Buscar productos',
      oninput: (e: Event) => {
        query = (e.target as HTMLInputElement).value;
        draw();
      },
    }),
    chips,
    list,
  );
}

/** #/p/:id — detalle del producto y crear pedido. */
export async function productPage(ctx: Ctx, id: bigint): Promise<HTMLElement> {
  const p = await ctx.hub.reads.product(id);
  const rep = reputationOf(await ctx.hub.reads.stats(p.seller));
  const mine = ctx.me !== null && p.seller.toLowerCase() === ctx.me.toLowerCase();

  let quantity = 1;
  const qty = h('span', { class: 'qty-value' }, '1');
  const total = h('strong', null, formatMxn(p.priceCents));
  const setQty = (n: number) => {
    quantity = Math.min(LIMITS.maxQuantity, Math.max(1, n));
    qty.textContent = String(quantity);
    total.textContent = formatMxn(p.priceCents * BigInt(quantity));
  };

  const order = async () => {
    if (!(await ctx.ensureAccount())) return;
    const buyer = ctx.hub.getState().account!.h160;
    // El id y el hash los pone la app; el contrato los guarda tal cual.
    const orderId = newOrderId();
    const orderHash = computeOrderHash({
      id: orderId,
      productId: p.id,
      quantity,
      totalCents: p.priceCents * BigInt(quantity),
      buyer,
      seller: p.seller,
    });
    const r = await ctx.write({
      fn: 'createOrder',
      args: [orderId, p.id, BigInt(quantity), orderHash],
      title: 'Crear pedido',
      landed: async () => {
        await ctx.hub.reads.order(orderId);
        return true;
      },
      rejected: 'El contrato rechazó el pedido.',
      saved: 'Pedido creado y registrado en la blockchain.',
    });
    if (r.ok) ctx.go(`#/o/${orderId}`);
  };

  const toggle = async () => {
    const next = !p.available;
    const r = await ctx.write({
      fn: 'setAvailable',
      args: [p.id, next],
      title: next ? 'Reactivar producto' : 'Pausar producto',
      landed: async () => (await ctx.hub.reads.product(p.id)).available === next,
      rejected: 'El contrato rechazó el cambio.',
      saved: next ? 'Producto disponible otra vez.' : 'Producto pausado.',
    });
    if (r.ok) ctx.refresh();
  };

  return h('div', null,
    h('a', { class: 'back', href: '#/' }, '← Catálogo'),
    h('div', { class: 'card' },
      h('div', { class: 'product-top' },
        h('span', { class: 'chip' }, p.category || 'Otro'),
        p.available ? null : h('span', { class: 'badge badge-off' }, 'Pausado'),
      ),
      h('h1', null, p.name),
      p.description ? h('p', null, p.description) : null,
      h('p', { class: 'price big' }, formatMxn(p.priceCents)),
      h('p', null, '📍 Punto de entrega: ', h('strong', null, p.pickupPoint)),
      h('p', { class: 'muted small' }, `Producto #${p.id} · registrado en el contrato`),
    ),
    h('div', { class: 'card' },
      h('h2', null, 'Vendedor'),
      h('p', null, personLink(p.seller, ctx.me)),
      reputationBlock(rep),
      h('p', { class: 'muted small' }, 'La reputación se calcula solo con pedidos registrados en el contrato. Es un indicador del historial, no una garantía.'),
    ),
    mine
      ? h('div', { class: 'card' },
        h('p', null, 'Es tu producto.'),
        h('button', { class: 'btn', onclick: toggle }, p.available ? 'Pausar producto' : 'Reactivar producto'))
      : p.available
        ? h('div', { class: 'card' },
          h('h2', null, 'Hacer pedido'),
          h('div', { class: 'qty' },
            h('button', { class: 'btn btn-round', type: 'button', 'aria-label': 'Menos', onclick: () => setQty(quantity - 1) }, '−'),
            qty,
            h('button', { class: 'btn btn-round', type: 'button', 'aria-label': 'Más', onclick: () => setQty(quantity + 1) }, '+'),
            h('span', { class: 'muted' }, 'Total: '), total,
          ),
          h('p', { class: 'note' }, '💵 Pagas directo al vendedor en efectivo o transferencia, fuera de la app. CampusChain registra el pedido y cada paso, no el dinero.'),
          h('button', { class: 'btn btn-primary btn-block', onclick: order }, 'Hacer pedido'),
        )
        : h('div', { class: 'card' }, h('p', null, 'El vendedor pausó este producto por ahora.')),
  );
}
