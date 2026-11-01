import { CATEGORIES, LIMITS, type Product } from '../../contract/campuschain';
import { productosBorrados } from '../../firebase/borrados';
import { formatMxn, parsePriceCents } from '../../lib/money';
import type { Ctx } from '../context';
import { deleteButton } from '../deleteProduct';
import { h } from '../dom';
import { empty, section } from '../parts';
import { orderList } from './orders';

const PICKUP_POINTS = ['Biblioteca', 'Explanada', 'Cafetería', 'Entrada principal', 'Facultad de Ingeniería'];

/** #/vender — pedidos recibidos, mis productos y publicar. */
export async function sellPage(ctx: Ctx): Promise<HTMLElement> {
  if (!ctx.me) {
    return h('div', null, h('h1', null, 'Vender'),
      empty('Conecta tu cuenta para publicar productos y atender pedidos.', h('button', { class: 'btn btn-primary', onclick: () => ctx.ensureAccount().then((ok) => ok && ctx.refresh()) }, 'Conectar cuenta')));
  }
  const me = ctx.me;
  const [orders, all, borrados] = await Promise.all([
    ctx.hub.reads.sellerOrders(me),
    ctx.hub.reads.sellerProducts(me),
    productosBorrados(ctx.usuario.uid).catch(() => new Set<string>()),
  ]);
  // Los borrados siguen en el contrato (no disponibles); se quitan de la lista.
  const products = all.filter((p) => p.available || !borrados.has(p.id.toString()));

  return h('div', null,
    h('h1', null, 'Vender'),
    section('Pedidos recibidos', await orderList(ctx, orders, 'Todavía no recibes pedidos.')),
    section('Mis productos', products.length
      ? h('div', { class: 'list' }, ...[...products].reverse().map((p) => productRow(ctx, p)))
      : empty('Todavía no publicas productos.')),
    section('Publicar producto', publishForm(ctx, all.length)),
    h('p', { class: 'muted small' }, 'Todo lo que publicas queda en un contrato público. No pongas tu nombre completo, teléfono ni dirección: usa un punto general del campus.'),
  );
}

function productRow(ctx: Ctx, p: Product): HTMLElement {
  const toggle = async (e: Event) => {
    e.preventDefault();
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
  return h('div', { class: 'card row' },
    h('a', { class: 'row-main', href: `#/p/${p.id}` },
      h('strong', null, p.name),
      h('span', { class: 'muted small' }, `${formatMxn(p.priceCents)} · ${p.category || 'Otro'} · 📍 ${p.pickupPoint}`),
    ),
    h('div', { class: 'row-side' },
      p.available ? h('span', { class: 'badge badge-ok' }, 'Disponible') : h('span', { class: 'badge badge-off' }, 'Pausado'),
      h('button', { class: 'btn btn-small', onclick: toggle }, p.available ? 'Pausar' : 'Reactivar'),
      deleteButton(ctx, p, () => ctx.refresh(), true),
    ),
  );
}

function publishForm(ctx: Ctx, count: number): HTMLElement {
  const error = h('p', { class: 'bad small', role: 'alert' });
  const field = (label: string, input: HTMLElement, hint?: string) =>
    h('label', { class: 'field' }, h('span', null, label), input, hint ? h('span', { class: 'muted small' }, hint) : null);

  const name = h('input', { class: 'input', maxlength: LIMITS.name, required: true, placeholder: 'Brownies de chocolate' });
  const description = h('textarea', { class: 'input', maxlength: LIMITS.description, rows: 3, placeholder: 'Caseros, porción individual. Pedidos de lunes a viernes.' });
  const price = h('input', { class: 'input', inputmode: 'decimal', required: true, placeholder: '35.00' });
  const category = h('select', { class: 'input' }, ...CATEGORIES.map((c) => h('option', { value: c }, c)));
  const pickup = h('input', { class: 'input', maxlength: LIMITS.pickup, required: true, list: 'pickup-points', placeholder: 'Explanada' });
  const points = h('datalist', { id: 'pickup-points' }, ...PICKUP_POINTS.map((p) => h('option', { value: p })));

  const bytes = (s: string) => new TextEncoder().encode(s).length;

  const submit = async (e: Event) => {
    e.preventDefault();
    error.textContent = '';
    const cents = parsePriceCents(price.value);
    const n = name.value.trim();
    const pk = pickup.value.trim();
    const desc = description.value.trim();
    if (!n || bytes(n) > LIMITS.name) return void (error.textContent = `El nombre debe tener de 1 a ${LIMITS.name} caracteres.`);
    if (bytes(desc) > LIMITS.description) return void (error.textContent = `La descripción admite hasta ${LIMITS.description} caracteres.`);
    if (cents === null || cents > BigInt(LIMITS.maxPriceCents)) return void (error.textContent = 'Escribe un precio válido en pesos, por ejemplo 35 o 35.50.');
    if (!pk || bytes(pk) > LIMITS.pickup) return void (error.textContent = 'Escribe un punto general de entrega dentro del campus.');
    if (!(await ctx.ensureAccount())) return;
    const me = ctx.hub.getState().account!.h160;
    const r = await ctx.write({
      fn: 'createProduct',
      args: [n, desc, category.value, pk, cents],
      title: 'Publicar producto',
      landed: async () => (await ctx.hub.reads.sellerProducts(me)).length > count,
      rejected: 'El contrato rechazó el producto.',
      saved: 'Producto publicado en el catálogo.',
    });
    if (r.ok) ctx.refresh();
  };

  return h('form', { class: 'card form', onsubmit: submit },
    field('Nombre', name),
    field('Descripción (opcional)', description),
    field('Precio (MXN)', price),
    field('Categoría', category),
    field('Punto de entrega', pickup, 'Un lugar general del campus, nunca una dirección particular.'),
    points,
    error,
    h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Publicar'),
  );
}
