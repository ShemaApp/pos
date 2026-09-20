# Inventario — PWA sin build

## Publicar en GitHub Pages
1. Crea un repositorio y sube todo el contenido de esta carpeta a la raíz (o a `/docs`).
2. En **Settings → Pages**, selecciona la rama y carpeta donde subiste los archivos.
3. Espera unos minutos y entra a la URL que GitHub te da (`https://usuario.github.io/repo/`).

No hay paso de compilación: todo corre directo en el navegador (React y Babel se cargan por CDN).

## Cómo funciona
- **Datos**: por defecto se guardan en IndexedDB, en el propio navegador/dispositivo — no hay
  backend ni cuenta, y no se sincronizan entre dispositivos ni navegadores distintos. Esto es
  opcional: ver "Integración con Firebase" más abajo para sincronizar entre dispositivos con
  Firestore en vez de IndexedDB, sin cambiar el resto de la app.
- **Escáner**: usa la cámara del dispositivo (requiere HTTPS, que GitHub Pages ya da por defecto).
- **Offline**: un Service Worker cachea la app para que abra sin internet; el escáner necesita
  conexión la primera vez que carga la librería de cámara.

## Estructura
- `index.html` — punto de entrada
- `js/db.js` — capa de datos (IndexedDB)
- `js/utils.js` — CSV y utilidades
- `js/Inventario.js` — módulo de inventario (productos)
- `js/Configuracion.js` — módulo de configuración (unidades de medida, categorías)
- `js/Clientes.js` — módulo de clientes (registro rápido/completo, historial, archivar)
- `js/Creditos.js` — módulo de créditos (siempre ligado a un cliente; abonos y liquidación)
- `js/Ventas.js` — punto de venta: carrito, cobro (efectivo primero), descuento de inventario
- `js/movimientos.js` — bitácora unificada: cada módulo registra ahí sus acciones
- `js/permisos.js` — catálogo de acciones (crear/editar/archivar/...) y dependencias entre módulos
- `js/auth.js` — modo local: hash de contraseñas (SHA-256 + salt) con Web Crypto; modo Firebase:
  Firebase Authentication real (correo sintético por usuario, ver "Multiempresa")
- `js/barcode.js` — generador de códigos EAN-13 internos, únicos y con dígito verificador válido
- `js/VoiceInput.js` — botón de dictado por voz reutilizable (Web Speech API)
- `js/Etiquetas.js` — impresión de etiquetas de código de barras (tamaño, columnas, cantidad)
- `js/firebase-config.js` — configuración de tu proyecto Firebase (placeholder por defecto)
- `firestore.rules` — reglas de seguridad de Firestore (ver sección "Integración con Firebase")

## Código de barras: generar, escanear, dictar e imprimir

- **Generar**: en "Agregar producto", el botón "🎲 Generar" crea un EAN-13 aleatorio con
  dígito verificador válido, usando el prefijo GS1 `20` (rango 200-299, reservado para uso
  interno de una empresa — así nunca choca con el código real de un producto de otra marca).
  Antes de entregarlo, revisa contra `productos.codigoBarras` en la base de datos y reintenta
  si por coincidencia ya existe (con 10 dígitos aleatorios, la probabilidad de eso es
  prácticamente cero, pero se valida igual).
- **Escanear**: el modal de cámara (usado en Inventario y Ventas) siempre tiene, además del
  lector automático, dos salidas: **"Cancelar"** y **"Escribir manualmente"** — esta última
  abre un campo de texto con un botón de micrófono al lado.
- **Dictar por voz**: el botón 🎤 aparece junto al código de barras y al nombre del producto
  (y dentro del modal de escaneo en modo manual) — solo si el navegador soporta reconocimiento
  de voz (Web Speech API; funciona bien en Chrome/Android, no en todos los navegadores — si no
  está disponible, el botón simplemente no aparece, no rompe nada). Como los motores de voz no
  siempre transcriben números dictados igual (algunos devuelven "7501234", otros "siete cinco
  cero uno..."), el código intenta extraer dígitos directos primero y, si no encuentra
  ninguno, traduce palabra por palabra ("siete" → 7) como respaldo. El texto reconocido queda
  en el campo para que lo revises/edites antes de guardar — nunca se guarda directo sin que lo
  veas.
- **Imprimir etiquetas**: desde Inventario, cada producto con código tiene un botón
  "Imprimir" individual, y el botón "🏷️ Imprimir etiquetas (visibles)" del toolbar imprime en
  lote todos los productos activos que estén en la lista filtrada actual. El motor de
  configuración de impresión deja elegir: tamaño de etiqueta (pequeña/mediana/grande, en mm),
  columnas por hoja, cantidad de copias por producto, y qué mostrar (nombre, precio, número
  debajo de las barras). Usa `window.print()` con una hoja de estilo `@media print` dedicada:
  al imprimir, solo salen las etiquetas — el resto de la pantalla queda oculto. Los productos
  sin código de barras se muestran en la lista pero no se pueden imprimir (primero necesitan
  uno, generado o escrito).
- `js/Reportes.js` — filtra/agrupa/exporta/importa los movimientos de todos los módulos
- `js/Empresa.js` — selección/registro de empresa (solo aplica con Firebase multiempresa)
- `js/Scanner.js` — modal de escaneo por cámara
- `js/App.js` — navegación entre módulos

## Reglas de Clientes/Créditos implementadas
- Cliente puede existir sin crédito. Crédito no puede existir sin cliente (el formulario de
  crédito exige seleccionar cliente).
- Archivar un cliente no lo elimina; eliminar tampoco borra sus créditos/abonos históricos
  (se conservan por `clienteId`, aunque el cliente pase a estado `eliminado`).
- El saldo de un crédito nunca se edita a mano: se calcula como
  `montoOriginal - suma(abonos)`. El campo `abonosTotal` se actualiza al registrar cada abono.
- Un crédito con saldo 0 pasa automáticamente a `liquidado`; con abonos parciales queda `parcial`.
- Un abono que supera el saldo pide confirmación explícita (saldo a favor) antes de registrarse.
- "Ver créditos" y "Nuevo crédito" desde la ficha de un cliente cambian a la pestaña Créditos
  con ese cliente ya preseleccionado/filtrado.

## Ventas
- Es independiente: una venta puede completarse sin cliente ("Público general"). Solo si el
  método de pago es Crédito se exige seleccionar un cliente — ahí mismo se puede buscar uno
  existente o dar de alta uno rápido sin salir de la venta.
- Métodos de pago: Efectivo aparece primero y es la opción por defecto al abrir el cobro;
  después Tarjeta, Transferencia y Crédito.
- Cada venta descuenta existencia de Inventario por cada línea (si la existencia no alcanza,
  pide confirmación explícita antes de dejarla en negativo, igual que con abonos sobre saldo).
- Se registra quién creó la venta (campo "Cajero", capturado una vez en el módulo y reutilizado
  en cada venta — se guarda en localStorage del dispositivo) y, cuando el pago es a crédito,
  quién autorizó el fiado (se captura en el momento del cobro).
- Una venta a crédito genera automáticamente un Crédito enlazado (mismo comportamiento que
  crear uno manualmente desde el módulo Créditos), con `ventaId` de referencia.
- Cancelar una venta restituye el inventario y cancela el crédito asociado — pero se bloquea si
  ese crédito ya tiene abonos registrados, para no perder historial de pagos reales.
- "Cajero" (quién creó la venta) y "quién autorizó el fiado" siguen siendo campos de texto
  libre en el momento de la venta — no se validan contra la lista de Usuarios de Configuración.
  Es una simplificación deliberada: forzar a elegir de esa lista habría acoplado Ventas a que
  Usuarios esté siempre poblado y activo.

## Módulos, roles y usuarios (Configuración)
- **Módulos on/off**: en Configuración → Módulos, cada módulo (Ventas, Inventario, Clientes,
  Créditos, Reportes) tiene un interruptor. Configuración misma no se puede apagar. Los
  dependientes se activan/desactivan en cascada: apagar Clientes apaga Créditos automáticamente
  (con confirmación); encender Créditos enciende Clientes si estaba apagado.
- **Roles**: cada rol tiene una matriz de permisos por módulo × acción
  (`consultar, crear, editar, archivar, restaurar, eliminar, importar, exportar` — el set
  canónico en el que consolidé verbos como agregar/crear, borrar/eliminar, actualizar/editar).
  El rol **Administrador** se crea automáticamente con todos los permisos, está marcado como
  "Sistema" y no se puede editar ni eliminar desde la interfaz, para evitar quedarse sin acceso
  por accidente.
- **Usuarios**: cada usuario tiene un nombre y un rol. **En modo local (IndexedDB)**, al iniciar
  la app por primera vez se crea el usuario `admin` con rol Administrador. **En modo Firebase
  multiempresa**, no hay ningún usuario semilla genérico: quien registra una empresa nueva crea
  ahí mismo su propio usuario administrador, con el nombre y contraseña que elija (ver
  "Multiempresa" más abajo). En ambos modos, cada usuario tiene su propia contraseña (ver la
  guía dedicada más abajo). Al
  abrir la app se pide elegir el usuario de una lista, y desde ahí en adelante solo se muestran
  las pestañas y botones que el rol de ese usuario permite. "Cambiar usuario" está en el header.
- Cada pestaña se muestra solo si el módulo está encendido **y** el rol tiene `consultar` en
  ese módulo. Dentro de cada módulo, los botones de acción (Agregar, Editar, Archivar,
  Restaurar, Eliminar, Importar, Exportar, Cobrar, Registrar abono, Cancelar) están gateados
  por el permiso correspondiente.

## Contraseñas y creación de usuarios (guía)

**Cómo funciona el acceso:**
1. Al abrir la app, se muestra la lista de usuarios activos. Tocas tu nombre.
2. Si es la **primera vez** que entras (tu cuenta no tiene contraseña todavía), la app te pide
   crearla ahí mismo: nueva contraseña + confirmar (mínimo 6 caracteres). Nadie más la ve ni la
   define por ti, ni siquiera el administrador que te dio de alta.
3. Si tu cuenta **ya tiene** contraseña, se te pide ingresarla. Si es incorrecta, no entras.
4. Una vez dentro, la sesión queda activa en ese dispositivo hasta que toques "Cambiar usuario"
   en la esquina superior (eso cierra la sesión y vuelve a pedir contraseña la próxima vez).
5. Puedes cambiar tu propia contraseña en cualquier momento con el botón "Cambiar contraseña"
   del encabezado (pide tu contraseña actual + la nueva dos veces).

**Cómo se crean los usuarios (solo quien tenga permiso `crear` en Configuración):**
1. Ve a la pestaña **Configuración** → sección **Usuarios** → **+ Nuevo usuario**.
2. Escribe el **nombre** (así aparecerá en la lista de acceso) y elige su **rol**
   (por ejemplo, "Administrador" o uno que hayas creado en la sección Roles con permisos más
   limitados — ver la sección de arriba sobre roles y permisos).
3. Guarda. El usuario queda creado **sin contraseña** — no se la asignas tú.
4. Dile a esa persona que abra la app, elija su nombre en la pantalla de acceso, y cree su
   propia contraseña la primera vez que entre (paso 2 de "Cómo funciona el acceso").
5. Si alguien olvida su contraseña: **en modo local (IndexedDB)**, en Usuarios, junto a su
   nombre, usa **"Restablecer contraseña"** — borra la contraseña guardada, y la persona crea
   una nueva la próxima vez que entra. **En modo Firebase**, esto ya no es posible desde el
   cliente (Firebase Auth no deja forzar la contraseña de otra cuenta) — la opción es archivar
   su acceso y darle de alta con un nombre nuevo. Ver el detalle en "Multiempresa" más abajo.
6. Para quitarle el acceso a alguien sin borrar su historial de acciones, usa **Archivar** en
   vez de Eliminar — un usuario archivado ya no aparece en la lista de acceso.

**El usuario inicial `admin`:** en **modo local**, se crea automáticamente la primera vez que
se usa la app, con rol Administrador y sin contraseña — la primera persona que abra la app y
toque "admin" define esa contraseña. **En modo Firebase**, no hay usuario semilla: quien
registra una empresa nueva crea ahí mismo su propio usuario administrador (ver "Multiempresa").

**Qué tan segura es esta contraseña:**
- **Modo local (IndexedDB)**: nunca se guarda en texto plano — se guarda un hash SHA-256 con
  una "sal" aleatoria por usuario, calculado con la API Web Crypto del navegador. Es una
  barrera de acceso local (evita que alguien entre por error o sin autorización tocando la
  pantalla), no un sistema de nivel servidor: como toda la app vive en el navegador sin
  backend, alguien con acceso a las herramientas de desarrollador del mismo dispositivo podría,
  en teoría, inspeccionar o borrar los datos guardados en IndexedDB.
- **Modo Firebase**: la contraseña la verifica el servidor de Firebase Authentication de
  verdad, no una comparación en el navegador — ver el detalle completo en "Multiempresa" más
  abajo, incluyendo qué sí y qué no protege esto.

## Integración con Firebase

La app puede correr en dos modos, controlados por un solo interruptor en
`js/firebase-config.js`:

- **Local (por defecto)**: `FIREBASE_HABILITADO = false`. Todo vive en IndexedDB del
  navegador, sin cuenta ni conexión, una sola "empresa" implícita — como hasta ahora.
- **Firebase, multiempresa**: `FIREBASE_HABILITADO = true`. Los datos viven en Firestore,
  sincronizados entre dispositivos, y **cada empresa que se registre queda completamente
  separada de las demás** (ver la sección "Multiempresa" más abajo).

Ningún otro archivo de la app sabe cuál de los dos está activo: `js/db.js` implementa **la
misma interfaz** (`add`, `put`, `get`, `getAll`, `getByIndex`, `getAllByIndex`, `delete`) para
ambos backends, así que Inventario, Clientes, Créditos, Ventas, Reportes y Configuración
funcionan sin cambios en cualquiera de los dos modos.

### Pasos para activar Firebase

1. **Crea un proyecto** en [console.firebase.google.com](https://console.firebase.google.com)
   (o usa uno existente).
2. **Agrega una app web**: ⚙️ Configuración del proyecto → pestaña "General" → "Tus apps" →
   ícono `</>`. Copia el objeto `firebaseConfig` que te muestra.
3. **Pégalo en `js/firebase-config.js`**, reemplazando los valores de ejemplo por los tuyos.
   No lo dejes en `FIREBASE_HABILITADO = true` todavía.
4. **Crea la base de datos**: menú lateral → "Firestore Database" → "Crear base de datos" →
   modo producción → elige la región más cercana.
5. **Activa los dos métodos de acceso**: menú lateral → "Authentication" → "Get started" →
   pestaña "Sign-in method" → habilita **"Anonymous"** (necesario para poder buscar empresas
   por correo antes de iniciar sesión) **y también "Email/Password"** (es lo que usa el sistema
   de usuarios internos por debajo — ver "Multiempresa" más abajo para el detalle de cómo).
6. **Publica las reglas de seguridad**: abre `firestore.rules` (en la raíz del proyecto),
   cópialo completo, y pégalo en Firestore Database → pestaña "Reglas" → "Publicar". **Léelo
   completo antes de publicarlo** — el archivo explica en detalle qué protege y, más
   importante, qué NO protege (ver también el resumen en "Multiempresa" abajo).
7. **Activa el interruptor**: en `js/firebase-config.js`, cambia `FIREBASE_HABILITADO` a
   `true`.
8. **Prueba antes de repartir el enlace**: abre la app y confirma que puedes registrar una
   empresa de prueba y entrar. Si algo falló en un paso anterior, verás errores de Firebase en
   la consola del navegador (F12).

### Qué cambia al usar Firebase

- **Multi-dispositivo y multiempresa**: ver la sección dedicada abajo.
- **Actualización en tiempo real**: esta versión sigue leyendo con `getAll()` al entrar a cada
  pantalla, no con listeners en vivo — si alguien más registra una venta, no la verás hasta
  que vuelvas a esa pantalla o refresques. Los `onSnapshot` de Firestore quedan fuera de este
  alcance, pero son un siguiente paso natural si te interesa.
- **IDs**: dentro de una empresa, siguen siendo números consecutivos (1, 2, 3...) igual que en
  IndexedDB — así ningún `Number(...)` existente en la app se rompe. El ID de la EMPRESA misma
  es distinto: un string aleatorio largo de Firestore, a propósito, para que no se pueda
  encontrar otras empresas probando `empresas/1`, `empresas/2`...
- **Unicidad** (código de barras, nombres de unidad/categoría/rol/usuario): se exige DENTRO de
  cada empresa, no globalmente — dos empresas distintas pueden usar el mismo código de barras
  sin chocar entre sí.
- **Contraseñas verificadas por Firebase, no por el navegador**: ver "Multiempresa" abajo.

### Qué NO incluye esto todavía (por si lo necesitas después)
- **Migrar datos ya guardados localmente a Firestore**: si ya usaste la versión IndexedDB y
  tienes productos/clientes/ventas reales, activar Firebase empieza desde cero (tendrás que
  registrar tu empresa y volver a cargar tus datos, o pedirme un script de migración una sola
  vez).
- **Reglas de Firestore que respeten los permisos por rol**: las reglas publicadas confirman
  que sabes una contraseña real de la empresa, pero dentro de una misma empresa no distinguen
  "tu rol te deja hacer esto" a nivel de base de datos — eso lo sigue decidiendo solo la app en
  el navegador, igual que en la versión de una sola empresa.
- **Actualización en tiempo real** (`onSnapshot`).
- **Recuperar contraseña olvidada por correo real**: ver el detalle en "Multiempresa" abajo.

## Multiempresa (una app, varias empresas separadas)

Con Firebase activado, cualquier persona puede registrar su propia empresa y esta queda
completamente aislada de las demás que usen la misma app.

### Cómo funciona, paso a paso
1. Al abrir la app (sin una empresa guardada en este dispositivo), se pide el **correo de tu
   empresa**.
2. Si ese correo ya está registrado, se pasa directo a la pantalla de siempre para elegir tu
   usuario dentro de esa empresa.
3. Si no existe, se ofrece **registrar la empresa ahí mismo**: nombre de la empresa, su
   correo, y tu propio nombre de usuario + contraseña — quedas como su primer administrador
   (con el rol "Administrador", todos los permisos). Desde Configuración → Usuarios puedes dar
   de alta al resto de tu equipo, exactamente igual que en la versión de una sola empresa.
4. El dispositivo recuerda qué empresa elegiste (no hay que volver a escribir el correo cada
   vez) — "Cambiar empresa" en el encabezado la olvida y vuelve al paso 1. "Cambiar usuario"
   solo suelta tu sesión pero se queda en la misma empresa.

### Aislamiento de datos
Cada empresa vive en su propia rama de Firestore
(`empresas/{empresaId}/productos`, `.../clientes`, `.../ventas`, etc.) — no es un filtro que la
app aplica al leer, es una separación estructural: una consulta `getAll()` de la empresa A
JAMÁS puede devolver un documento de la empresa B, ni por accidente ni por un bug de la app,
porque literalmente viven en rutas distintas. Lo probé creando dos empresas de prueba,
cargando datos en ambas, y confirmando que ninguna ve nada de la otra (incluyendo que ambas
pueden usar el mismo código de barras sin chocar entre sí, porque la unicidad también es por
empresa).

### Contraseñas verificadas de verdad por Firebase (no por el navegador)
Cada usuario interno tiene una cuenta REAL de Firebase Authentication por debajo — cuando creas
tu contraseña o inicias sesión, quien la verifica es el servidor de Firebase, no una
comparación de hashes en tu navegador. Firebase Auth exige un correo como identificador, y como
tus usuarios internos se identifican por nombre (no correo), la app genera uno "sintético" por
debajo (combina el ID de tu empresa + tu nombre de usuario) que nunca se muestra ni se usa para
enviar nada — es solo la llave interna con la que Firebase reconoce tu cuenta.

Esto es lo que de verdad protege una empresa de que alguien se "autorice" en ella sin saber
ninguna contraseña real: `firestore.rules` exige que el documento de autorización de cada quien
solo se pueda crear si tu sesión está *autenticada con contraseña* (no una sesión anónima
cualquiera) — y eso, Firebase lo certifica en su propio token de sesión, algo que ningún
cliente puede falsificar. Antes de este cambio, cualquiera que conociera el ID de una empresa
podía crearse ese documento sin saber ninguna contraseña; ahora hace falta pasar una
verificación real de Firebase primero.

**Lo que esto SÍ sigue sin resolver**: dentro de una misma empresa, las reglas no distinguen
"tu rol te deja hacer esto" — solo confirman que tienes una cuenta válida de esa empresa. Un
usuario con un rol limitado que decida saltarse la interfaz de la app y hablarle directo a
Firestore podría, en teoría, leer o escribir cosas que su rol no le permite dentro de su
propia empresa. Cerrar eso del todo necesitaría validar permisos por rol también en las reglas,
o una Cloud Function — avísame si llegas a necesitarlo.

**Restablecer contraseña**: con Firebase Auth real, un administrador ya NO puede forzar el
restablecimiento de la contraseña de otra persona (antes sí, borrando el hash guardado) —
Firebase no deja hacer eso desde el cliente por nadie más que el propio dueño de la cuenta.
Si alguien olvida su contraseña, la única opción hoy es que un administrador la **archive** y
la persona reciba una cuenta nueva (con un nombre distinto, ya que el nombre anterior sigue
"ocupado" por Firebase Auth aunque el usuario esté archivado). Una recuperación real por correo
(`sendPasswordResetEmail`) necesitaría correos reales por persona en vez de los sintéticos —
posible como siguiente paso si te interesa.

## Diseño responsive (PC y móvil)

- **Encabezado fijo** (`position: sticky`): las pestañas quedan siempre a la vista al hacer
  scroll en listas largas, en cualquier tamaño de pantalla.
- **Pestañas deslizables**: en pantallas angostas, la fila de pestañas (Ventas, Inventario,
  Clientes, Créditos, Reportes, Configuración) se desliza horizontalmente en vez de encimarse
  o partirse en dos líneas.
- **Tablas con scroll propio**: cada tabla vive dentro de un contenedor (`.table-scroll`) que
  se desplaza horizontalmente si la pantalla es más angosta que sus columnas, en vez de
  comprimir el texto hasta hacerlo ilegible.
- **Modales adaptados a móvil**: por debajo de 560px de ancho, los modales se comportan como
  una "hoja" que sube desde abajo (patrón nativo de iOS/Android) y con scroll propio si el
  contenido es más alto que la pantalla — antes un formulario largo (la matriz de permisos de
  Roles, por ejemplo) podía salirse de la pantalla sin forma de llegar al botón "Guardar"; ya
  no.
- **Cuadrículas fluidas**: los filtros de Reportes y los paneles de resumen (créditos,
  ventas) se acomodan solos según el espacio disponible (`auto-fit`) en vez de saltar
  bruscamente entre "3 columnas" y "1 columna" en un único punto de quiebre.
- **Blancos de toque más grandes** en móvil: botones y campos con al menos ~40-44px de alto,
  siguiendo la guía de accesibilidad táctil de iOS/Android.
- **Zoom permitido**: se quitó el bloqueo de pinch-zoom (`maximum-scale=1`) del viewport —
  bloquear el zoom perjudica a personas con baja visión; ahora se permite hasta 5x.
- Dos puntos de quiebre: 768px (ajustes finos de espaciado) y 560px (apilado de encabezados,
  modales tipo hoja, botones de acción a ancho completo). Las cuadrículas fluidas reducen la
  necesidad de más puntos de quiebre manuales.

## Pendiente / decisiones tomadas
- Las categorías (Inventario) se implementaron como catálogo independiente, igual que unidades
  de medida, aunque el brief solo lo pedía explícitamente para unidades.
- Los íconos en `icons/` son placeholders simples — reemplázalos cuando tengas el logo real.
- Reportes registra movimientos de Inventario, Clientes, Créditos y Ventas (crear/editar/
  archivar/restaurar/eliminar/cambiar código, abonos, liquidaciones, cancelaciones,
  importaciones, altas de venta) y también de Configuración (módulos, roles, usuarios). Los
  cambios en los catálogos de Unidades/Categorías no se registran como movimiento, por ser
  administración de catálogo y no un evento de negocio.
- Reportes agrupa por día/semana/mes/año, o por "rango seleccionado" cuando se elige un
  desde/hasta manual (sin subdividir). Filtra por módulo, tipo y fecha; exporta e importa el
  log completo en CSV, útil para respaldar o fusionar movimientos entre dispositivos ya que
  IndexedDB no sincroniza entre navegadores.
- Los permisos gatean qué botones se muestran en la lista de cada módulo, pero el formulario de
  edición en sí (por ejemplo, hacer clic en el nombre de un producto) no vuelve a revalidar el
  permiso `editar` internamente. Es una limitación conocida: alguien sin permiso de edición no
  ve el botón "Editar", pero si llega al formulario por otra vía sí podría guardar cambios. Para
  un control más estricto habría que revalidar permisos también dentro de cada formulario.
- Cada usuario tiene contraseña propia (hash SHA-256 + salt, ver la guía de arriba). Sigue sin
  ser un sistema de seguridad de servidor — es una barrera de acceso local, ver el detalle en
  esa misma sección.
- Impresión de etiquetas: la gateé bajo el permiso `exportar` (no `crear`/`editar`), porque no
  modifica datos, es solo salida — igual que exportar CSV.
- Si un `codigoBarras` no tiene 13 dígitos con checksum válido (por ejemplo, viene de un
  escaneo real de un producto con UPC-A de 12 dígitos u otro estándar), el motor de impresión
  lo dibuja igual como CODE128 en vez de EAN13 — ese formato acepta cualquier texto/número, así
  que ningún código queda sin poder imprimirse por su formato.
- El reconocimiento de voz, la cámara y la impresión son APIs exclusivas del navegador — no se
  pueden probar en un entorno de servidor. Validé la lógica alrededor de ellas (extracción de
  dígitos, generación del EAN-13, que la app no truene si el navegador no las soporta) con
  simulaciones, pero la prueba real en tu dispositivo/navegador de destino sigue siendo
  necesaria antes de repartir la app al equipo.
