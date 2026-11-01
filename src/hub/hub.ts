/*
 * Todo lo que habla con el Host (Polkadot Desktop o la Polkadot App), con la cuenta, con el PGAS y
 * con el contrato. Sin framework: un objeto con estado y suscripción. Basado en game/src/hub/hub.ts.
 *
 * Invariantes (probadas en hub.test.ts):
 *  - antes de cada .tx() se simula con .query(); si revierte, no se pide firma;
 *  - una firma a la vez (`busy`);
 *  - un fallo de firma se clasifica (lib/txErrors) y se recupera una sola vez;
 *  - después de firmar se relee el contrato (el RPC puede ir un bloque atrás).
 *
 * Todo lo que toca el Host, la red o el reloj se inyecta (HubDeps) para probarlo sin teléfono.
 */
import type * as HostSdk from '@parity/product-sdk/host';
import type * as ContractsSdk from '@parity/product-sdk/contracts';
import type * as WalletSdk from '@parity/product-sdk/wallet';
import { campuschainAbi, type CampusChainContract, type QueryResult, type TxOptions, type TxResult, type WriteFn } from '../contract/campuschain';
import {
  CAMPUSCHAIN_ADDRESS,
  DERIVATION_INDEX,
  isContractConfigured,
  PGAS_ASSET_ID,
  PRODUCT_CONTEXT_TIMEOUT_MS,
  PRODUCT_DOMAIN,
  READ_TIMEOUT_MS,
  SIGN_TIMEOUT_MS,
} from '../contract/config';
import { revertMessage } from '../contract/errors';
import { formatPgas, PGAS_LOW, readPgas as readPgasRpc } from '../contract/pgas';
import { createReads, type Reads } from '../contract/reads';
import { createRpcContract, withHostFallback } from '../contract/rpcReader';
import { describeError, withTimeout } from '../lib/format';
import { autoReconnect, classifyTxError, NO_DEPOSIT_MESSAGE, type TxErrorKind, type TxProblem } from '../lib/txErrors';
import { advance, begin, finish, stepForSdkStatus, type Progress, type ProgressStep } from './progress';

/* -------------------------------------------------------------------- API */

export type HostPhase = 'buscando' | 'fuera' | 'conectando' | 'listo' | 'error';

export interface HubState {
  host: HostPhase;
  message: string;
  account: { h160: `0x${string}`; ss58: string } | null;
  allowance: 'Allocated' | 'Rejected' | 'NotAvailable' | null;
  busy: boolean; // hay una firma (o una solicitud del Host) en curso
  progress: Progress | null;
}

export type Result =
  | { ok: true; message: string; txHash?: string }
  | { ok: false; message: string; details?: string; kind?: TxErrorKind };

/** Una escritura al contrato: qué función, con qué argumentos y cómo saber que ya entró. */
export interface WriteRequest {
  fn: WriteFn;
  args: unknown[];
  /** Título del popup: «Aceptar pedido». */
  title: string;
  /** true cuando la relectura ya muestra el cambio. */
  landed: () => Promise<boolean>;
  /** Mensaje si la simulación revierte con un error que no se reconoce. */
  rejected: string;
  saved: string;
}

export interface Hub {
  getState(): HubState;
  subscribe(listener: (s: HubState) => void): () => void;
  start(): Promise<void>;
  connect(): Promise<Result>;
  write(request: WriteRequest): Promise<Result>;
  /** Cierra el popup del último resultado. */
  dismiss(): void;
  reads: Reads;
}

/** TrUAPI del Host. hub.ts solo comprueba que exista. */
export type TruApi = object;

export interface ChainRuntime {
  destroy(): void;
}

export interface SignerAccount {
  /** SS58. */
  address: string;
  h160Address: `0x${string}`;
}

export interface SignerLike {
  connect(): Promise<unknown>;
  getProductAccount(productId: string, index: number):
    Promise<{ ok: true; value: SignerAccount } | { ok: false; error: unknown }>;
  destroy(): void;
}

export interface HubDeps {
  isInsideContainer(): Promise<boolean>;
  getTruApi(): Promise<TruApi | null>;
  getProductContext(timeoutMs: number): Promise<{ productId: string } | null>;
  connectChain(): Promise<ChainRuntime>;
  createSigner(productId: string): SignerLike;
  requestAllowance(): Promise<'Allocated' | 'Rejected' | 'NotAvailable'>;
  reader: CampusChainContract;
  writer(runtime: ChainRuntime, account: SignerAccount): CampusChainContract;
  readPgas(account: { h160: `0x${string}`; ss58: string }): Promise<bigint | null>;
  /** false mientras CAMPUSCHAIN_ADDRESS sea 0x000…: no se pide ninguna firma. */
  contractConfigured(): boolean;
  sleep(ms: number): Promise<void>;
  log: Pick<Console, 'info' | 'warn' | 'error'>;
}

/* ---------------------------------------------------------------- textos */

export const OUTSIDE = 'Abre CampusChain dentro de Polkadot Desktop o de la Polkadot App para comprar y vender. Aquí puedes ver el catálogo y los pedidos.';
const BUSY = 'Espera a que termine la firma en curso.';
const NO_ACCOUNT = 'Conecta tu cuenta primero.';
const NO_CHAIN = 'La Polkadot App todavía no se conecta a la red. Reintenta.';
const NO_CONTRACT = 'Falta configurar la dirección del contrato (src/contract/config.ts).';
const REREADS = 4;
const REREAD_MS = 2_000;
const ACCOUNT_TIMEOUT_MS = 60_000;
const ALLOWANCE_TIMEOUT_MS = 90_000;

/**
 * El id con el que el Host deriva cuentas, deducido del host de la URL cuando el Host no lo dice.
 * `<n>.dot`, `<n>.dot.li`, `<n>.app.dot.li`, `<n>.dev-dot.li` y `<n>.app.dev-dot.li` → `<n>.dot`;
 * `localhost[:puerto]` sin cambio; cualquier otro → PRODUCT_DOMAIN.
 */
export function productIdFromHost(host: string): string {
  const h = host.toLowerCase();
  if (/^localhost(:\d{1,5})?$/.test(h) || h.endsWith('.dot')) return h;
  const label = /^([a-z0-9-]+)\.(?:app\.)?(?:dev-)?dot\.li$/.exec(h)?.[1];
  return label ? `${label}.dot` : PRODUCT_DOMAIN;
}

type TxOutcome = { ok: true; value?: TxResult } | { ok: false; error: unknown };
type Signed = { ok: true; txHash?: string } | { ok: false; problem: TxProblem };

type AnyFn = {
  query: (...args: unknown[]) => Promise<QueryResult<unknown>>;
  tx: (...args: unknown[]) => Promise<TxOutcome>;
};
const fnOf = (c: CampusChainContract, fn: WriteFn) => (c as unknown as Record<WriteFn, AnyFn>)[fn];

/* ------------------------------------------------------------------- hub */

/** Sin argumento usa defaultDeps() (implementación real, solo main.ts). Con argumento, HubDeps COMPLETO. */
export function createHub(deps?: HubDeps): Hub {
  const d = deps ?? defaultDeps();
  const listeners = new Set<(s: HubState) => void>();
  let state: HubState = {
    host: 'buscando',
    message: 'Buscando la Polkadot App…',
    account: null,
    allowance: null,
    busy: false,
    progress: null,
  };

  let productId: string | null = null;
  let chain: ChainRuntime | null = null;
  let chainReady: Promise<void> | null = null;
  let signer: SignerLike | null = null;
  let account: SignerAccount | null = null;
  let writer: CampusChainContract | null = null;

  const set = (patch: Partial<HubState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  };

  const step = (next: ProgressStep | null) => {
    if (!next || !state.progress || !state.busy) return;
    const progress = advance(state.progress, next);
    if (progress !== state.progress) set({ progress });
  };

  const beginOp = (op: 'conectar' | 'firmar', title: string) => set({ busy: true, progress: begin(op, title) });

  const endOp = (result: Result): Result => {
    set({ busy: false, progress: state.progress ? finish(state.progress, result) : null });
    return result;
  };

  const openChain = (): Promise<void> => {
    chain?.destroy();
    chain = null;
    const task = d.connectChain().then(
      (c) => {
        chain = c;
      },
      (error: unknown) => {
        d.log.error('cadena del Host', describeError(error));
      },
    );
    chainReady = task;
    return task;
  };

  const connectAccount = async () => {
    if (!productId) throw new Error('No hay conexión con la Polkadot App.');
    if (!chain) throw new Error(NO_CHAIN);
    signer?.destroy();
    d.log.info('conectando cuenta', productId);
    const manager = d.createSigner(productId);
    signer = manager;
    const connected = await withTimeout(manager.connect(), ACCOUNT_TIMEOUT_MS, 'Conexión de firma');
    if (typeof connected === 'object' && connected !== null && (connected as { ok?: unknown }).ok === false) {
      throw (connected as { error?: unknown }).error ?? new Error('El Host rechazó la conexión.');
    }
    const result = await withTimeout(manager.getProductAccount(productId, DERIVATION_INDEX), ACCOUNT_TIMEOUT_MS, 'Cuenta del Product');
    if (!result.ok) throw result.error;
    account = result.value;
    writer = d.writer(chain, result.value);
    set({ account: { h160: result.value.h160Address, ss58: result.value.address } });
  };

  const reconnect = async (): Promise<boolean> => {
    step('conectando');
    await openChain();
    if (!chain) return false;
    try {
      await connectAccount();
      return true;
    } catch (error) {
      d.log.warn('reconexión', describeError(error));
      return false;
    }
  };

  const askAllowance = async (): Promise<'Allocated' | 'Rejected' | 'NotAvailable'> => {
    let outcome: 'Allocated' | 'Rejected' | 'NotAvailable';
    step('permiso-gas');
    try {
      outcome = await withTimeout(d.requestAllowance(), ALLOWANCE_TIMEOUT_MS, 'Permiso de gas');
    } catch (error) {
      d.log.warn('permiso de gas', describeError(error));
      outcome = 'NotAvailable';
    }
    set({ allowance: outcome });
    return outcome;
  };

  const pgasNow = () => (account ? d.readPgas({ h160: account.h160Address, ss58: account.address }) : Promise.resolve(null));

  /**
   * Firma y envía con una recuperación automática:
   *  - sin PGAS → pide SmartContractAllowance y reintenta una vez;
   *  - pago rechazado con PGAS, sesión desfasada o conexión caída → reconecta y reintenta una vez.
   */
  const signWithRecovery = async (attempt: (c: CampusChainContract) => Promise<TxOutcome>): Promise<Signed> => {
    const run = async (): Promise<TxOutcome> => {
      const contract = writer;
      if (!contract) return { ok: false, error: new Error('Host provider is not connected') };
      step('firma');
      try {
        return await attempt(contract);
      } catch (error) {
        return { ok: false, error };
      }
    };
    let result = await run();
    if (result.ok) return { ok: true, txHash: result.value?.txHash };
    let problem = classifyTxError(result.error, await pgasNow(), PGAS_LOW, formatPgas);
    d.log.warn('tx', problem.kind, problem.raw);

    let retry = false;
    if (problem.kind === 'no-gas') retry = (await askAllowance()) !== 'Rejected';
    else if (autoReconnect(problem.kind)) retry = await reconnect();
    if (retry) {
      result = await run();
      if (result.ok) return { ok: true, txHash: result.value?.txHash };
      problem = classifyTxError(result.error, await pgasNow(), PGAS_LOW, formatPgas);
      d.log.warn('tx (reintento)', problem.kind, problem.raw);
    }
    return { ok: false, problem };
  };

  const reread = async (done: () => Promise<boolean>, times = REREADS): Promise<boolean> => {
    for (let i = 0; i < times; i++) {
      if (i > 0) await d.sleep(REREAD_MS);
      try {
        if (await done()) return true;
      } catch (error) {
        d.log.warn('relectura', describeError(error));
      }
    }
    return false;
  };

  /*
   * waitFor 'finalized'. En product-sdk-tx 0.5.3, 'best-block' resuelve la promesa en in-block y
   * 'finalized' al finalizar.
   */
  const txOptions = { waitFor: 'finalized' as const, timeoutMs: SIGN_TIMEOUT_MS };

  /** Simular → firmar (con recuperación) → releer. Nunca dos a la vez. */
  const write = async (req: WriteRequest): Promise<Result> => {
    const who = account!;
    beginOp('firmar', req.title);
    const opts: TxOptions = { ...txOptions, onStatus: (status) => step(stepForSdkStatus(status)) };
    let result: Result;
    try {
      const preview = await fnOf(d.reader, req.fn).query(...req.args, { from: who.h160Address, origin: who.address });
      if (!preview.success) {
        const message = revertMessage(preview.value) ?? req.rejected;
        d.log.info('simulación revirtió', req.fn, message);
        result = { ok: false, message, ...(message === NO_DEPOSIT_MESSAGE ? { kind: 'no-deposit' as const } : {}) };
      } else {
        const signed = await signWithRecovery((c) => fnOf(c, req.fn).tx(...req.args, opts));
        if (signed.ok) {
          step('actualizando');
          const landed = await reread(req.landed);
          if (!landed) d.log.warn('la relectura todavía no muestra el cambio');
          result = {
            ok: true,
            message: landed ? req.saved : 'Enviado. Puede tardar unos segundos en aparecer.',
            ...(signed.txHash ? { txHash: signed.txHash } : {}),
          };
        } else {
          const { problem } = signed;
          if (problem.kind === 'timeout') step('actualizando');
          if (problem.kind === 'timeout' && (await reread(req.landed, 1))) {
            d.log.warn('tx sin respuesta, pero ya está en la cadena');
            result = { ok: true, message: req.saved };
          } else {
            result = { ok: false, message: problem.message, details: problem.raw, kind: problem.kind };
          }
        }
      }
    } catch (error) {
      d.log.warn('escritura', describeError(error));
      result = { ok: false, message: describeError(error) };
    }
    return endOp(result);
  };

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    reads: createReads(d.reader),

    async start() {
      set({ host: 'buscando', message: 'Buscando la Polkadot App…' });
      let inside = false;
      try {
        inside = await d.isInsideContainer();
      } catch (error) {
        d.log.warn('isInsideContainer', describeError(error));
      }
      if (!inside) {
        d.log.info('fuera del Host: modo solo lectura');
        set({ host: 'fuera', message: OUTSIDE });
        return;
      }
      set({ host: 'conectando', message: 'Conectando con la Polkadot App…' });
      try {
        const truApi = await d.getTruApi();
        if (!truApi) throw new Error('el Host no expone TrUAPI.');
      } catch (error) {
        d.log.error('TrUAPI', describeError(error));
        set({ host: 'error', message: `No se pudo hablar con la Polkadot App: ${describeError(error)}` });
        return;
      }
      const context = await d.getProductContext(PRODUCT_CONTEXT_TIMEOUT_MS).catch(() => null);
      if (context) productId = context.productId;
      else {
        productId = productIdFromHost(typeof location === 'undefined' ? '' : location.host);
        d.log.info('getProductContext no respondió; id deducido de la URL', productId);
      }
      void openChain();
      set({ host: 'listo', message: 'Conectado a Products Devnet.' });
    },

    async connect() {
      if (state.host === 'fuera') return { ok: false, message: OUTSIDE };
      if (state.host !== 'listo' || !productId) return { ok: false, message: 'Todavía no hay conexión con la Polkadot App. Reintenta.' };
      if (state.busy) return { ok: false, message: BUSY };
      beginOp('conectar', 'Conectar cuenta');
      const run = async (): Promise<Result> => {
        if (chainReady) await chainReady;
        if (!chain) await openChain();
        if (!chain) {
          d.log.error('connect sin cadena');
          return { ok: false, message: NO_CHAIN };
        }
        try {
          await connectAccount();
        } catch (error) {
          d.log.warn('connect', describeError(error));
          return { ok: false, message: `No se pudo conectar tu cuenta: ${describeError(error)}` };
        }
        const outcome = await askAllowance();
        if (outcome === 'Rejected') {
          d.log.warn('permiso de gas rechazado');
          return { ok: false, message: 'Rechazaste el permiso de gas. Sin él no puedes firmar pedidos; toca Conectar otra vez.' };
        }
        if (outcome === 'NotAvailable') {
          d.log.warn('permiso de gas no disponible ahora');
          return { ok: true, message: 'Cuenta conectada. El gas se pedirá al firmar.' };
        }
        d.log.info('cuenta conectada');
        return { ok: true, message: 'Cuenta conectada.' };
      };
      let result: Result;
      try {
        result = await run();
      } catch (error) {
        d.log.warn('connect', describeError(error));
        result = { ok: false, message: `No se pudo conectar tu cuenta: ${describeError(error)}` };
      }
      return endOp(result);
    },

    async write(req) {
      if (state.host === 'fuera') return { ok: false, message: OUTSIDE };
      if (!d.contractConfigured()) return { ok: false, message: NO_CONTRACT };
      if (state.busy) return { ok: false, message: BUSY };
      if (!account || !writer) return { ok: false, message: NO_ACCOUNT };
      return write(req);
    },

    dismiss() {
      if (!state.busy && state.progress) set({ progress: null });
    },
  };
}

/* ---------------------------------------------------- implementación real */

type SdkTruApi = NonNullable<Awaited<ReturnType<typeof HostSdk.getTruApi>>>;

interface RealChain extends ChainRuntime {
  runtime: ContractsSdk.ContractRuntime;
  contracts: typeof ContractsSdk;
  pgasBalance(ss58: string): Promise<bigint>;
}

/**
 * Las dependencias reales. El SDK se carga con import() al usarse: así los tests (que inyectan
 * dobles) nunca lo cargan y el bundle inicial es más chico.
 */
function defaultDeps(): HubDeps {
  const prefix = '[campuschain]';
  const log: HubDeps['log'] = {
    info: (...a: unknown[]) => console.info(prefix, ...a),
    warn: (...a: unknown[]) => console.warn(prefix, ...a),
    error: (...a: unknown[]) => console.error(prefix, ...a),
  };
  const host = () => import('@parity/product-sdk/host');
  let truApi: SdkTruApi | null = null;
  let chain: RealChain | null = null;
  let hostContract: CampusChainContract | null = null;

  return {
    async isInsideContainer() {
      return (await host()).isInsideContainer();
    },

    async getTruApi() {
      truApi = await (await host()).getTruApi();
      return truApi;
    },

    async getProductContext(timeoutMs) {
      if (!truApi) return null;
      try {
        const context = await withTimeout(
          truApi.system.getProductContext().match(
            (value) => value,
            (error) => {
              throw new Error(describeError(error));
            },
          ),
          timeoutMs,
          'getProductContext',
        );
        return { productId: context.productId };
      } catch (error) {
        log.warn('getProductContext', describeError(error));
        return null;
      }
    },

    async connectChain() {
      const [{ createChainClient }, contracts, { devnet_asset_hub }] = await Promise.all([
        import('@parity/product-sdk/chain'),
        import('@parity/product-sdk/contracts'),
        import('@parity/product-sdk-descriptors/devnet-asset-hub'),
      ]);
      const client = await createChainClient({ chains: { assetHub: devnet_asset_hub } });
      const runtime = contracts.createContractRuntimeFromClient(client.raw.assetHub, devnet_asset_hub, { at: 'best' });
      const real: RealChain = {
        runtime,
        contracts,
        async pgasBalance(ss58) {
          const asset = await client.assetHub.query.Assets.Account.getValue(PGAS_ASSET_ID, ss58, { at: 'best' });
          return asset?.balance ?? 0n;
        },
        destroy() {
          client.destroy();
          if (chain === real) {
            chain = null;
            hostContract = null;
          }
        },
      };
      chain = real;
      hostContract = contracts.createContract(runtime, CAMPUSCHAIN_ADDRESS, campuschainAbi) as unknown as CampusChainContract;
      try {
        const block = await withTimeout(client.assetHub.query.System.Number.getValue({ at: 'best' }), READ_TIMEOUT_MS, 'Bloque de Asset Hub');
        log.info('cadena del Host lista', { block: Number(block) });
      } catch (error) {
        real.destroy();
        throw error;
      }
      return real;
    },

    createSigner(productId) {
      let manager: WalletSdk.SignerManager | null = null;
      return {
        async connect() {
          const { SignerManager } = await import('@parity/product-sdk/wallet');
          manager = new SignerManager({
            dappName: productId,
            ss58Prefix: 42,
            hostTimeout: 30_000,
            maxRetries: 1,
            persistence: null,
          });
          return manager.connect();
        },
        async getProductAccount(id, index) {
          if (!manager) return { ok: false, error: new Error('Primero conecta con la Polkadot App.') };
          return manager.getProductAccount(id, index);
        },
        destroy() {
          manager?.destroy();
          manager = null;
        },
      };
    },

    async requestAllowance() {
      const r = await (await host()).requestResourceAllocation([
        { tag: 'SmartContractAllowance', value: { tag: 'Index', value: DERIVATION_INDEX } },
      ]);
      if (!r.ok) log.warn('requestResourceAllocation', describeError(r.error));
      const outcome = r.ok ? r.value[0] : undefined;
      return outcome === 'Allocated' || outcome === 'Rejected' ? outcome : 'NotAvailable';
    },

    reader: withHostFallback(createRpcContract(), () => hostContract),

    writer(runtime, account) {
      const real = runtime as RealChain;
      const sdkAccount = account as unknown as WalletSdk.SignerAccount;
      return real.contracts.createContract(real.runtime, CAMPUSCHAIN_ADDRESS, campuschainAbi, {
        defaultOrigin: sdkAccount.address,
        defaultSigner: sdkAccount.getSigner(),
      }) as unknown as CampusChainContract;
    },

    async readPgas(account) {
      const viaRpc = await readPgasRpc(account.h160);
      if (viaRpc !== null) return viaRpc;
      if (!chain) return null;
      try {
        return await chain.pgasBalance(account.ss58);
      } catch (error) {
        log.warn('PGAS por el Host', describeError(error));
        return null;
      }
    },

    contractConfigured: isContractConfigured,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log,
  };
}
