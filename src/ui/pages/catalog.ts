import { CATEGORIES, LIMITS } from '../../contract/campuschain';
import { formatMxn } from '../../lib/money';
import type { Producto, Reputacion } from '../../shared/types';
import type { Ctx } from '../context';
import { deleteButton, esMio } from '../deleteProduct';
import { h, replace } from '../dom';
import { empty, lineaReputacion, personLink, reputationBlock } from '../parts';

const precio = (p: Pick<Producto, 'precioCentavos'>, cantidad = 1) => formatMxn(BigInt(p.precioCentavos) * BigInt(cantidad));

/** #/ — productos disponibles, con búsqueda y categorías. */
export async function catalogPage(ctx: Ctx): Promise<HTMLElement> {
  const products = await ctx.data.catalogo();
  const sellers = [...new Set(products.map((p) => p.vendedor.toLowerCase()))];
  const stats = new Map<string, Reputacion>(await Promise.all(sellers.map(async (s) => [s, await ctx.data.reputacion(s as `0x${string}`)] as const)));

  // Las categorías de la app primero y después cualquier otra que ya esté en el contrato.
  const categories = [...new Set([...CATEGORIES, ...products.map((p) => p.categoria).filter(Boolean)])];

  let query = '';
  let category: string | null = null;
  const list = h('div', { class: 'grid' });

  const card = (p: Producto) => h('a', { class: 'card product', href: `#/p/${p.id}` },
    h('div', { class: 'product-top' },
      h('span', { class: 'chip' }, p.categoria || 'Otro'),
      h('strong', { class: 'price' }, precio(p)),
    ),
    h('h3', null, p.titulo),
    p.descripcion ? h('p', { class: 'muted clamp' }, p.descripcion) : null,
    h('p', { class: 'small' }, '📍 ', p.puntoEntrega),
    h('p', { class: 'small muted' }, 'Vendedor · ', lineaReputacion(stats.get(p.vendedor.toLowerCase())!)),
  );

  const draw = () => {
    const q = query.trim().toLowerCase();
    const shown = products.filter((p) =>
      (category === null || p.categoria === category)
      && (q === '' || `${p.titulo} ${p.descripcion} ${p.puntoEntrega}`.toLowerCase().includes(q)));
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
export async function productPage(ctx: Ctx, id: string): Promise<HTMLElement> {
  const p = await ctx.data.producto(id);
  const rep = await ctx.data.reputacion(p.vendedor);
  const mine = esMio(ctx, p);
  const borrado = mine && !p.disponible && (await ctx.data.borrado(p.id));

  let quantity = 1;
  const qty = h('span', { class: 'qty-value' }, '1');
  const total = h('strong', null, precio(p));
  const setQty = (n: number) => {
    quantity = Math.min(LIMITS.maxQuantity, Math.max(1, n));
    qty.textContent = String(quantity);
    total.textContent = precio(p, quantity);
  };

  const order = async () => {
    if (!(await ctx.ensureAccount())) return;
    const r = await ctx.data.crearPedido(p.id, quantity);
    if (r.ok && r.orderId) ctx.go(`#/o/${r.orderId}`);
  };

  const toggle = async () => {
    const r = await ctx.data.cambiarDisponible(p.id, !p.disponible);
    if (r.ok) ctx.refresh();
  };

  return h('div', null,
    h('a', { class: 'back', href: '#/' }, '← Catálogo'),
    h('div', { class: 'card ficha' },
      h('div', { class: 'product-top' },
        h('span', { class: 'chip' }, p.categoria || 'Otro'),
        p.disponible ? null : h('span', { class: 'badge badge-off' }, borrado ? 'Borrado' : 'Pausado'),
      ),
      h('h1', null, p.titulo),
      p.descripcion ? h('p', null, p.descripcion) : null,
      h('p', { class: 'price big' }, precio(p)),
      h('p', null, '📍 Punto de entrega: ', h('strong', null, p.puntoEntrega)),
      h('p', { class: 'muted small' }, `Producto #${p.id} · registrado en el contrato`),
    ),
    h('div', { class: 'card vendedor-card' },
      h('h2', null, 'Vendedor'),
      h('p', null, personLink(p.vendedor, ctx.me)),
      reputationBlock(rep),
      h('p', { class: 'muted small' }, 'La reputación se calcula solo con pedidos registrados en el contrato. Es un indicador del historial, no una garantía.'),
    ),
    borrado
      ? h('div', { class: 'card compra' }, h('p', null, 'Borraste este producto. Ya no aparece en el catálogo.'))
      : mine
      ? h('div', { class: 'card compra' },
        h('p', null, 'Es tu producto.'),
        h('p', null,
          h('button', { class: 'btn', onclick: toggle }, p.disponible ? 'Pausar producto' : 'Reactivar producto'),
          ' ',
          deleteButton(ctx, p, () => ctx.go('#/vender'))))
      : p.disponible
        ? h('div', { class: 'card compra' },
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
        : h('div', { class: 'card compra' }, h('p', null, 'El vendedor pausó este producto por ahora.')),
  );
}
