import { formatMxn, formatTimestamp } from '../../lib/money';
import type { MetricasTienda, ResumenPeriodo } from '../../shared/types';
import type { Ctx } from '../context';
import { h } from '../dom';
import { copyButton, empty, section } from '../parts';

const MES = new Intl.DateTimeFormat('es-MX', { month: 'short' });
const mxn = (centavos: string) => formatMxn(BigInt(centavos));

const stat = (value: string, label: string) => h('div', { class: 'stat' }, h('strong', null, value), h('span', null, label));

function periodo(titulo: string, r: ResumenPeriodo): HTMLElement {
  return h('div', { class: 'card' },
    h('h3', null, titulo),
    h('div', { class: 'stats' },
      stat(mxn(r.totalCentavos), 'vendido'),
      stat(String(r.ventas), r.ventas === 1 ? 'venta completada' : 'ventas completadas'),
      stat(String(r.piezas), 'piezas'),
      stat(r.promedioCentavos === null ? '—' : mxn(r.promedioCentavos), 'promedio por venta'),
    ),
  );
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MES_LARGO = new Intl.DateTimeFormat('es-MX', { month: 'long' });
const porcentaje = (v: number | null) => (v === null ? '—' : `${v} %`);
const lista = (items: string[]) => (items.length ? items.join(' · ') : 'Sin pedidos todavía');

/** KPIs de la tienda (skill «metricas-ecommerce-universidad») y su JSON para copiar o descargar. */
function kpis(ctx: Ctx, m: MetricasTienda): HTMLElement {
  const f = m.metricas_financieras;
  const c = m.comportamiento_usuarios;
  const inv = m.inventario_producto;
  const json = JSON.stringify(m, null, 2);

  const descargar = () => {
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = h('a', { href: url, download: `metricas-campuschain-${m.periodo.semestre}.json` });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      ctx.toast('Este dispositivo no permite descargar archivos: usa «Copiar JSON».', 'error');
    }
  };

  return h('div', null,
    section('Ventas y rendimiento',
      h('div', { class: 'card' },
        h('div', { class: 'stats' },
          stat(mxn(f.ingresos_totales_centavos), 'ingresos totales'),
          stat(mxn(f.ingresos_semestre_centavos), `semestre ${m.periodo.semestre}`),
          stat(f.ticket_promedio_centavos === null ? '—' : mxn(f.ticket_promedio_centavos), 'ticket promedio (AOV)'),
          stat(porcentaje(f.tasa_conversion_pedidos_pct), 'pedidos que se completan'),
        ),
      )),
    section('Comportamiento de compradores',
      h('div', { class: 'card' },
        h('div', { class: 'stats' },
          stat(String(c.compradores_activos_dia), 'compradores hoy (24 h)'),
          stat(String(c.compradores_activos_mes), 'compradores en 30 días'),
          stat(String(c.compradores_recurrentes), 'compradores que repiten'),
          stat(porcentaje(c.tasa_cancelacion_pct), 'pedidos cancelados'),
        ),
        h('dl', { class: 'facts' },
          h('dt', null, 'Horas pico'), h('dd', null, lista(c.horas_pico.map((x) => `${x.hora}:00 (${x.pedidos})`))),
          h('dt', null, 'Días pico'), h('dd', null, lista(c.dias_pico.map((x) => `${DIAS[x.dia]} (${x.pedidos})`))),
          h('dt', null, 'Meses pico'), h('dd', null, lista(c.meses_pico.map((x) => `${MES_LARGO.format(new Date(2000, x.mes, 1))} (${x.pedidos})`))),
        ),
      )),
    section('Inventario y producto',
      h('div', { class: 'card' },
        h('div', { class: 'stats' },
          stat(String(inv.productos_activos), 'productos activos'),
          stat(String(inv.productos_pausados), 'productos pausados'),
        ),
        inv.mas_vendidos.length
          ? h('ol', { class: 'ranking' }, ...inv.mas_vendidos.map((p) => h('li', null,
            h('strong', null, p.titulo), ' ', h('span', { class: 'muted small' }, `${p.piezas} pz · ${mxn(p.ingresos_centavos)}${p.categoria ? ` · ${p.categoria}` : ''}`))))
          : h('p', { class: 'muted small' }, 'Todavía no hay productos vendidos.'),
        h('p', { class: 'muted small' }, 'Alertas de bajo inventario: no disponibles, el contrato no guarda stock.'),
      )),
    section('Datos en JSON',
      h('p', { class: 'muted small' }, 'Las mismas métricas para un dashboard o una hoja de cálculo. Montos en centavos de MXN; lo que la app no registra va en null y se explica en «notas».'),
      h('p', null, copyButton(json, 'Copiar JSON'), ' ', h('button', { class: 'btn btn-small', type: 'button', onclick: descargar }, 'Descargar .json')),
      h('pre', { class: 'json card' }, json),
    ),
  );
}

/** #/ventas — métricas del vendedor, solo con pedidos completados. */
export async function salesPage(ctx: Ctx): Promise<HTMLElement> {
  if (!ctx.me) {
    return h('div', null, h('h1', null, 'Mis ventas'),
      empty('Conecta tu cuenta para ver tus ventas.', h('button', { class: 'btn btn-primary', onclick: () => ctx.ensureAccount().then((ok) => ok && ctx.refresh()) }, 'Conectar cuenta')));
  }
  const ahora = new Date();
  const [r, m] = await Promise.all([ctx.data.reporteVentas(ahora), ctx.data.metricas(ahora)]);
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
    h('p', { class: 'muted small' }, 'Los montos vendidos solo cuentan pedidos completados: el comprador confirmó en el contrato que recibió el producto. Conversión, cancelaciones y horarios pico usan todos los pedidos que recibiste.'),
    kpis(ctx, m),
    r.ventas.length === 0
      ? empty('Todavía no tienes ventas completadas.')
      : h('div', null,
        periodo('Últimos 7 días', r.semana),
        periodo('Este mes', r.mes),
        periodo('Este año', r.anio),
        periodo('Desde el inicio', r.total),
        section('Vendido por mes', h('div', { class: 'card' }, barras)),
        section('Ventas completadas', h('div', { class: 'list' }, ...r.ventas.map((v) => h('a', { class: 'card row', href: `#/o/${v.orderId}` },
          h('div', { class: 'row-main' },
            h('strong', null, v.tituloProducto),
            h('span', { class: 'muted small' }, `${v.cantidad} pz · completado ${formatTimestamp(v.completadoEn)}`),
          ),
          h('div', { class: 'row-side' }, h('strong', null, mxn(v.totalCentavos)), h('span', { class: 'badge badge-ok' }, 'Completado')),
        )))),
      ),
  );
}
