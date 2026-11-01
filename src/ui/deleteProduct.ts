import type { Product } from '../contract/campuschain';
import { marcarBorrado } from '../firebase/borrados';
import { mensajeFirebase } from '../firebase/auth';
import type { Ctx } from './context';
import { h } from './dom';

/** ¿La cuenta conectada es la que publicó el producto? Solo a ella se le muestra «Borrar». */
export const esMio = (ctx: Pick<Ctx, 'me'>, p: Pick<Product, 'seller'>) =>
  ctx.me !== null && p.seller.toLowerCase() === ctx.me.toLowerCase();

/**
 * Borra un producto propio: lo saca del catálogo en el contrato (setAvailable false) y guarda en
 * la base que fue un borrado. Si ya estaba pausado no hace falta firmar nada.
 */
async function borrar(ctx: Ctx, p: Product): Promise<boolean> {
  if (!esMio(ctx, p)) return false;
  if (!confirm(`¿Borrar «${p.name}»? Ya no aparecerá en el catálogo ni en tus productos.`)) return false;
  if (p.available) {
    const r = await ctx.write({
      fn: 'setAvailable',
      args: [p.id, false],
      title: 'Borrar producto',
      landed: async () => !(await ctx.hub.reads.product(p.id)).available,
      rejected: 'El contrato rechazó el borrado.',
      saved: 'Producto borrado del catálogo.',
    });
    if (!r.ok) return false;
  }
  try {
    await marcarBorrado(ctx.usuario.uid, p.id, p.seller);
    if (!p.available) ctx.toast('Producto borrado.');
  } catch (error) {
    // El producto ya salió del catálogo; solo falló la marca, así que seguirá en «Mis productos» como pausado.
    ctx.toast(`El producto ya no está en el catálogo, pero no se guardó el borrado: ${mensajeFirebase(error)}`, 'error');
  }
  return true;
}

/** Botón «Borrar». null si el producto no es de la cuenta conectada. */
export function deleteButton(ctx: Ctx, p: Product, after: () => void, small = false): HTMLElement | null {
  if (!esMio(ctx, p)) return null;
  return h('button', {
    class: `btn btn-danger${small ? ' btn-small' : ''}`,
    type: 'button',
    onclick: async (e: Event) => {
      e.preventDefault();
      if (await borrar(ctx, p)) after();
    },
  }, 'Borrar');
}
