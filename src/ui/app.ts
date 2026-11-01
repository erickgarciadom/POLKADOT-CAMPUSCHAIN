import { isContractConfigured } from '../contract/config';
import type { Hub, HubState } from '../hub/hub';
import { shortAddress } from '../lib/format';
import type { CampusData } from '../shared/datasource';
import type { Direccion as Hex, Resultado, Sesion } from '../shared/types';
import type { Ctx } from './context';
import { h, replace } from './dom';
import { icono, rutaDe, SECCIONES, type ItemMenu, type Ruta, type Seccion, type Vista } from './nav';
import { catalogPage, productPage } from './pages/catalog';
import { myOrdersPage, orderPage } from './pages/orders';
import { accountPage, sellerPage } from './pages/people';
import { salesPage } from './pages/sales';
import { sellPage } from './pages/sell';
import { failure, loading } from './parts';
import { createTxPopup } from './txPopup';

type Route = Ruta & { render: (ctx: Ctx) => Promise<HTMLElement> };

const PANTALLA: Record<Vista, (ctx: Ctx, id: string) => Promise<HTMLElement>> = {
  catalogo: (c) => catalogPage(c),
  producto: (c, id) => productPage(c, id),
  vendedor: (c, id) => sellerPage(c, id as Hex),
  pedidos: (c) => myOrdersPage(c),
  pedido: (c, id) => orderPage(c, id as Hex),
  vender: (c) => sellPage(c),
  ventas: (c) => salesPage(c),
  cuenta: (c) => accountPage(c),
};

function route(hash: string): Route {
  const r = rutaDe(hash);
  return { ...r, render: (c) => PANTALLA[r.vista](c, r.id ?? '') };
}

/** Escrituras de CampusData: las que devuelven un Resultado. */
const ESCRITURAS = ['publicarProducto', 'cambiarDisponible', 'borrarProducto', 'crearPedido', 'accionPedido'] as const;

export function mountApp(root: HTMLElement, hub: Hub, source: CampusData, usuario: Sesion, salir: () => void): void {
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

  // Sin popup (fuera del Host, otra firma en curso, modo mock), el motivo de un fallo va en un aviso.
  const data: CampusData = { ...source };
  for (const name of ESCRITURAS) {
    const write = source[name] as (...args: unknown[]) => Promise<Resultado>;
    (data as unknown as Record<string, unknown>)[name] = async (...args: unknown[]) => {
      const r = await write(...args);
      if (!r.ok && !hub.getState().progress) toast(r.message, 'error');
      return r;
    };
  }

  const ctx = (): Ctx => ({
    hub,
    data,
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
  });

  const tab = ({ id, href, etiqueta, trazo }: ItemMenu, current: Seccion) =>
    h('a', { class: `tab${id === current ? ' on' : ''}`, href, 'aria-current': id === current ? 'page' : false }, h('span', { class: 'tab-icon' }, icono(trazo)), etiqueta);

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
    replace(nav, ...SECCIONES.map((s) => tab(s, r.tab)));
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
        h('p', null, `Sesión iniciada como ${usuario.email}.`),
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
      main.dataset.vista = 'conectar';
      replace(main, connectGate(state));
      return;
    }
    const r = route(location.hash);
    main.dataset.vista = r.vista;
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
