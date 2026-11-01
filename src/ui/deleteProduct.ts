import type { Producto } from '../shared/types';
import type { Ctx } from './context';
import { h } from './dom';

/** ¿La cuenta conectada es la que publicó el producto? Solo a ella se le muestra «Borrar». */
export const esMio = (ctx: Pick<Ctx, 'me'>, p: Pick<Producto, 'vendedor'>) =>
  ctx.me !== null && p.vendedor.toLowerCase() === ctx.me.toLowerCase();

/** Botón «Borrar». null si el producto no es de la cuenta conectada. */
export function deleteButton(ctx: Ctx, p: Producto, after: () => void, small = false): HTMLElement | null {
  if (!esMio(ctx, p)) return null;
  return h('button', {
    class: `btn btn-danger${small ? ' btn-small' : ''}`,
    type: 'button',
    onclick: async (e: Event) => {
      e.preventDefault();
      if (!confirm(`¿Borrar «${p.titulo}»? Ya no aparecerá en el catálogo ni en tus productos.`)) return;
      const r = await ctx.data.borrarProducto(p.id);
      if (r.ok) {
        // Si no hubo firma (ya estaba pausado) no hay popup: el aviso confirma el borrado.
        if (!ctx.hub.getState().progress) ctx.toast(r.message);
        after();
      }
    },
  }, 'Borrar');
}
