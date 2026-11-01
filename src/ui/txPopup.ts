import type { HubState } from '../hub/hub';
import { progressView } from '../hub/progress';
import { h, replace } from './dom';

const ICON = { hecho: '✓', actual: '●', pendiente: '○', fallo: '✗' } as const;

/**
 * Popup de estados de la firma: bloquea la pantalla mientras hay una operación (una firma a la
 * vez) y se queda con el resultado hasta que tocas Cerrar.
 */
export function createTxPopup(onClose: () => void) {
  const box = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-live': 'polite' });
  const overlay = h('div', { class: 'overlay', hidden: true }, box);

  return {
    el: overlay,
    render(state: HubState) {
      const view = progressView(state.progress);
      overlay.hidden = view === null;
      if (!view) return;
      replace(box,
        h('h2', null, view.title),
        h('ol', { class: 'tx-steps' }, ...view.steps.map((s) =>
          h('li', { class: `tx-${s.status}` }, h('span', { class: 'tx-icon' }, ICON[s.status]), s.label))),
        h('p', { class: `tx-line tx-${view.tone}` }, view.tone === 'curso' ? h('span', { class: 'spinner' }) : null, view.line),
        view.tone === 'curso' ? null : h('button', { class: 'btn btn-primary btn-block', onclick: onClose }, 'Cerrar'),
      );
    },
  };
}
