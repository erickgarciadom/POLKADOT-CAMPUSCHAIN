import logoUrl from '../assets/logo.png';
import { EXPLORER_URL } from '../contract/config';
import { describeError, shortAddress } from '../lib/format';
import { etiquetaEstado } from '../shared/estados';
import type { Direccion, EstadoOrden, Reputacion } from '../shared/types';
import { h, type Child } from './dom';

export const ESTADO_TONO: Record<EstadoOrden, string> = {
  creado: 'nuevo',
  aceptado: 'curso',
  'pago-reportado': 'curso',
  entregado: 'curso',
  completado: 'ok',
  cancelado: 'off',
};

export const estadoBadge = (e: EstadoOrden) => h('span', { class: `badge badge-${ESTADO_TONO[e]}` }, etiquetaEstado(e));

/** Dirección corta, enlazada al perfil público. */
export function personLink(address: Direccion, me: Direccion | null): HTMLElement {
  const isMe = me !== null && address.toLowerCase() === me.toLowerCase();
  return h('a', { class: 'person', href: `#/v/${address}` },
    h('span', { class: 'person-name mono' }, shortAddress(address), isMe ? ' (tú)' : ''),
  );
}

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (a: string) => `${EXPLORER_URL}/address/${a}`;

export const external = (href: string, text: Child) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);

/** Una línea corta para tarjetas: «3 completados de 4 aceptados». */
export function lineaReputacion(r: Reputacion): string {
  if (r.aceptados === 0) return 'Sin pedidos completados todavía';
  return `${r.completados} completado${r.completados === 1 ? '' : 's'} de ${r.aceptados} aceptado${r.aceptados === 1 ? '' : 's'}`;
}

export function reputationBlock(r: Reputacion): HTMLElement {
  const stat = (value: string, label: string) => h('div', { class: 'stat' }, h('strong', null, value), h('span', null, label));
  return h('div', { class: 'stats' },
    stat(String(r.completados), 'completados'),
    stat(r.tasa === null ? '—' : `${r.tasa} %`, r.aceptados === 0 ? 'sin aceptados' : `de ${r.aceptados} aceptados`),
    stat(String(r.cancelados), 'cancelados por comprador'),
  );
}

export const loading = (text = 'Leyendo de la blockchain…') => h('div', { class: 'loading' }, h('span', { class: 'spinner' }), text);

/** Logo de CampusChain (va en el bundle). Decorativo: junto a él siempre va el nombre. */
export const logo = () => h('img', { class: 'logo', src: logoUrl, alt: '', width: 46, height: 30, decoding: 'async' });

/** Pantalla completa mientras arranca la app (revisar la sesión): logo, nombre y barra de avance. */
export const pantallaCarga = (text: string) =>
  h('div', { class: 'arranque', role: 'status', 'aria-live': 'polite' },
    h('img', { class: 'arranque-logo', src: logoUrl, alt: '', width: 172, height: 112 }),
    h('p', { class: 'arranque-nombre' }, 'CampusChain'),
    h('div', { class: 'arranque-barra', 'aria-hidden': 'true' }, h('span')),
    h('p', { class: 'arranque-texto' }, text),
  );

export function failure(error: unknown, retry: () => void): HTMLElement {
  return h('div', { class: 'card error-card' },
    h('p', null, 'No se pudo leer el contrato.'),
    h('p', { class: 'muted small' }, describeError(error)),
    h('button', { class: 'btn', onclick: retry }, 'Reintentar'),
  );
}

export const empty = (text: string, ...extra: Child[]) => h('div', { class: 'empty' }, h('p', null, text), ...extra);

export const section = (title: string, ...children: Child[]) => h('section', { class: 'section' }, h('h2', null, title), ...children);

/** Igual que `section`, con una clase para acomodarla en la distribución de su pantalla. */
export const bloque = (clase: string, title: string, ...children: Child[]) =>
  h('section', { class: `section ${clase}` }, h('h2', null, title), ...children);

export function copyButton(text: string, label = 'Copiar'): HTMLButtonElement {
  const btn = h('button', { class: 'btn btn-small', type: 'button' }, label);
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copiado';
    } catch {
      btn.textContent = 'No se pudo copiar';
    }
    setTimeout(() => (btn.textContent = label), 1500);
  });
  return btn;
}
