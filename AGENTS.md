# AGENTS.md

## Proyecto
CampusChain: marketplace universitario (Vite + TypeScript, sin framework de UI) que corre en el
navegador y dentro de Polkadot Desktop o la Polkadot App. El catálogo, los pedidos, su historial y
la reputación viven en el contrato `contrato/CampusChain.sol`. No hay backend. Firebase (proyecto
`campuschain-1e093`, código en `src/firebase/`) guarda solo las cuentas (registro e inicio de sesión
con correo @uanl.edu.mx) y qué productos borró cada vendedor; las reglas están en `firestore.rules`.
Ese contrato es el del equipo, ya desplegado; otras apps del equipo lo usan. No lo cambies: si algo
nuevo necesita guardarse en la cadena, dímelo y propón el cambio. Cada cambio es un despliegue
nuevo, con otra dirección y otra ABI, y hay que acordarlo con el equipo.

## Red
- Solo Products Devnet: Asset Hub 1000, chainId 420420417.
- Descriptor: devnet_asset_hub, desde @parity/product-sdk-descriptors/devnet-asset-hub.
- Nunca paseo, paseo_asset_hub, Paseo Next v2 ni "Paseo PassetHub (420420422)".
- Los orígenes de red de la app son `ETH_RPC_URL` de `src/contract/config.ts` y los de Firebase
  (Auth y Firestore, que usa el SDK `firebase`). Nada de CDNs, fuentes, APIs de IA, `<link>`,
  `@import` ni `url()` hacia `http(s)://`.

## Versiones
- Exactas, sin ^ ni ~. No actualizar ninguna sin que yo lo pida.
- @parity/product-sdk 0.39.0, polkadot-api 3.2.1, viem 2.56.9, firebase 12.19.0
- @parity/product-sdk-descriptors como alias npm:@polkadot-community-foundation/product-sdk-descriptors@0.14.0-pcf.1
- @parity/truapi 0.25.0 con overrides acotados (padre@versión>hijo) en pnpm-workspace.yaml. Nunca overrides globales: rompen pnpm dlx de pad.
- pnpm 12.6.0 en devEngines

## Gestor de paquetes
- Solo pnpm. Nunca npm ni yarn.
- No toques `package.json`, `pnpm-lock.yaml` ni `pnpm-workspace.yaml` sin que yo lo pida.

## Reglas del producto
- El pago es tradicional. En la interfaz se dice «Pago reportado por vendedor», nunca «pago verificado».
- La reputación sale solo del contrato y siempre se muestra con el tamaño de la muestra; sin
  pedidos aceptados no se muestra porcentaje.
- Nada de datos personales en el contrato: solo puntos generales del campus y direcciones.
- No afirmar que se verifica a estudiantes ni integración con la universidad: el contrato no lo hace,
  y el registro solo revisa que el correo termine en @uanl.edu.mx (no confirma que sea de un alumno).
- El contrato no borra productos. «Borrar» (solo lo ve el vendedor) hace `setAvailable(false)` y
  guarda la marca en `usuarios/{uid}/borrados`. «Mis ventas» cuenta solo pedidos COMPLETADOS.
- La dirección del contrato vive solo en `src/contract/config.ts`.
- El id del pedido (bytes32 al azar) y su hash los genera la app en `src/contract/campuschain.ts`
  (`newOrderId`, `computeOrderHash`). Si cambias la fórmula del hash, los pedidos viejos ya no verifican.
- Guardar datos cobra un depósito en PAS aparte del gas (`StorageDepositNotEnoughFunds`). El mensaje
  vive en `src/lib/txErrors.ts`.
- `src/lib/orderActions.ts` repite las reglas de quién puede hacer qué; el contrato es el que decide.
  Si cambias una, cambia la otra y sus tests.

## SDK
- Toda la conexión con el Host está en `src/hub/hub.ts` (`createHub()`).
- Antes de cada `.tx()` se simula con `.query()`. Una firma a la vez. Ninguna pantalla llama `.tx()`
  ni `hub.reads`: las pantallas usan `ctx.data` (interfaz `CampusData` de `src/shared/datasource.ts`).

## Equipo y carpetas
- `src/shared/` es el contrato de datos (tipos JSON, `CampusData`, estados). Cambios solo en PRs
  chicos a main que revisen los dos desarrolladores.
- Desarrollador 1 (rama `frontend-ui`): `src/ui/`, `src/mocks/`, `src/styles.css`, `lib/format`, `lib/money`.
- Desarrollador 2 (rama `backend-data`): `src/data/`, `src/contract/`, `src/hub/`, `src/firebase/`,
  el resto de `src/lib/` y `firestore.rules`.
- `src/data/realSource.ts` implementa `CampusData` con el contrato y Firebase; `src/mocks/mockSource.ts`
  con datos en memoria. `pnpm dev --mode mock` usa los mocks (sin Host, red ni Firebase); `pnpm build`
  no los incluye.
- Montos en `shared/` van como texto en centavos de MXN. `stock` e `imagenUrl` son null: el contrato
  no los tiene.

## Vite
- base: './' en vite.config.js.

## Secretos
- Nunca pedir, leer, escribir ni mostrar frases de recuperación, llaves privadas o archivos .env.

## Forma de trabajo
- Pasos chicos: un cambio por vez.
- Cada cambio con su test. No borrar, saltar ni desactivar tests.
- Al terminar, decir qué archivos cambiaste y cómo probarlo.

## Comandos (desde campuschain/)
- pnpm dev
- pnpm dev --mode mock (interfaz con datos de ejemplo)
- pnpm test
- pnpm test:red (contra el contrato desplegado, necesita red)
- pnpm build
- pnpm --dir contrato test
- pnpm --dir contrato abi
