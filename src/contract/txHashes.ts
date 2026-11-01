import { createPublicClient, http, type Abi } from 'viem';
import { campuschainAbi, Status, type Hex } from './campuschain';
import { CAMPUSCHAIN_ADDRESS, ETH_RPC_URL, RPC_TIMEOUT_MS } from './config';

/*
 * El contrato guarda quién y cuándo, pero no el hash de su propia transacción. Ese hash sale de los
 * eventos del pedido (eth_getLogs filtrado por orderId): `OrderCreated` para CREATED y
 * `OrderStatusChanged` para los demás. Si el RPC no los da, de lo que esta app firmó en este
 * dispositivo.
 */

const client = createPublicClient({ transport: http(ETH_RPC_URL, { timeout: RPC_TIMEOUT_MS, retryCount: 1 }) });
const abi = campuschainAbi as unknown as Abi;

/** Hash de transacción de cada estado del pedido. Vacío si no se pudo leer; nunca lanza. */
export async function readStatusTxHashes(orderId: Hex): Promise<Map<Status, Hex>> {
  const found = new Map<Status, Hex>();
  const events = (eventName: 'OrderCreated' | 'OrderStatusChanged') =>
    client.getContractEvents({ address: CAMPUSCHAIN_ADDRESS, abi, eventName, args: { orderId }, fromBlock: 0n, toBlock: 'latest' });
  try {
    const [created, changed] = await Promise.all([events('OrderCreated'), events('OrderStatusChanged')]);
    for (const log of created) if (log.transactionHash) found.set(Status.CREATED, log.transactionHash);
    for (const log of changed) {
      const status = Number((log.args as { newStatus?: unknown }).newStatus) as Status;
      if (log.transactionHash) found.set(status, log.transactionHash);
    }
  } catch (error) {
    console.warn('[campuschain] eventos del pedido', error);
  }
  for (const [status, hash] of localHashes(orderId)) if (!found.has(status)) found.set(status, hash);
  return found;
}

/* Respaldo local: los hashes de lo que firmaste en este dispositivo. Solo una comodidad. */

const KEY = 'campuschain:tx';

function load(): Record<string, Hex> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, Hex>) : {};
  } catch {
    return {};
  }
}

export function rememberTxHash(orderId: Hex, status: Status, hash: string | undefined): void {
  if (!hash || !/^0x[0-9a-f]{64}$/i.test(hash)) return;
  try {
    const all = load();
    all[`${orderId.toLowerCase()}:${status}`] = hash as Hex;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Sin almacenamiento: el historial sigue mostrando quién y cuándo.
  }
}

function localHashes(orderId: Hex): Map<Status, Hex> {
  const out = new Map<Status, Hex>();
  for (const [key, hash] of Object.entries(load())) {
    const [id, status] = key.split(':');
    if (id === orderId.toLowerCase()) out.set(Number(status) as Status, hash);
  }
  return out;
}
