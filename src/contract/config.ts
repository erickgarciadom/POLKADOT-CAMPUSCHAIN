// El contrato CampusChain del equipo, desplegado con Remix en Products Devnet (README.md).
// Si lo vuelven a desplegar, cambia esta dirección y corre `pnpm --dir contrato abi`.
export const CAMPUSCHAIN_ADDRESS = '0xa273d115E4C8077Cf00fd253c06Eb79Aa3CCD256' as `0x${string}`;
export const ETH_RPC_URL = 'https://eth-rpc-testnet.polkadot.io';
export const CHAIN_ID = 420_420_417;
export const EXPLORER_URL = 'https://blockscout-testnet.polkadot.io';
/** Tu nombre .dot. La cuenta de cada persona en esta app sale de este nombre. */
export const PRODUCT_DOMAIN = 'campuschain.dot';
export const DERIVATION_INDEX = 0;
export const PGAS_ASSET_ID = 2_000_000_000;
export const TOKEN_DECIMALS = 10;
export const PRODUCT_CONTEXT_TIMEOUT_MS = 3_000;
export const SIGN_TIMEOUT_MS = 300_000;
export const READ_TIMEOUT_MS = 20_000;
export const RPC_TIMEOUT_MS = 8_000;
/** Máximo de elementos que se leen por lista y cuántas lecturas van a la vez. */
export const MAX_ITEMS_READ = 300;
export const READ_PARALLEL = 8;

/**
 * Primer producto que muestra la app. El contrato no borra productos: los de prueba (1 a 4, del
 * 2026-10-31) siguen en la cadena pero ya no aparecen en el catálogo, perfiles ni «Mis productos».
 * Los pedidos viejos que los mencionan se siguen viendo. Pon 1 para volver a mostrar todos.
 */
export const FIRST_VISIBLE_PRODUCT = 5n;

export const isContractConfigured = () => !/^0x0{40}$/i.test(CAMPUSCHAIN_ADDRESS);
