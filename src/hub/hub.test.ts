import { describe, expect, it, vi } from 'vitest';
import type { CampusChainContract } from '../contract/campuschain';
import { createHub, OUTSIDE, productIdFromHost, type HubDeps, type WriteRequest } from './hub';

const H160 = '0x00000000000000000000000000000000000000aa' as const;

type Query = (...args: unknown[]) => Promise<{ success: boolean; value: unknown }>;
type Tx = (...args: unknown[]) => Promise<{ ok: true; value: { txHash?: string } } | { ok: false; error: unknown }>;

/** Contrato falso: cada función tiene query y tx que se pueden reemplazar. */
function fakeContract(overrides: Record<string, { query?: Query; tx?: Tx }> = {}) {
  const calls: string[] = [];
  const contract = new Proxy({}, {
    get: (_t, name: string) => ({
      query: async (...args: unknown[]) => {
        calls.push(`query:${name}`);
        return overrides[name]?.query ? overrides[name].query!(...args) : { success: true, value: null };
      },
      tx: async (...args: unknown[]) => {
        calls.push(`tx:${name}`);
        return overrides[name]?.tx ? overrides[name].tx!(...args) : { ok: true, value: { txHash: '0xfeed' } };
      },
    }),
  }) as unknown as CampusChainContract;
  return { contract, calls };
}

function deps(over: Partial<HubDeps> = {}, contract = fakeContract()): HubDeps {
  return {
    isInsideContainer: async () => true,
    getTruApi: async () => ({}),
    getProductContext: async () => ({ productId: 'campuschain.dot' }),
    connectChain: async () => ({ destroy: () => undefined }),
    createSigner: () => ({
      connect: async () => ({ ok: true }),
      getProductAccount: async () => ({ ok: true, value: { address: '5Fake', h160Address: H160 } }),
      destroy: () => undefined,
    }),
    requestAllowance: async () => 'Allocated',
    reader: contract.contract,
    writer: () => contract.contract,
    readPgas: async () => 100n * 10n ** 10n,
    contractConfigured: () => true,
    sleep: async () => undefined,
    log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    ...over,
  };
}

const request = (over: Partial<WriteRequest> = {}): WriteRequest => ({
  fn: 'acceptOrder',
  args: [`0x${'ab'.repeat(32)}`],
  title: 'Aceptar pedido',
  landed: async () => true,
  rejected: 'El contrato rechazó la acción.',
  saved: 'Pedido aceptado.',
  ...over,
});

async function connected(d: HubDeps) {
  const hub = createHub(d);
  await hub.start();
  const r = await hub.connect();
  expect(r.ok).toBe(true);
  return hub;
}

describe('hub', () => {
  it('fuera del Host queda en solo lectura y no firma', async () => {
    const hub = createHub(deps({ isInsideContainer: async () => false }));
    await hub.start();
    expect(hub.getState().host).toBe('fuera');
    expect(await hub.write(request())).toEqual({ ok: false, message: OUTSIDE });
  });

  it('conecta la cuenta y pide el permiso de gas', async () => {
    const allowance = vi.fn(async () => 'Allocated' as const);
    const hub = await connected(deps({ requestAllowance: allowance }));
    expect(hub.getState().account?.h160).toBe(H160);
    expect(allowance).toHaveBeenCalledOnce();
  });

  it('simula antes de firmar y relee después', async () => {
    const fake = fakeContract();
    const landed = vi.fn(async () => true);
    const hub = await connected(deps({}, fake));
    const r = await hub.write(request({ landed }));
    expect(r).toEqual({ ok: true, message: 'Pedido aceptado.', txHash: '0xfeed' });
    expect(fake.calls).toEqual(['query:acceptOrder', 'tx:acceptOrder']);
    expect(landed).toHaveBeenCalled();
    expect(hub.getState().progress?.step).toBe('listo');
  });

  it('si la simulación revierte, no pide firma y explica por qué', async () => {
    const fake = fakeContract({ acceptOrder: { query: async () => ({ success: false, value: { error: 'NotSeller', args: [] } }) } });
    const hub = await connected(deps({}, fake));
    const r = await hub.write(request());
    expect(r).toEqual({ ok: false, message: 'Solo el vendedor puede hacer esto.' });
    expect(fake.calls).not.toContain('tx:acceptOrder');
  });

  it('sin PAS para el depósito, no pide firma y dice qué hacer', async () => {
    const deposit = { type: 'Module', value: { type: 'Revive', value: { type: 'StorageDepositNotEnoughFunds' } } };
    const fake = fakeContract({ acceptOrder: { query: async () => ({ success: false, value: deposit }) } });
    const hub = await connected(deps({}, fake));
    const r = await hub.write(request());
    expect(r).toMatchObject({ ok: false, kind: 'no-deposit' });
    expect(r.message).toContain('faucet');
    expect(fake.calls).not.toContain('tx:acceptOrder');
  });

  it('una firma a la vez', async () => {
    let release!: () => void;
    const fake = fakeContract({
      acceptOrder: { tx: () => new Promise((resolve) => { release = () => resolve({ ok: true, value: {} }); }) },
    });
    const hub = await connected(deps({}, fake));
    const first = hub.write(request());
    await vi.waitFor(() => expect(fake.calls).toContain('tx:acceptOrder'));
    expect(await hub.write(request())).toEqual({ ok: false, message: 'Espera a que termine la firma en curso.' });
    release();
    expect((await first).ok).toBe(true);
  });

  it('firma rechazada: no reintenta y lo dice', async () => {
    const fake = fakeContract({ acceptOrder: { tx: async () => ({ ok: false, error: new Error('User rejected') }) } });
    const hub = await connected(deps({}, fake));
    const r = await hub.write(request());
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.kind).toBe('rejected');
    expect(fake.calls.filter((c) => c === 'tx:acceptOrder')).toHaveLength(1);
  });

  it('sin PGAS pide el permiso de gas y reintenta una vez', async () => {
    let tries = 0;
    const fake = fakeContract({
      acceptOrder: { tx: async () => (++tries === 1 ? { ok: false, error: new Error('Invalid.Payment') } : { ok: true, value: {} }) },
    });
    const allowance = vi.fn(async () => 'Allocated' as const);
    const hub = await connected(deps({ requestAllowance: allowance, readPgas: async () => 0n }, fake));
    const r = await hub.write(request());
    expect(r.ok).toBe(true);
    expect(tries).toBe(2);
    expect(allowance).toHaveBeenCalledTimes(2); // al conectar y al recuperar
  });

  it('sin contrato configurado no pide firma', async () => {
    const fake = fakeContract();
    const hub = await connected(deps({ contractConfigured: () => false }, fake));
    const r = await hub.write(request());
    expect(r.ok).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  it('deduce el dominio de la URL', () => {
    expect(productIdFromHost('campuschain.dev-dot.li')).toBe('campuschain.dot');
    expect(productIdFromHost('mi-app.dot')).toBe('mi-app.dot');
    expect(productIdFromHost('localhost:5173')).toBe('localhost:5173');
  });
});
