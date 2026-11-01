import { CAMPUSCHAIN_ADDRESS, CHAIN_ID, isContractConfigured } from '../../contract/config';
import { shortAddress } from '../../lib/format';
import { formatMxn } from '../../lib/money';
import type { Direccion as Hex } from '../../shared/types';
import type { Ctx } from '../context';
import { h } from '../dom';
import { bloque, copyButton, empty, explorerAddress, external, reputationBlock } from '../parts';

/** #/v/:address — perfil público y reputación del vendedor. */
export async function sellerPage(ctx: Ctx, address: Hex): Promise<HTMLElement> {
  const [rep, available] = await Promise.all([ctx.data.reputacion(address), ctx.data.productosDe(address)]);
  const isMe = ctx.me !== null && address.toLowerCase() === ctx.me.toLowerCase();
  return h('div', null,
    h('a', { class: 'back', href: '#/' }, 'Catálogo'),
    h('div', { class: 'card perfil' },
      h('h1', { class: 'mono' }, shortAddress(address), isMe ? ' (tú)' : ''),
      h('p', { class: 'small' }, external(explorerAddress(address), 'Ver en el explorador')),
    ),
    bloque('reputacion', 'Reputación',
      reputationBlock(rep),
      h('p', { class: 'muted small' }, 'Calculado solo con lo que registró el contrato: es un indicador del historial, no una garantía de honestidad.'),
    ),
    bloque('disponibles', 'Productos disponibles', available.length
      ? h('div', { class: 'list' }, ...available.map((p) => h('a', { class: 'card row', href: `#/p/${p.id}` },
        h('div', { class: 'row-main' }, h('strong', null, p.titulo), h('span', { class: 'muted small' }, p.puntoEntrega)),
        h('div', { class: 'row-side' }, h('strong', null, formatMxn(BigInt(p.precioCentavos)))))))
      : empty('No tiene productos disponibles.')),
  );
}

/** #/cuenta — conectar, tus direcciones (la SS58 para pedir PAS) y datos de la red. */
export async function accountPage(ctx: Ctx): Promise<HTMLElement> {
  const state = ctx.hub.getState();
  const network = bloque('red', 'Red y contrato',
    h('dl', { class: 'facts' },
      h('dt', null, 'Red'), h('dd', null, `Products Devnet · chainId ${CHAIN_ID}`),
      h('dt', null, 'Contrato'), h('dd', null, isContractConfigured()
        ? external(explorerAddress(CAMPUSCHAIN_ADDRESS), h('span', { class: 'mono' }, shortAddress(CAMPUSCHAIN_ADDRESS)))
        : 'Sin configurar'),
      h('dt', null, 'Versión'), h('dd', null, `v${__APP_VERSION__}`),
    ),
  );

  const sesion = h('div', { class: 'card sesion' },
    h('p', { class: 'small muted' }, 'Sesión iniciada como:'),
    h('p', null, h('strong', null, ctx.usuario.email)),
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => ctx.salir() }, 'Cerrar sesión'),
  );

  if (!ctx.me || !state.account) {
    return h('div', null, h('h1', null, 'Cuenta'), sesion,
      empty(state.host === 'fuera' ? state.message : 'Conecta tu cuenta de la Polkadot App para comprar y vender.',
        state.host === 'fuera' ? null : h('button', { class: 'btn btn-primary', onclick: () => ctx.ensureAccount().then((ok) => ok && ctx.refresh()) }, 'Conectar cuenta')),
      network);
  }

  const { h160, ss58 } = state.account;
  return h('div', null,
    h('h1', null, 'Cuenta'),
    sesion,
    h('div', { class: 'card cartera' },
      h('p', { class: 'small muted' }, 'Tu cuenta en esta app (SS58):'),
      h('p', { class: 'mono small break' }, ss58),
      h('p', null, copyButton(ss58, 'Copiar dirección SS58')),
      h('p', { class: 'note' }, 'Publicar productos y hacer pedidos guarda datos en el contrato, y eso pide un depósito en PAS aparte del gas. Si te sale «no tiene PAS para el depósito», pega esta dirección en faucet.polkadot.io (Paseo → Asset Hub).'),
    ),
    h('div', { class: 'card cartera' },
      h('p', { class: 'small muted' }, 'La misma cuenta en el contrato (H160):'),
      h('p', { class: 'mono small break' }, h160),
      h('p', null, copyButton(h160, 'Copiar dirección 0x'), ' ', h('a', { class: 'btn btn-small', href: `#/v/${h160}` }, 'Ver mi perfil público')),
      h('p', { class: 'muted small' }, 'Es la que ven compradores y vendedores. No le mandes PAS a esta: usa la SS58.'),
    ),
    network,
  );
}
