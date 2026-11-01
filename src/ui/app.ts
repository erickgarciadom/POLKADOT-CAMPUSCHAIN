import type { User } from 'firebase/auth';
import type { Hex } from '../contract/campuschain';
import { isContractConfigured } from '../contract/config';
import type { Hub, HubState } from '../hub/hub';
import { shortAddress } from '../lib/format';
import type { Ctx } from './context';
import { h, replace } from './dom';
import { catalogPage, productPage } from './pages/catalog';
import { myOrdersPage, orderPage } from './pages/orders';
import { accountPage, sellerPage } from './pages/people';
import { salesPage } from './pages/sales';
import { sellPage } from './pages/sell';
import { failure, loading } from './parts';
import { createTxPopup } from './txPopup';

type Route = { tab: 'catalogo' | 'pedidos' | 'vender' | 'ventas' | 'cuenta'; render: (ctx: Ctx) => Promise<HTMLElement> };

/** Hash → pantalla. Las rutas con id validan el formato antes de leer el contrato. */
function route(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  let m: RegExpExecArray | null;
  if ((m = /^\/p\/(\d{1,12})$/.exec(path))) { const id = BigInt(m[1]!); return { tab: 'catalogo', render: (c) => productPage(c, id) }; }
  if ((m = /^\/o\/(0x[0-9a-fA-F]{64})$/.exec(path))) { const id = m[1] as Hex; return { tab: 'pedidos', render: (c) => orderPage(c, id) }; }
  if ((m = /^\/v\/(0x[0-9a-fA-F]{40})$/.exec(path))) { const a = m[1] as Hex; return { tab: 'catalogo', render: (c) => sellerPage(c, a) }; }
  if (path === '/pedidos') return { tab: 'pedidos', render: myOrdersPage };
  if (path === '/vender') return { tab: 'vender', render: sellPage };
  if (path === '/ventas') return { tab: 'ventas', render: salesPage };
  if (path === '/cuenta') return { tab: 'cuenta', render: accountPage };
  return { tab: 'catalogo', render: catalogPage };
}

export function mountApp(root: HTMLElement, hub: Hub, usuario: User, salir: () => void): void {
  const header = h('header', { class: 'top' });
  const banner = h('div', { class: 'banner', hidden: true });
  const main = h('main', { class: 'main' });
  const nav = h('nav', { class: 'tabs', 'aria-label': 'Secciones' });
  const toastEl = h('div', { class: 'toast', role: 'status', hidden: true });
  const popup = createTxPopup(() => {
    hub.dismiss();
    draw();
  });
  root.replaceChildren(h('div', { class: 'chrome' }, header, nav), banner, main, toastEl, popup.el);

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const toast: Ctx['toast'] = (message, tone = 'ok') => {
    toastEl.textContent = message;
    toastEl.className = `toast toast-${tone}`;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 4500);
  };

  const ensureAccount = async () => {
    if (hub.getState().account) return true;
    const r = await hub.connect();
    if (!r.ok && !hub.getState().progress) toast(r.message, 'error');
    if (hub.getState().account) draw();
    return hub.getState().account !== null;
  };

  const ctx = (): Ctx => ({
    hub,
    usuario,
    salir,
    me: hub.getState().account?.h160 ?? null,
    go: (path) => {
      if (location.hash === path) draw();
      else location.hash = path;
    },
    refresh: () => draw(),
    toast,
    ensureAccount,
    async write(req) {
      if (!(await ensureAccount())) return { ok: false, message: hub.getState().message };
      const r = await hub.write(req);
      // Sin popup (fuera del Host, otra firma en curso), el motivo va en un aviso.
      if (!r.ok && !hub.getState().progress) toast(r.message, 'error');
      return r;
    },
  });

  const tab = (id: Route['tab'], href: string, icon: string, label: string, current: Route['tab']) =>
    h('a', { class: `tab${id === current ? ' on' : ''}`, href, 'aria-current': id === current ? 'page' : false }, h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, icon), label);

  const drawChrome = (state: HubState) => {
    const r = route(location.hash);
    const account = state.account
      ? h('a', { class: 'account on', href: '#/cuenta' }, '● ', shortAddress(state.account.h160))
      : state.host === 'listo'
        ? h('button', { class: 'btn btn-small btn-primary', onclick: () => void ensureAccount() }, 'Conectar')
        : h('span', { class: 'account muted small' }, state.host === 'fuera' ? 'Solo lectura' : state.host === 'error' ? 'Sin Host' : 'Conectando…');
    replace(header,
      h('a', { class: 'brand', href: '#/' }, h('span', { class: 'logo', 'aria-hidden': 'true' }, '✓'), 'CampusChain'),
      account,
    );
    const notice = !isContractConfigured()
      ? 'Falta configurar la dirección del contrato en src/contract/config.ts (ver README.md).'
      : state.host === 'fuera' || state.host === 'error' ? state.message : '';
    banner.hidden = notice === '';
    banner.textContent = notice;
    replace(nav,
      tab('catalogo', '#/', '🛍️', 'Catálogo', r.tab),
      tab('pedidos', '#/pedidos', '📦', 'Mis pedidos', r.tab),
      tab('vender', '#/vender', '🏷️', 'Vender', r.tab),
      tab('ventas', '#/ventas', '📈', 'Ventas', r.tab),
      tab('cuenta', '#/cuenta', '👤', 'Cuenta', r.tab),
    );
  };

  /** Paso 2 del acceso: después del login hay que conectar la cuenta de Polkadot y aprobar en el Host. */
  const connectGate = (state: HubState): HTMLElement => {
    const waiting = state.host === 'buscando' || state.host === 'conectando';
    const action = state.host === 'listo'
      ? h('button', { class: 'btn btn-primary btn-block', disabled: state.busy, onclick: () => void ensureAccount() }, state.busy ? 'Esperando tu aprobación…' : 'Conectar con Polkadot')
      : state.host === 'fuera' || state.host === 'error'
        ? h('button', { class: 'btn btn-block', onclick: () => void hub.start() }, 'Reintentar')
        : null;
    return h('div', { class: 'auth' },
      h('div', { class: 'card' },
        h('h1', null, 'Conecta tu cuenta'),
        h('p', null, `Sesión iniciada como ${usuario.email ?? ''}.`),
        h('p', { class: 'muted small' }, 'Para entrar al marketplace conecta tu cuenta de la Polkadot App y aprueba los permisos en tu celular o en Polkadot Desktop.'),
        waiting ? loading(state.message) : state.host === 'listo' ? null : h('p', { class: 'bad small' }, state.message),
        action,
        h('p', null, h('button', { class: 'btn btn-small', type: 'button', onclick: salir }, 'Cerrar sesión')),
      ),
    );
  };

  let drawing = 0;
  async function draw() {
    const ticket = ++drawing;
    const state = hub.getState();
    drawChrome(state);
    // Sin cuenta de Polkadot conectada no se ve ninguna pantalla.
    nav.hidden = !state.account;
    if (!state.account) {
      replace(main, connectGate(state));
      return;
    }
    const r = route(location.hash);
    replace(main, loading());
    if (!isContractConfigured()) {
      replace(main, h('div', { class: 'card' }, h('h1', null, 'CampusChain'), h('p', null, 'Pega la dirección del contrato CampusChain en src/contract/config.ts.')));
      return;
    }
    try {
      const page = await r.render(ctx());
      if (ticket === drawing) replace(main, page);
    } catch (error) {
      console.warn('[campuschain] pantalla', error);
      if (ticket === drawing) replace(main, failure(error, () => void draw()));
    }
  }

  let lastAccount: string | null = null;
  hub.subscribe((state) => {
    popup.render(state);
    drawChrome(state);
    // Al conectar (o cambiar de cuenta) la pantalla muestra tus datos.
    const now = state.account?.h160 ?? null;
    if (now !== lastAccount) {
      lastAccount = now;
      if (!state.busy) void draw();
    } else if (!now) {
      // La pantalla de conectar sigue al Host (buscando → listo, esperando aprobación…).
      void draw();
    }
  });

  window.addEventListener('hashchange', () => {
    window.scrollTo(0, 0);
    void draw();
  });
  void draw();
}
