import { CATEGORIES, LIMITS } from '../../contract/campuschain';
import { formatMxn, parsePriceCents } from '../../lib/money';
import type { Producto } from '../../shared/types';
import type { Ctx } from '../context';
import { deleteButton } from '../deleteProduct';
import { h } from '../dom';
import { bloque, empty } from '../parts';
import { orderList } from './orders';

const PICKUP_POINTS = ['Biblioteca', 'Explanada', 'Cafetería', 'Entrada principal', 'Facultad de Ingeniería'];

/** #/vender — pedidos recibidos, mis productos y publicar. */
export async function sellPage(ctx: Ctx): Promise<HTMLElement> {
  if (!ctx.me) {
    return h('div', null, h('h1', null, 'Vender'),
      empty('Conecta tu cuenta para publicar productos y atender pedidos.', h('button', { class: 'btn btn-primary', onclick: () => ctx.ensureAccount().then((ok) => ok && ctx.refresh()) }, 'Conectar cuenta')));
  }
  const [orders, products] = await Promise.all([ctx.data.pedidosRecibidos(), ctx.data.misProductos()]);

  return h('div', null,
    h('h1', null, 'Vender'),
    bloque('recibidos', 'Pedidos recibidos', orderList(ctx, orders, 'Todavía no recibes pedidos.')),
    bloque('mis-productos', 'Mis productos', products.length
      ? h('div', { class: 'list' }, ...products.map((p) => productRow(ctx, p)))
      : empty('Todavía no publicas productos.')),
    bloque('publicar', 'Publicar producto', publishForm(ctx)),
    h('p', { class: 'muted small aviso-publico' }, 'Todo lo que publicas queda en un contrato público. No pongas tu nombre completo, teléfono ni dirección: usa un punto general del campus.'),
  );
}

function productRow(ctx: Ctx, p: Producto): HTMLElement {
  const toggle = async (e: Event) => {
    e.preventDefault();
    const r = await ctx.data.cambiarDisponible(p.id, !p.disponible);
    if (r.ok) ctx.refresh();
  };
  return h('div', { class: 'card row' },
    h('a', { class: 'row-main', href: `#/p/${p.id}` },
      h('strong', null, p.titulo),
      h('span', { class: 'muted small' }, `${formatMxn(BigInt(p.precioCentavos))} · ${p.categoria || 'Otro'} · ${p.puntoEntrega}`),
    ),
    h('div', { class: 'row-side' },
      p.disponible ? h('span', { class: 'badge badge-ok' }, 'Disponible') : h('span', { class: 'badge badge-off' }, 'Pausado'),
      h('button', { class: 'btn btn-small', onclick: toggle }, p.disponible ? 'Pausar' : 'Reactivar'),
      deleteButton(ctx, p, () => ctx.refresh(), true),
    ),
  );
}

function publishForm(ctx: Ctx): HTMLElement {
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
    const r = await ctx.data.publicarProducto({ titulo: n, descripcion: desc, categoria: category.value, puntoEntrega: pk, precioCentavos: cents.toString() });
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
