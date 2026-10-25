# App Frontend — Smart Inventory Platform

<p align="center"><img src="assets/brand/logo_con_texto/logo_horizontal_color.png" alt="Smart Inventory" width="360"></p>

[![codecov](https://codecov.io/gh/Smart-Inventory-App/App_Frontend/branch/main/graph/badge.svg?token=D7VKX0SD3X)](https://codecov.io/gh/Smart-Inventory-App/App_Frontend)

React Native + Expo (web/iOS/Android) **Frontend** para la app de Smart Inventory Platform.

---

## Requisitos

- **Node.js 18+**
- **npm**
- **Backend corriendo** en `http://localhost:8000` (ver `App_backend/README.md`)

---

## Setup local

### 1. Instalar dependencias

```bash
cd App_Frontend
npm install --legacy-peer-deps
```

### 2. Crear `.env`

Copiar `.env.example` y completar con las URLs de los servicios (backend local + Auth/image storage):

```bash
cp .env.example .env
```

### 3. Levantar el frontend

```bash
npx expo start --web
```

Se abre en: http://localhost:8081

---

## Levantar todo para desarrollo local

En total se necesitan **3 terminales WSL** (además del frontend):

| Terminal | Directorio | Comando |
|----------|-----------|---------|
| 1 | `App_backend` | `docker-compose up -d db` — Postgres |
| 2 | `App_backend` | `source venv/bin/activate && python main.py` — Backend FastAPI |
| 3 | `App_Frontend` | `npx expo start --web` — Frontend Expo |

> Si hay migraciones nuevas, correr `alembic upgrade head` (con venv activado) antes de levantar el backend.

> El login/registro pegan contra el servicio `Auth` (`EXPO_PUBLIC_AUTH_URL`). Para que el backend local valide esos tokens, su `JWT_SECRET` debe coincidir con el del servicio `Auth`.

> Si el backend devuelve 401, el JWT expiró. Hacer logout/login en la app.

---

## Estructura del proyecto

```
App_Frontend/
├── app/                         # Rutas (Expo Router file-based)
│   ├── _layout.tsx             # Layout raíz con AuthProvider
│   ├── (auth)/                 # Pantallas sin tab bar
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── ...
│   └── (tabs)/                 # Pantallas con tab bar
│       ├── _layout.tsx         # Tab bar config
│       ├── index.tsx           # Home — estado del inventario, últimos cambios y productos recientes
│       ├── inventario.tsx      # Lista paginada de productos con filtros y orden
│       ├── cargar.tsx          # Entrada y salida de productos
│       ├── alertas.tsx         # Centro de Alertas
│       └── perfil.tsx          # Perfil y configuración
├── src/
│   ├── components/
│   │   ├── ProductFormFields.tsx  # Formulario reutilizable de producto
│   │   ├── ProductDetailModal.tsx # Ventana «Información del Producto»
│   │   ├── StockTotalModal.tsx    # Pantalla «Stock total de producto»
│   │   ├── ProductLotRow.tsx      # Fila de un producto (home y stock total)
│   │   ├── RecentChangeRow.tsx    # Fila de un cambio de stock
│   │   ├── ChangesHistoryModal.tsx# Historial de cambios (con «Cargar más»)
│   │   ├── DynamicAlert.tsx       # Lista de alertas
│   │   ├── AlertDetailModal.tsx   # Ventana «Detalle de Alerta»
│   │   ├── ExistingProductModal.tsx # Ingresar producto existente / elegir producto en una salida
│   │   ├── ScanModal.tsx          # Escaneo de etiqueta, comprobante, vencimiento y código
│   │   ├── ScreenHeader.tsx       # Banner superior (ícono de inicio + título)
│   │   ├── HomeHeader.tsx         # Banner del home (logo, saludo y estado)
│   │   ├── BottomSheetModal.tsx   # Hoja inferior que respeta los botones del sistema
│   │   ├── KeyboardAwareScrollView.tsx # Muestra el campo enfocado sobre el teclado
│   │   ├── ImageViewerModal.tsx   # Imagen a pantalla completa, con zoom de pellizco
│   │   ├── ImageConfirmModal.tsx  # Confirmación antes de cargar una imagen
│   │   ├── ProductInfoCard.tsx    # Tarjeta con categoría, marca, stock y vencimiento del producto elegido
│   │   ├── NumberStepper.tsx      # Campo numérico con botones de subir y bajar
│   │   ├── ConfirmModal.tsx       # Confirmar / cancelar (botón rojo o del color de la app)
│   │   ├── NoticeModal.tsx        # Aviso con un solo botón «Continuar»
│   │   ├── SuccessCheck.tsx       # Tilde de «¡Listo!» con animación de pop
│   │   ├── FixedTabBanner.tsx     # Banner quieto durante el deslizamiento entre pestañas
│   │   ├── ProductItem.tsx
│   │   └── StatCard.tsx
│   ├── constants/
│   │   └── colors.ts
│   ├── context/
│   │   └── AuthContext.tsx     # Token JWT (servicio Auth) — login/logout
│   ├── utils/                  # numbers (puntos de miles), alertInfo, datetime (hora argentina),
│   │                           # selectedFirst, exitReasons, welcomeState, dateInput, zoom,
│   │                           # profileLimits (límites del perfil), tabTransition (deslizamiento de pestañas)
│   ├── i18n/
│   │   ├── index.ts            # Configuración i18next
│   │   └── locales/
│   │       ├── es.ts           # Español (default)
│   │       └── en.ts           # English
│   ├── services/
│   │   ├── api.ts              # Axios instance con interceptor Bearer token
│   │   ├── authService.ts      # Login, register, recuperación de contraseña
│   │   ├── productService.ts   # Productos: listado paginado, stock total, cambios de stock
│   │   ├── alertService.ts     # Alertas y resumen
│   │   ├── imageService.ts     # Elegir una imagen y subirla (dos pasos)
│   │   ├── notificationPermission.ts # Permiso de notificaciones del teléfono
│   │   └── profileService.ts   # Perfil de usuario (get/update) y notificaciones
│   └── types/
│       └── product.ts          # Tipos Product, ProductCreate
├── .env                        # No se commitea
├── package.json
└── tsconfig.json
```

---

## Comandos útiles

```bash
# Iniciar (web)
npx expo start --web

# Limpiar caché de Metro
npx expo start --clear

# Abrir en dispositivo (con Expo Go)
npx expo start        # luego escanear el QR

# Tests
npm test
npm test -- --coverage
```

La suite tiene **más de 1.100 tests**, con ~96 % de cobertura de líneas, ~95 % de statements y ~89 % de ramas (el CI exige 90 % en líneas y statements). Los tests de pantallas mockean los servicios y `expo-router`; las listas largas se verifican por los datos que reciben, porque en los tests la lista solo dibuja las primeras entradas.

---

## Pantallas

**Cambio de pestaña.** Al tocar una pestaña de la barra inferior, el ícono de inicio del banner o una de las tarjetas del home, la pantalla se desliza hacia el lado en el que está la pestaña elegida (si queda a la derecha, la pantalla nueva entra por la derecha; si queda a la izquierda, por la izquierda). La animación está en `src/utils/tabTransition.ts` y se aplica en `app/(tabs)/_layout.tsx`. El banner de Inventario, Cargar, Alertas y Perfil queda fijo al cambiar entre ellas (el título cambia sin animación); solo se desliza junto con su pantalla cuando el cambio es desde o hacia Inicio. «Ver inventario», en la pantalla de producto cargado, cambia de pestaña sin deslizar (`skipNextTabAnimation`), y el tilde de esa pantalla aparece con una animación de «pop» (`src/components/SuccessCheck.tsx`). Las ventanas de Historial de Cambios y de Stock total de producto no usan esta animación.

**Home.** Banner con el logo y un saludo en dos renglones («Bienvenido, <nombre>» y «Tu estado»). Se usa siempre el nombre de la persona, nunca su usuario (sin nombre cargado, solo se ve el saludo); el nombre se corta a 20 caracteres. Debajo, las tarjetas del inventario (cada una lleva a su pantalla), **Últimos Cambios** (los 5 más recientes, con el motivo arriba de cada entrada, stock antes y después, y fecha y hora argentinas) y **Productos Recientes** (los 3 últimos cargados, con su fecha de carga arriba y un alto que se ajusta a los campos que tiene cada uno). Los números usan puntos de miles y se achican para entrar en su tarjeta. «Ver más» abre el **Historial de Cambios**, paginado con «Cargar más».

**Inventario.**
- **Lista paginada:** muestra los primeros 20 productos con los filtros elegidos y, debajo, «Cargar más» suma 10 por vez; al cambiar un filtro, la búsqueda o el orden vuelve a empezar. Se apoya en `limit` y `offset` de `GET /products/`.
- **Todo se desliza bajo el banner:** el botón de stock total, la búsqueda, el orden (con «Ordenar:» sobre los cuatro botones) y los filtros forman parte de la lista, así que al hacer scroll solo queda fijo el banner «Inventario». Las entradas son un poco más compactas que en el resto de las listas.
- **Orden y filtros:** el orden por nombre es alfabético (sin mayúsculas ni tildes) y por vencimiento no aparecen los productos sin fecha. Los filtros por categoría y ubicación se eligen con un buscador y el elegido va primero.
- **Información del producto:** tocar un producto abre «Información del Producto», con un acceso a su **Stock total**.
- **Stock total de producto:** pantalla completa donde se busca un producto por nombre y se ve la suma del stock de todos los que tienen el mismo nombre y categoría (de cualquier marca). El nombre y el resumen quedan fijos, solo se desplaza el listado de «Productos encontrados», y cada producto tiene una casilla para incluirlo o no en el total.

**Cargar.** Entrada (alta manual, producto existente y escaneo de etiqueta o comprobante, con cámaras para el vencimiento y el código de barras) y Salida (motivos Vendido, Consumido, Vencido y Alquilado en una fila que se desliza hacia los costados, sin ninguno elegido al empezar: el elegido pasa al inicio y vuelve a su lugar al deseleccionarlo; escaneo de comprobante; al elegir un producto se muestra solo su nombre y debajo una tarjeta con categoría, marca, stock actual y vencimiento). **Los campos empiezan siempre vacíos**: no se completan con la categoría o la ubicación de la acción anterior.

**Alertas.** El resumen cuenta las alertas críticas, las advertencias y las informativas; los filtros son Todas, Críticas, Stocks y Vencidos. Al volver a la pantalla siempre vuelve a «Todas». Cada entrada tiene un alto fijo (título y detalle de hasta dos renglones) y al tocarla se abre **«Detalle de Alerta»**: imagen, nombre, categoría, el motivo con el color de su nivel y su información, marca, stock y vencimiento (si tiene). Los datos vienen de `GET /alerts/*`.

**Perfil.** Todo se muestra como texto: datos personales, tipo de cuenta (una caja resaltada) y la configuración de alertas (días de stock, días por vencer y hora del chequeo, en **hora Argentina, UTC-3**). El lápiz del avatar abre el modo edición, donde se cambian nombre, apellido, usuario, tipo de cuenta y esos tres valores, con **Guardar y Cancelar debajo de todo**; mientras se edita no aparecen Idioma, Notificaciones ni Cerrar sesión. Cambiar de idioma pide confirmación y desactivar las notificaciones también (con el botón «Confirmar» del color de la app; los de cerrar sesión y eliminar siguen en rojo).

Límites de los campos (los mismos que valida el backend, en `src/utils/profileLimits.ts`):

- **Nombre, apellido y usuario: hasta 20 caracteres**, con un contador debajo mientras se edita («18/20»). Si el valor guardado es más largo, se muestran sus primeros 20 caracteres seguidos de «...» y se edita con esos 20.
- **Días de alerta de stock y de próximo a vencer: números de 2 a 90** (inclusive). Si el valor guardado está fuera de ese rango se usa el **7**.
- **Hora del chequeo diario: números de 0 a 23** (inclusive), **en hora de Argentina (UTC-3)**. Si no es una hora válida se usa la **5**. El servidor guarda la hora en UTC (se suman 3 horas: las 05:00 de Argentina se guardan como 8), así que el perfil muestra la hora con dos dígitos (`05:00 hs · Hora de Argentina (UTC-3)`). Es la hora de Argentina, no la del reloj del teléfono.
- Cada campo numérico (`src/components/NumberStepper.tsx`) permite escribir el número y tiene dos botones pegados al borde (subir y bajar) que se detienen en los extremos, y debajo un mensaje con el rango aceptado.

**Imágenes.** Al tocar una imagen se abre a pantalla completa: se acerca y se aleja **pellizcando con dos dedos** (el zoom se hace desde donde están los dedos) y, ya acercada, se arrastra con uno o dos dedos para ver cada parte; no hay zoom con doble toque. Al cargar una imagen de un producto (cámara o galería) no se ofrece recortarla: se muestra una ventana de confirmación con la imagen elegida y recién al confirmar se sube (`src/services/imageService.ts` elige y sube en dos pasos).

**Permiso de notificaciones.** Al activar las notificaciones desde el perfil se pide el permiso del teléfono (`src/services/notificationPermission.ts`). Si el botón dice «Activadas» pero el teléfono no tiene el permiso, la solicitud aparece al entrar al perfil; si el usuario la rechaza, el botón pasa a «Desactivadas». Si eligió que nunca se permitan, el sistema ya no muestra la solicitud y la app avisa: «Para activar las notificaciones de la aplicación, ve a Ajustes y otorga los permisos», con un botón Continuar.

**Recuperar contraseña.** «Olvidé mi contraseña» abre la pantalla con el mail del login ya completado.

**Login con Google.** El botón «Continuar con Google» (`app/(auth)/login.tsx`) usa `@react-native-google-signin/google-signin`, que necesita código nativo: **no funciona en Expo Go ni en la web**, solo en un APK (build de desarrollo o de EAS). Aparece únicamente en el celular y si está definida `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (el ID Android no hace falta en la app: Google lo reconoce por el paquete y el SHA-1; solo hay que crearlo en Google Cloud). Al cerrar sesión también se cierra la sesión de Google, para poder elegir otra cuenta. Si el mail ingresado en login o registro pertenece a una cuenta creada con Google que todavía no tiene contraseña, la app lo explica y ofrece crear una desde «Olvidé mi contraseña». La app le manda al servicio `auth` el **`idToken`** de Google (`POST /auth/google` con `{ id_token }`) y `auth` lo verifica y comprueba que fue emitido para el cliente Web configurado en su `GOOGLE_CLIENT_ID`; el ID Web de la app y el de `auth` tienen que ser el mismo en cada entorno (la app de desarrollo apunta al `auth` de desarrollo, y la de producción al de producción). Cada clave de firma (debug local, EAS, Play) necesita su propio cliente Android en Google Cloud con su SHA-1.

---

## Internacionalización (i18n)

El idioma se cambia desde la pantalla de Perfil. Persiste entre sesiones via `AsyncStorage`.

- Español: `src/i18n/locales/es.ts`
- English: `src/i18n/locales/en.ts`

---

## Troubleshooting

**"Module not found"**
```bash
npm install --legacy-peer-deps
# O si falla:
rm -rf node_modules package-lock.json && npm install --legacy-peer-deps
```

**"EXPO_PUBLIC_API_URL is undefined"**
```bash
echo "EXPO_PUBLIC_API_URL=http://localhost:8000" > .env
```

**No conecta al backend**
```bash
curl http://localhost:8000/health
# Si falla, verificar que docker-compose y python main.py estén corriendo
```

**401 en todas las llamadas**
- Token expirado. Hacer logout/login en la app.

---

## Backend

Ver [App_backend/README.md](../App_backend/README.md)
