import { formatMxn, formatTimestamp } from '../../lib/money';
import type { ResumenPeriodo } from '../../shared/types';
import type { Ctx } from '../context';
import { h } from '../dom';
import { bloque, empty } from '../parts';

const MES = new Intl.DateTimeFormat('es-MX', { month: 'short' });
const mxn = (centavos: string) => formatMxn(BigInt(centavos));

const stat = (value: string, label: string) => h('div', { class: 'stat' }, h('strong', null, value), h('span', null, label));

function periodo(titulo: string, r: ResumenPeriodo): HTMLElement {
  return h('div', { class: 'card periodo' },
    h('h3', null, titulo),
    h('div', { class: 'stats' },
      stat(mxn(r.totalCentavos), 'vendido'),
      stat(String(r.ventas), r.ventas === 1 ? 'venta completada' : 'ventas completadas'),
      stat(String(r.piezas), 'piezas'),
      stat(r.promedioCentavos === null ? '—' : mxn(r.promedioCentavos), 'promedio por venta'),
    ),
  );
}

/** #/ventas — métricas del vendedor, solo con pedidos completados. */
export async function salesPage(ctx: Ctx): Promise<HTMLElement> {
  if (!ctx.me) {
    return h('div', null, h('h1', null, 'Mis ventas'),
      empty('Conecta tu cuenta para ver tus ventas.', h('button', { class: 'btn btn-primary', onclick: () => ctx.ensureAccount().then((ok) => ok && ctx.refresh()) }, 'Conectar cuenta')));
  }
  const r = await ctx.data.reporteVentas(new Date());
  const maximo = r.meses.reduce((m, x) => (BigInt(x.resumen.totalCentavos) > m ? BigInt(x.resumen.totalCentavos) : m), 0n);

  const barras = h('div', { class: 'bars', role: 'img', 'aria-label': 'Vendido por mes, últimos 6 meses' },
    ...r.meses.map((m) => {
      const total = BigInt(m.resumen.totalCentavos);
      const alto = maximo > 0n ? Number((total * 100n) / maximo) : 0;
      const nombre = MES.format(new Date(m.anio, m.mes, 1));
      return h('div', { class: 'bar-col', title: `${nombre}: ${mxn(m.resumen.totalCentavos)} en ${m.resumen.ventas} ventas` },
        h('span', { class: 'bar-value small' }, m.resumen.ventas ? mxn(m.resumen.totalCentavos) : ''),
        h('div', { class: 'bar-track' }, h('div', { class: 'bar', style: `height:${Math.max(alto, m.resumen.ventas ? 4 : 0)}%` })),
        h('span', { class: 'small muted' }, nombre),
      );
    }));

  return h('div', null,
    h('h1', null, 'Mis ventas'),
    h('p', { class: 'muted small' }, 'Solo cuentan los pedidos completados: el comprador confirmó en el contrato que recibió el producto. Los pedidos en curso o cancelados no aparecen aquí.'),
    r.ventas.length === 0
      ? empty('Todavía no tienes ventas completadas.')
      : h('div', null,
        h('div', { class: 'periodos' },
          periodo('Últimos 7 días', r.semana),
          periodo('Este mes', r.mes),
          periodo('Este año', r.anio),
          periodo('Desde el inicio', r.total),
        ),
        bloque('grafica', 'Vendido por mes', h('div', { class: 'card' }, barras)),
        bloque('ventas-lista', 'Ventas completadas', h('div', { class: 'list' }, ...r.ventas.map((v) => h('a', { class: 'card row', href: `#/o/${v.orderId}` },
          h('div', { class: 'row-main' },
            h('strong', null, v.tituloProducto),
            h('span', { class: 'muted small' }, `${v.cantidad} pz · completado ${formatTimestamp(v.completadoEn)}`),
          ),
          h('div', { class: 'row-side' }, h('strong', null, mxn(v.totalCentavos)), h('span', { class: 'badge badge-ok' }, 'Completado')),
        )))),
      ),
  );
}
