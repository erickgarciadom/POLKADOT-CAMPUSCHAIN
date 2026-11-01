# CampusChain

Marketplace universitario con **historial de pedidos verificable** en Polkadot. Corre como mini app
dentro de la Polkadot App y Polkadot Desktop, en su propio dominio `.dot`.

Las estudiantes y los estudiantes publican productos, hacen pedidos y pagan como siempre (efectivo
o transferencia). El contrato `CampusChain.sol` registra **quién declaró cada paso y cuándo**:
pedido creado, aceptado, pago reportado por el vendedor, entrega declarada y recepción confirmada por
el comprador. Con eso se calcula una reputación que nadie puede editar a mano.

> **CampusChain convierte el comercio informal universitario en una experiencia más confiable
> mediante reputación e historial de pedidos verificable.**

| | |
|---|---|
| Abrir en la Polkadot App | `campuschain.dot` |
| Abrir en el navegador | <https://campuschain.dev-dot.li> (para firmar hay que iniciar sesión con tu cuenta de Polkadot en esa página, o usar la Polkadot App) |
| Red | Products Devnet (Asset Hub 1000), chainId **420420417** |
| Contrato | `0xa273d115E4C8077Cf00fd253c06Eb79Aa3CCD256` |

---

## Para quién y qué resuelve

En el campus se vende mucho entre estudiantes: comida, apuntes, accesorios, útiles. Todo se arregla
por mensaje y nadie sabe si el otro va a cumplir. CampusChain no mueve el dinero ni promete que no
habrá fraude: deja un **registro público de cada paso del pedido**, firmado por quien lo hizo, y una
reputación calculada solo con ese registro, siempre con el tamaño de la muestra.

## Pantallas

El menú va en una columna a la izquierda: un riel con iconos en el celular y una columna con nombres en
pantallas anchas. Cada pantalla tiene su propia distribución.

| Pantalla | Qué se hace | Distribución |
|---|---|---|
| Entrar / Registrarme | Cuenta con correo `@uanl.edu.mx` (Firebase Auth) | Tarjeta centrada con el logo |
| Conectar | Conectar la cuenta de la Polkadot App y aceptar permisos | Tarjeta centrada |
| Catálogo | Buscar y filtrar por categoría | Vitrina de mosaicos con el precio grande al pie |
| Producto | Ver el producto y la reputación del vendedor; hacer pedido | Ficha grande y, en pantallas anchas, la compra fija a la derecha |
| Mis pedidos | Lo que compraste | Boletos con el estado del otro lado de una línea punteada |
| Pedido | Estado, «Te toca», historial en la cadena y «Verificar hash» | Detalle e historial a la izquierda, la acción fija a la derecha |
| Vender | Publicar, pedidos recibidos y mis productos (pausar, reactivar, borrar) | Formulario a la izquierda, lo que llega a la derecha |
| Mis ventas | Saldos por periodo, KPIs de la tienda, gráfica y JSON descargable | Tablero; en el celular los periodos se deslizan de lado |
| Cuenta | Sesión, direcciones SS58 y 0x, red y versión | Credencial arriba y dos tarjetas de cartera |
| Vendedor | Perfil público: reputación y productos disponibles | Banner, franja de reputación y productos en dos columnas |

Mientras se revisa la sesión aparece una pantalla de carga con el logo y una barra de avance.

## Diseño

| | |
|---|---|
| Fondo | Morado oscuro `#140C2E` |
| Tarjetas y bloques | Morado `#1E153D` |
| Comprar, vender y saldos | Melocotón `#FFA959` |
| Alertas y acciones rápidas («Te toca», borrar, errores) | Naranja intenso `#FF6B2C` |
| Iconos y badges | Lavanda `#A28BFA` |
| Títulos y precios | Blanco `#FFFFFF` |
| Descripciones secundarias | Gris lavanda `#8B82A8` |
| Fuente | **Plus Jakarta Sans**: Bold en títulos y precios, SemiBold en botones, Regular en el texto |
| Logo | Canasta con fuego: `assets/icono.png` (icono de la app), `src/assets/logo.png` (cabecera, inicio de sesión y carga), `src/assets/favicon.png` |

- El texto sobre melocotón, naranja o lavanda va en `#140C2E` (con blanco no hay contraste).
- Esquinas cortadas en tarjetas, botones y campos (`corner-shape`; en Safari quedan redondeadas).
- Sin emojis en la interfaz: los iconos del menú son SVG y las demás marcas se dibujan con CSS.
- La fuente va dentro del bundle (`src/fonts/`, licencia OFL): la app no carga nada de Google Fonts ni de
  otros CDN.
- `src/ui/theme.test.ts` revisa la paleta, el contraste AA de cada par de colores, que el menú quede a
  la izquierda y que la fuente salga del bundle. `src/ui/sinEmojis.test.ts` falla si vuelve un emoji.

## Con qué está hecho

| Parte | Herramienta | Versión |
|---|---|---|
| Interfaz | TypeScript, Vite, sin framework de UI (DOM con un helper `h()` propio) | TypeScript 5.9.3, Vite 8.3.1 |
| Conexión con el Host, cuenta y firmas | `@parity/product-sdk` | 0.39.0 |
| Cadena (descriptor `devnet_asset_hub`) | `polkadot-api`, `@parity/product-sdk-descriptors` (alias de `@polkadot-community-foundation/product-sdk-descriptors`) | 3.2.1, 0.14.0-pcf.1 |
| Lecturas del contrato, ABI y hashes | `viem` contra el ETH-RPC del devnet | 2.56.9 |
| Contrato | Solidity, desplegado con Remix | `solc` 0.8.28 |
| Cuentas y productos borrados | Firebase Auth y Firestore | `firebase` 12.19.0 |
| Pruebas | Vitest | 5.0.3 |
| Publicación | `@polkadot-community-foundation/polkadot-app-deploy` en Bulletin y DotNS | 0.22.1 |
| Gestor de paquetes | pnpm (también con `corepack pnpm@12.6.0`) | 12.6.0 |
| Fuente | Plus Jakarta Sans (de `@fontsource-variable/plus-jakarta-sans`, archivo copiado al repo) | 5.3.0 |
| Guía de diseño para Claude Code | Skill `frontend-design` de `anthropics/skills`, en `.claude/skills/` | — |

Las versiones son exactas (sin `^` ni `~`). Las reglas del proyecto están en `AGENTS.md`.

---

## El contrato

Es el contrato del equipo, ya desplegado en Products Devnet:

| | |
|---|---|
| Dirección | `0xa273d115E4C8077Cf00fd253c06Eb79Aa3CCD256` |
| Red | Products Devnet, chainId **420420417** |
| Código | `contrato/CampusChain.sol` (compila al mismo bytecode que el desplegado; solo cambia la metadata) |
| Tamaño | 11,253 de 24,576 bytes |

La dirección vive solo en `src/contract/config.ts`. Si el equipo vuelve a desplegar, se cambia ahí
y se corre `pnpm --dir contrato abi`. Los datos del contrato anterior no se pasan.

Cómo lo usa la app:

- **Productos:** ids 1, 2, 3… Como el contrato no tiene una función que liste el catálogo, la app
  lee `productCount` y después `getProduct` de cada uno (hasta 300). Los productos de prueba (1 a 4)
  ya no se muestran: `FIRST_VISIBLE_PRODUCT` en `src/contract/config.ts`.
- **Pedidos:** el id es un `bytes32` al azar que genera la app del comprador. La app también calcula
  el hash, `keccak256(abi.encode(orderId, productId, quantity, totalCents, buyer, seller))`, y el
  contrato lo guarda tal cual. «Verificar hash» lo recalcula con lo que devuelve `getOrder`.
- **Reputación:** `getSellerStats` (aceptados, completados y cancelados). Sin estrellas.
- **Hash de cada transacción:** de los eventos `OrderCreated` y `OrderStatusChanged`, filtrados por
  `orderId`.

---

## Qué cambió respecto al documento del MVP

Una app de la Polkadot App no es una dApp con MetaMask y servidor. Estas son las adaptaciones:

| Documento del MVP | En CampusChain | Por qué |
|---|---|---|
| MetaMask firma | Firma el **Host** (Polkadot App o Desktop) con `@parity/product-sdk` | Dentro del Host no hay MetaMask; cada app tiene su propia cuenta |
| Backend Node + Firebase/MongoDB | Catálogo, pedidos, historial y reputación **en el contrato**; Firebase solo para cuentas y la marca de productos borrados | La app es un bundle estático en Bulletin, sin servidor propio |
| `orderId` y `orderHash` del backend | Los genera la app del comprador y el contrato los guarda | Sin backend no hay quién genere ids |
| Polkadot Hub EVM TestNet + Hardhat | **Products Devnet** (chainId 420420417), REVM, `solc` 0.8.28, desplegado con **Remix** | La red y las herramientas del curso |
| Login con correo institucional | Registro con correo `@uanl.edu.mx` (Firebase) y, para firmar, la cuenta del Host | El contrato no tiene alias ni verificación de estudiantes |
| Asistente IA | Fuera del MVP | Una API key quedaría pública en el bundle |

Lo que **no** cambió: la máquina de estados, las reglas de quién puede hacer qué, «pago reportado» en
lugar de «pago verificado», la reputación con tamaño de muestra y nada de datos personales on-chain.

---

## PAS para el depósito de almacenamiento

Cada transacción que guarda datos nuevos en el contrato (publicar un producto, crear un pedido,
cada cambio de estado) paga dos cosas:

- **La comisión**, en PGAS. La pone el Host cuando aceptas el permiso de gas.
- **Un depósito de almacenamiento**, en **PAS**, desde la cuenta que firma. El PGAS no lo cubre.

Sin PAS, la firma falla con `StorageDepositNotEnoughFunds` y la app dice «Tu cuenta no tiene PAS
para el depósito de almacenamiento». Para resolverlo:

1. En la app, abre **Cuenta** y toca **Copiar dirección SS58**. Es la cuenta de esa app, distinta de
   tu cuenta principal de la Polkadot App.
2. En [faucet.polkadot.io](https://faucet.polkadot.io) elige **Paseo → Asset Hub (1000)** y pega esa
   dirección. No uses la dirección `0x`.
3. Reintenta.

Cada persona de la demo necesita PAS en su cuenta de la app.

---

## Estructura

| Carpeta o archivo | Qué tiene |
|---|---|
| `contrato/CampusChain.sol` | El contrato del equipo: productos, pedidos, historial y estadísticas del vendedor |
| `contrato/test/` | 13 pruebas en una EVM local, el script de la ABI y el de tamaño |
| `src/contract/` | Dirección (`config.ts`), ABI, tipos y decodificadores, lecturas, errores y hashes de transacción |
| `src/hub/` | Conexión con el Host: cuenta, gas y firmas (basado en `game/src/hub/` del curso) |
| `src/lib/` | Lógica pura con tests: acciones por rol, reputación, dinero, errores de transacción |
| `src/ui/` | Pantallas (`pages/`), menú y rutas (`nav.ts`), marco de la app (`app.ts`), piezas comunes (`parts.ts`) y popup de firma |
| `src/styles.css` | Paleta, tipografía, menú y la distribución de cada pantalla (`.main[data-vista=…]`) |
| `src/assets/` | Logo de la cabecera y favicon |
| `src/fonts/` | Plus Jakarta Sans (woff2) y su licencia OFL |
| `src/firebase/` | Registro e inicio de sesión (Firebase Auth) y productos borrados (Firestore) |
| `src/shared/` | Contrato de datos entre interfaz y datos: tipos JSON (`Producto`, `Orden`…), `CampusData` y estados |
| `src/data/` | `CampusData` real: adaptadores del contrato a `shared/`, métricas de la tienda y `realSource.ts` |
| `src/mocks/` | `CampusData` de ejemplo para `pnpm dev --mode mock` |
| `firestore.rules`, `firebase.json`, `.firebaserc` | Reglas de la base y proyecto `campuschain-1e093` |
| `polkadot-app-deploy.config.mjs` | Nombre, descripción e icono para publicar |
| `assets/icono.png` | Icono de la app, 512 × 512 |
| `.claude/skills/frontend-design/` | Guía de diseño para Claude Code (Apache 2.0) |

---

## Trabajo en dos ramas

| Rama | Quién | Carpetas |
|---|---|---|
| `frontend-ui` | Desarrollador 1: interfaz y flujos | `src/ui/`, `src/mocks/`, `src/styles.css`, `src/assets/`, `src/fonts/` |
| `backend-data` | Desarrollador 2: datos, Firebase y reportes | `src/data/`, `src/contract/`, `src/hub/`, `src/firebase/`, `src/lib/` |

- Las pantallas solo hablan con `ctx.data` (`src/shared/datasource.ts`). El Desarrollador 1 trabaja con
  `pnpm dev --mode mock` (datos de `src/mocks/fixtures.ts`, sin Host, red ni Firebase) y no espera a la
  base real.
- `src/shared/` lo tocan los dos: cambios en PRs chicos a `main`; después cada quien hace
  `git rebase main` en su rama. Si cambian los tipos, `tsc` y `src/mocks/mockSource.test.ts` avisan.
- Los revisores por carpeta están en `.github/CODEOWNERS` (pon los usuarios de GitHub y quita el `#`).
- Punto de guardado antes de esta organización: tag `respaldo-antes-reestructura` (rama `respaldo-v0.2.1`).

## Cuentas (Firebase)

Para entrar a la app hay que registrarse e iniciar sesión.

1. **Registro:** el correo tiene que terminar en `@uanl.edu.mx` y la contraseña no puede quedar en
   blanco (mínimo 6 caracteres). Firebase Auth crea la cuenta y la app guarda `usuarios/{uid}` con el
   correo y la fecha. Firebase guarda la contraseña cifrada; Firestore nunca la ve.
2. **Inicio de sesión:** Firebase compara correo y contraseña con lo registrado, y la app comprueba
   que exista `usuarios/{uid}` con el mismo correo. Si falta, cierra la sesión.

`firestore.rules` vuelve a revisar el dominio del lado del servidor: una cuenta que no sea
`@uanl.edu.mx` no puede leer ni escribir nada. Para publicar cambios de las reglas:
`firebase.cmd deploy --only firestore:rules` (en PowerShell usa `firebase.cmd`).

| Colección | Qué guarda | Quién |
|---|---|---|
| `usuarios/{uid}` | `email`, `creadoEn` | Solo su dueño lee y crea; no se edita |
| `usuarios/{uid}/borrados/{productId}` | `vendedor` (0x…), `borradoEn` | Solo su dueño |

**Borrar producto:** solo lo ve quien publicó el producto. El contrato no puede borrar, así que la app
lo marca no disponible (`setAvailable(false)`, firma una vez; si ya estaba pausado no firma) y guarda
la marca de borrado: sale del catálogo y de «Mis productos».

**Mis ventas:** los montos solo cuentan pedidos **Completados** (el comprador confirmó que lo recibió):
vendido, número de ventas, piezas y promedio en los últimos 7 días, el mes, el año y desde el inicio,
más una gráfica de los últimos 6 meses y la lista de ventas. Los KPIs de la tienda (ingresos, ticket
promedio, compradores, horas y días pico, más vendidos) usan todos los pedidos recibidos y se pueden
copiar o descargar en JSON.

---

## Correr en tu computadora

Desde esta carpeta (`campuschain/`). Es un workspace de pnpm aparte del juego del curso. Si no tienes
pnpm instalado, antepone `corepack pnpm@12.6.0` a cada comando.

```bash
pnpm install --frozen-lockfile
pnpm test            # pruebas de la app, sin red
pnpm test:red        # lecturas contra el contrato desplegado
pnpm dev             # http://127.0.0.1:5173
pnpm dev --mode mock # datos de ejemplo, sin Host, red ni Firebase
pnpm build
```

El contrato se prueba aparte:

```bash
cd contrato
pnpm install --ignore-workspace
pnpm test        # 13 reglas del contrato
pnpm run size    # 11,253 de 24,576 bytes
pnpm abi         # vuelve a escribir src/contract/campuschain.abi.json si cambias el .sol
```

En el navegador ves el catálogo y los pedidos, pero **no puedes firmar**: firmar necesita el Host,
y el Host no se conecta a `localhost`. Para probar compras publica en tu `.dot` (abajo).

---

## 1. Tu dominio

Compra tu dominio en `dotns.dot` (capítulo 5, «Compra tu dominio .dot»): 9 caracteres o más,
`a-z`, `0-9` y `-`. Escríbelo en `PRODUCT_DOMAIN` de `src/contract/config.ts`. El del equipo es
`campuschain.dot`.

## 2. Publica

Desde `campuschain/`, igual que el [capítulo 6](../contenido/06-publicar.md#5-sube-app-e-icono).

Windows (PowerShell):

```powershell
function pad { $env:PAD_UPDATE_CHECK = '0'; pnpm dlx --ignore-scripts @polkadot-community-foundation/polkadot-app-deploy@0.22.1 @args }
pnpm build
$env:APP_DOT = 'tmp' + (-join ((Get-Date -Format 'yyyyMMddHHmmss').ToCharArray() | ForEach-Object { [char](97 + [int]"$_") })) + '.dot'
pad .\dist $env:APP_DOT --env devnet --js-merkle
```

macOS o Linux:

```bash
pad() { PAD_UPDATE_CHECK=0 pnpm dlx --ignore-scripts @polkadot-community-foundation/polkadot-app-deploy@0.22.1 "$@"; }
pnpm build
export APP_DOT="tmp$(date +%Y%m%d%H%M%S | tr '0-9' 'a-j').dot"
pad ./dist "$APP_DOT" --env devnet --js-merkle
```

Copia el `CID: bafy…` y el JSON de `Verified text[manifest]:`. En la Polkadot App abre
`dotns.dot` → Profile → My Domains → tu dominio:

- **Resolve**: pega el CID → Save → firma.
- **Edit** → Custom Records → `manifest`: el JSON → Save → firma. Solo cambia si cambia el icono, el
  nombre o la descripción; si ya existe, edítalo en vez de agregar otro.

Mientras tanto, la versión publicada se puede ver en `https://<nombre temporal>.dev-dot.li`.

Nunca le pases tu propio dominio a `pad`, solo el nombre temporal. Bulletin borra lo publicado a los
~14 días: vuelve a publicar antes. La versión que ves en **Cuenta** te dice qué build abrió el Host
(súbela en `package.json` en cada publicación).

---

## Guion de la demo (2–3 min)

Necesitas **dos dispositivos** con la Polkadot App (o uno con la App y otro con Desktop): cada
cuenta del Host es una persona. Antes de empezar: las dos cuentas conectadas, con los tres permisos
aceptados y **PAS del faucet** en su dirección SS58, y un **pedido de respaldo ya completado** por si
la red va lenta.

1. **Ana (vendedora)** → Vender → publica «Brownies», $35, Comida, Explanada. Firma.
2. **Carlos (comprador)** → Catálogo → ve los brownies y la reputación de Ana → Hacer pedido → firma.
3. Se abre el pedido: estado **Creado**, historial con quién firmó y la transacción.
4. **Ana** → Vender → el pedido aparece con «Te toca» → **Aceptar pedido**.
5. Carlos paga en efectivo (fuera de la app). **Ana** → **Declarar pago recibido**: «Pago reportado
   por vendedor», no «pago verificado».
6. **Ana** → **Marcar como entregado**.
7. **Carlos** → **Confirmar que lo recibí** → **Completado**.
8. Muestra el **historial**: cada paso con quién firmó, cuándo y enlace a Blockscout.
9. **Verificar hash**: «El hash coincide».
10. Abre el perfil de Ana: completados de aceptados y cancelados.
11. **Ana** → Mis ventas: saldos, KPIs y el JSON descargable.

---

## Lo que CampusChain no hace (dilo en el pitch)

- **No verifica pagos.** «Pago reportado» es una declaración firmada por el vendedor.
- **No verifica entregas físicas.** Por eso el pedido solo se completa cuando el comprador confirma.
- **No verifica que seas estudiante.** El registro solo revisa que el correo termine en
  `@uanl.edu.mx`; no hay integración con la universidad. En la cadena cada persona es la cuenta de la
  Polkadot App.
- **No elimina el fraude.** Aporta trazabilidad y un historial que nadie puede reescribir; la
  reputación es un indicador, no una garantía.
- **Todo lo que está en el contrato es público.** Por eso solo hay puntos generales del campus y
  direcciones; nunca correos, nombres completos ni teléfonos.
- **El contrato confía en el hash que manda la app.** Lo guarda sin recalcularlo. La verificación
  prueba que los datos no cambiaron desde que se creó el pedido, no que el hash se calculó bien.
- Sin escrow, reembolsos, disputas ni chat (fuera del MVP).

## Problemas conocidos

- **«Host rejected product account request: Domain → V1 → NotConnected»** al abrir
  `campuschain.dev-dot.li` en el navegador: no hay sesión de Polkadot iniciada en esa página. Inicia
  sesión ahí (se vincula con la Polkadot App del celular) o abre CampusChain desde la Polkadot App. El
  mensaje todavía sale en inglés; traducirlo va en `src/hub/` y `src/lib/txErrors.ts`.

## Pendiente de comprobar

- Firmar y releer dentro de la Polkadot App con este contrato (publicar, pedir y cada cambio de
  estado). Entrar y conectar la cuenta en `campuschain.dot` sí funciona.
- Que el SDK del Host decodifique las respuestas igual que viem (los decodificadores aceptan objeto y
  tupla; las lecturas van primero por ETH-RPC con viem).
- Si otra app del equipo crea pedidos con otra fórmula de hash, «Verificar hash» dirá que no
  coincide para esos pedidos.

Sí se comprobó contra el contrato desplegado: que el bytecode coincide con `contrato/CampusChain.sol`,
las lecturas de la app (`pnpm test:red`) y que el ETH-RPC devuelve eventos desde el bloque 0.
