# CampusChain

Marketplace universitario con **historial de pedidos verificable** en Polkadot. Corre como mini app
dentro de la Polkadot App y Polkadot Desktop, en su propio dominio `.dot`.

Las estudiantes y los estudiantes publican productos, hacen pedidos y pagan como siempre (efectivo
o transferencia). El contrato `CampusChain.sol` registra **quién declaró cada paso y cuándo**:
pedido creado, aceptado, pago reportado por el vendedor, entrega declarada y recepción confirmada por
el comprador. Con eso se calcula una reputación que nadie puede editar a mano.

> **CampusChain convierte el comercio informal universitario en una experiencia más confiable
> mediante identidad, reputación e historial de pedidos verificable.**

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
  lee `productCount` y después `getProduct` de cada uno (hasta 300).
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
| Backend Node + Firebase/MongoDB | **Todo on-chain**: catálogo, pedidos, historial y reputación en el contrato | La app es un bundle estático en Bulletin; su único origen de red es el ETH-RPC del devnet |
| `orderId` y `orderHash` del backend | Los genera la app del comprador y el contrato los guarda | Sin backend no hay quién genere ids |
| Polkadot Hub EVM TestNet + Hardhat | **Products Devnet** (chainId 420420417), REVM, `solc` 0.8.28, desplegado con **Remix** | La red y las herramientas del curso |
| Login con correo institucional | La cuenta del Host; se muestra la dirección | El contrato no tiene alias ni verificación de estudiantes |
| Asistente IA | Fuera del MVP | Una API key quedaría pública en el bundle y la app no puede llamar a servicios externos |

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
| `src/ui/` | Pantallas: Entrar/Registro, Catálogo, Producto, Mis pedidos, Pedido, Vender, Mis ventas, Vendedor y Cuenta |
| `src/firebase/` | Registro e inicio de sesión (Firebase Auth) y productos borrados (Firestore) |
| `firestore.rules`, `firebase.json`, `.firebaserc` | Reglas de la base y proyecto `campuschain-1e093` |
| `polkadot-app-deploy.config.mjs` | Nombre, descripción e icono para publicar |
| `assets/icono.png` | Icono 512 × 512 |

---

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

**Mis ventas (📈):** solo cuenta pedidos **Completados** (el comprador confirmó que lo recibió):
vendido, número de ventas, piezas y promedio en los últimos 7 días, el mes, el año y desde el inicio,
más una gráfica de los últimos 6 meses y la lista de ventas.

---

## Correr en tu computadora

Desde esta carpeta (`campuschain/`). Es un workspace de pnpm aparte del juego del curso.

```bash
pnpm install
pnpm test        # 40 pruebas de la app, sin red
pnpm test:red    # 5 lecturas contra el contrato desplegado
pnpm dev         # http://127.0.0.1:5173
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
y el Host no se conecta a `localhost`. Para probar compras publicas en tu `.dot` (abajo).

---

## 1. Tu dominio

Compra tu dominio en `dotns.dot` (capítulo 5, «Compra tu dominio .dot»): 9 caracteres o más,
`a-z`, `0-9` y `-`. Escríbelo en `PRODUCT_DOMAIN` de `src/contract/config.ts`.

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
- **Edit** → Custom Records → Add Record: key `manifest`, value el JSON → Save → firma.

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
9. **Verificar hash**: «✓ El hash coincide».
10. Abre el perfil de Ana: completados de aceptados y cancelados.

---

## Lo que CampusChain no hace (dilo en el pitch)

- **No verifica pagos.** «Pago reportado» es una declaración firmada por el vendedor.
- **No verifica entregas físicas.** Por eso el pedido solo se completa cuando el comprador confirma.
- **No verifica que seas estudiante.** Cada persona es la cuenta de la Polkadot App; no hay
  integración con la universidad.
- **No elimina el fraude.** Aporta trazabilidad y un historial que nadie puede reescribir; la
  reputación es un indicador, no una garantía.
- **Todo lo que está en el contrato es público.** Por eso solo hay puntos generales del campus y
  direcciones; nunca correos, nombres completos ni teléfonos.
- **El contrato confía en el hash que manda la app.** Lo guarda sin recalcularlo. La verificación
  prueba que los datos no cambiaron desde que se creó el pedido, no que el hash se calculó bien.
- Sin escrow, reembolsos, disputas ni chat (fuera del MVP).

## Pendiente de comprobar

Lo siguiente no se ha probado todavía en un Host real con este contrato:

- Conectar, firmar y releer dentro de la Polkadot App (el código es el del juego del curso,
  comprobado en `polka-man.dot`, generalizado a varias funciones).
- Que el SDK del Host decodifique las respuestas igual que viem (los decodificadores aceptan objeto y
  tupla; las lecturas van primero por ETH-RPC con viem).
- Si otra app del equipo crea pedidos con otra fórmula de hash, «Verificar hash» dirá que no
  coincide para esos pedidos.

Sí se comprobó contra el contrato desplegado: que el bytecode coincide con `contrato/CampusChain.sol`,
las lecturas de la app (`pnpm test:red`) y que el ETH-RPC devuelve eventos desde el bloque 0.
