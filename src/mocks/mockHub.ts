/*
 * Hub de modo mock: una cuenta «conectada» y ningún Host. Las pantallas no usan hub.reads ni
 * hub.write (van por CampusData); si algo los llama en modo mock, el error lo dice.
 */
import type { Reads } from '../contract/reads';
import type { Hub, HubState } from '../hub/hub';
import { SS58_DEMO, YO } from './fixtures';

export function createMockHub(): Hub {
  const state: HubState = {
    host: 'listo',
    message: 'Modo mock: datos de ejemplo, sin Polkadot.',
    account: { h160: YO, ss58: SS58_DEMO },
    allowance: 'Allocated',
    busy: false,
    progress: null,
  };
  const noUsar = new Proxy({} as Reads, {
    get(_, name) {
      throw new Error(`hub.reads.${String(name)} no existe en modo mock: usa ctx.data.`);
    },
  });
  return {
    getState: () => state,
    subscribe: () => () => undefined,
    start: async () => undefined,
    connect: async () => ({ ok: true, message: 'Cuenta de demostración.' }),
    write: async () => ({ ok: false, message: 'En modo mock las firmas van por ctx.data.' }),
    dismiss: () => undefined,
    reads: noUsar,
  };
}
