import { decodeErrorResult, toFunctionSelector, type Abi, type Hex } from 'viem';
import { NO_DEPOSIT, NO_DEPOSIT_MESSAGE } from '../lib/txErrors';
import { campuschainAbi, STATUS_LABEL, type Status } from './campuschain';

/** Errores de CampusChain.sol con la firma completa (la que da el selector de 4 bytes). */
const SIGNATURES = {
  ProductNotFound: 'ProductNotFound()',
  ProductUnavailable: 'ProductUnavailable()',
  OrderExists: 'OrderExists()',
  OrderNotFound: 'OrderNotFound()',
  NotBuyer: 'NotBuyer()',
  NotSeller: 'NotSeller()',
  InvalidStatus: 'InvalidStatus(uint8)',
  SelfPurchase: 'SelfPurchase()',
  InvalidQuantity: 'InvalidQuantity()',
} as const;

type ErrorName = keyof typeof SIGNATURES;

const MESSAGES: Record<Exclude<ErrorName, 'InvalidStatus'>, string> = {
  ProductNotFound: 'Ese producto no existe.',
  ProductUnavailable: 'El vendedor pausó este producto.',
  OrderExists: 'Ya existe un pedido con ese id. Inténtalo otra vez.',
  OrderNotFound: 'Ese pedido no existe.',
  NotBuyer: 'Solo el comprador de este pedido puede hacer esto.',
  NotSeller: 'Solo el vendedor puede hacer esto.',
  SelfPurchase: 'No puedes comprar tu propio producto.',
  InvalidQuantity: 'La cantidad debe ser mayor que cero.',
};

function message(name: ErrorName, args: readonly unknown[] | undefined): string {
  if (name !== 'InvalidStatus') return MESSAGES[name];
  const current = args?.[0];
  const label = current === undefined ? null : STATUS_LABEL[Number(current) as Status];
  return label ? `El pedido ya cambió de estado (ahora: ${label}). Actualiza la pantalla.` : 'El pedido ya cambió de estado. Actualiza la pantalla.';
}

const NAMES = Object.keys(SIGNATURES) as ErrorName[];
const BY_SELECTOR = new Map(NAMES.map((name) => [toFunctionSelector(SIGNATURES[name]).toLowerCase(), name]));
const isName = (value: unknown): value is ErrorName => typeof value === 'string' && value in SIGNATURES;

function serialise(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) => {
      if (typeof v === 'bigint') return v.toString();
      if (v instanceof Uint8Array) return `0x${Array.from(v, (b) => b.toString(16).padStart(2, '0')).join('')}`;
      return v;
    }) ?? '';
  } catch {
    return String(value);
  }
}

function decodeArgs(data: string): readonly unknown[] | undefined {
  try {
    return decodeErrorResult({ abi: campuschainAbi as unknown as Abi, data: data as Hex }).args;
  } catch {
    return undefined;
  }
}

/**
 * Mensaje en español para un revert de CampusChain, o null si no se reconoce (quien llama usa su
 * mensaje genérico). Acepta cuatro formas:
 *  1. `{ error: 'NotSeller', args }` (rpcReader con viem);
 *  2. el error de Revive `StorageDepositNotEnoughFunds` (la cuenta no tiene PAS para el depósito);
 *  3. cualquier valor que contenga los datos del revert (`0x` + selector de 4 bytes…), como el SDK;
 *  4. cualquier valor cuyo JSON contenga el nombre del error.
 */
export function revertMessage(value: unknown): string | null {
  if (typeof value === 'object' && value !== null) {
    const v = value as { error?: unknown; args?: unknown };
    if (isName(v.error)) return message(v.error, Array.isArray(v.args) ? v.args : undefined);
  }
  const text = serialise(value);
  if (NO_DEPOSIT.test(text)) return NO_DEPOSIT_MESSAGE;
  for (const match of text.toLowerCase().matchAll(/0x[0-9a-f]{8,}/g)) {
    const name = BY_SELECTOR.get(match[0].slice(0, 10));
    if (name) return message(name, decodeArgs(match[0]));
  }
  // Los nombres más largos primero, por si uno contiene a otro.
  for (const name of [...NAMES].sort((a, b) => b.length - a.length)) {
    if (text.includes(name)) return message(name, undefined);
  }
  return null;
}
