import { formatMxn, formatTimestamp } from '../../lib/money';
import { esCompletado, porMes, porPeriodo, ventaDe, type Resumen } from '../../lib/sales';
import type { Ctx } from '../context';
import { h } from '../dom';
import { empty, section } from '../parts';

const MES = new Intl.DateTimeFormat('es-MX', { month: 'short' });

const stat = (value: string, label: string) => h('div', { class: 'stat' }, h('strong', null, value), h('span', null, label));

function periodo(titulo: string, r: Resumen): HTMLElement {
  return h('div', { class: 'card' },
    h('h3', null, titulo),
    h('div', { class: 'stats' },
      stat(formatMxn(r.totalCents), 'vendido'),
      stat(String(r.ventas), r.ventas === 1 ? 'venta completada' : 'ventas completadas'),
      stat(String(r.piezas), 'piezas'),
      stat(r.promedioCents === null ? '—' : formatMxn(r.promedioCents), 'promedio por venta'),
    ),
  );
}

/** #/ventas — métricas del vendedor, solo con pedidos completados. */
export async function salesPage(ctx: Ctx): Promise<HTMLElement> {
  if (!ctx.me) {
    return h('div', null, h('h1', null, 'Mis ventas'),
      empty('Conecta tu cuenta para ver tus ventas.', h('button', { class: 'btn btn-primary', onclick: () => ctx.ensureAccount().then((ok) => ok && ctx.refresh()) }, 'Conectar cuenta')));
  }
  const completados = (await ctx.hub.reads.sellerOrders(ctx.me)).filter(esCompletado);
  const ventas = await Promise.all(completados.map(async (o) => ventaDe(o, await ctx.hub.reads.history(o.id))));
  const productos = new Map((await Promise.all([...new Set(completados.map((o) => o.productId.toString()))]
    .map((id) => ctx.hub.reads.product(BigInt(id))))).map((p) => [p.id.toString(), p.name]));

  const ahora = new Date();
  const p = porPeriodo(ventas, ahora);
  const meses = porMes(ventas, ahora, 6);
  const maximo = meses.reduce((m, x) => (x.resumen.totalCents > m ? x.resumen.totalCents : m), 0n);

  const barras = h('div', { class: 'bars', role: 'img', 'aria-label': 'Vendido por mes, últimos 6 meses' },
    ...meses.map((m) => {
      const alto = maximo > 0n ? Number((m.resumen.totalCents * 100n) / maximo) : 0;
      const etiqueta = `${MES.format(new Date(m.anio, m.mes, 1))}: ${formatMxn(m.resumen.totalCents)} en ${m.resumen.ventas} ventas`;
      return h('div', { class: 'bar-col', title: etiqueta },
        h('span', { class: 'bar-value small' }, m.resumen.ventas ? formatMxn(m.resumen.totalCents) : ''),
        h('div', { class: 'bar-track' }, h('div', { class: 'bar', style: `height:${Math.max(alto, m.resumen.ventas ? 4 : 0)}%` })),
        h('span', { class: 'small muted' }, MES.format(new Date(m.anio, m.mes, 1))),
      );
    }));

  const ordenadas = [...ventas].sort((a, b) => b.completadoEn - a.completadoEn);

  return h('div', null,
    h('h1', null, 'Mis ventas'),
    h('p', { class: 'muted small' }, 'Solo cuentan los pedidos completados: el comprador confirmó en el contrato que recibió el producto. Los pedidos en curso o cancelados no aparecen aquí.'),
    ventas.length === 0
      ? empty('Todavía no tienes ventas completadas.')
      : h('div', null,
        periodo('Últimos 7 días', p.semana),
        periodo('Este mes', p.mes),
        periodo('Este año', p.anio),
        periodo('Desde el inicio', p.total),
        section('Vendido por mes', h('div', { class: 'card' }, barras)),
        section('Ventas completadas', h('div', { class: 'list' }, ...ordenadas.map((v) => h('a', { class: 'card row', href: `#/o/${v.id}` },
          h('div', { class: 'row-main' },
            h('strong', null, productos.get(v.productId.toString()) ?? `Producto #${v.productId}`),
            h('span', { class: 'muted small' }, `${v.quantity} pz · completado ${formatTimestamp(v.completadoEn)}`),
          ),
          h('div', { class: 'row-side' }, h('strong', null, formatMxn(v.totalCents)), h('span', { class: 'badge badge-ok' }, 'Completado')),
        )))),
      ),
  );
}
