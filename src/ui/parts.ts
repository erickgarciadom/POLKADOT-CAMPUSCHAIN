import { STATUS_LABEL, type Hex, type Status } from '../contract/campuschain';
import { EXPLORER_URL } from '../contract/config';
import { describeError, shortAddress } from '../lib/format';
import type { Reputation } from '../lib/reputation';
import { h, type Child } from './dom';

export const STATUS_TONE: Record<Status, string> = {
  0: 'off',
  1: 'nuevo',
  2: 'curso',
  3: 'curso',
  4: 'curso',
  5: 'ok',
  6: 'off',
};

export const statusBadge = (status: Status) => h('span', { class: `badge badge-${STATUS_TONE[status]}` }, STATUS_LABEL[status]);

/** Dirección corta, enlazada al perfil público. */
export function personLink(address: Hex, me: Hex | null): HTMLElement {
  const isMe = me !== null && address.toLowerCase() === me.toLowerCase();
  return h('a', { class: 'person', href: `#/v/${address}` },
    h('span', { class: 'person-name mono' }, shortAddress(address), isMe ? ' (tú)' : ''),
  );
}

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (a: string) => `${EXPLORER_URL}/address/${a}`;

export const external = (href: string, text: Child) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);

export function reputationBlock(r: Reputation): HTMLElement {
  const stat = (value: string, label: string) => h('div', { class: 'stat' }, h('strong', null, value), h('span', null, label));
  return h('div', { class: 'stats' },
    stat(String(r.completed), 'completados'),
    stat(r.completionRate === null ? '—' : `${r.completionRate} %`, r.accepted === 0 ? 'sin aceptados' : `de ${r.accepted} aceptados`),
    stat(String(r.cancelled), 'cancelados por comprador'),
  );
}

export const loading = (text = 'Leyendo de la blockchain…') => h('div', { class: 'loading' }, h('span', { class: 'spinner' }), text);

export function failure(error: unknown, retry: () => void): HTMLElement {
  return h('div', { class: 'card error-card' },
    h('p', null, 'No se pudo leer el contrato.'),
    h('p', { class: 'muted small' }, describeError(error)),
    h('button', { class: 'btn', onclick: retry }, 'Reintentar'),
  );
}

export const empty = (text: string, ...extra: Child[]) => h('div', { class: 'empty' }, h('p', null, text), ...extra);

export const section = (title: string, ...children: Child[]) => h('section', { class: 'section' }, h('h2', null, title), ...children);

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
