# App Frontend — Smart Inventory Platform

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
│   │   ├── ImageViewerModal.tsx   # Imagen a pantalla completa, con zoom
│   │   ├── ProductItem.tsx
│   │   └── StatCard.tsx
│   ├── constants/
│   │   └── colors.ts
│   ├── context/
│   │   └── AuthContext.tsx     # Token JWT (servicio Auth) — login/logout
│   ├── utils/                  # numbers (puntos de miles), alertInfo, datetime (hora argentina),
│   │                           # selectedFirst, exitReasons, welcomeState, dateInput, zoom
│   ├── i18n/
│   │   ├── index.ts            # Configuración i18next
│   │   └── locales/
│   │       ├── es.ts           # Español (default)
│   │       └── en.ts           # English
│   ├── services/
│   │   ├── api.ts              # Axios instance con interceptor Bearer token
│   │   ├── authService.ts      # Login, register, recuperación de contraseña
│   │   ├── productService.ts   # CRUD de productos
│   │   └── profileService.ts   # Perfil de usuario (get/update)
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

La suite tiene **965 tests**, con ~96 % de cobertura de líneas y ~95 % de statements (el CI exige 90 % en ambos). Los tests de pantallas mockean los servicios y `expo-router`; las listas largas se verifican por los datos que reciben, porque en los tests la lista solo dibuja las primeras entradas.

---

## Pantallas

**Home.** Banner con el logo y un saludo en dos renglones («Bienvenido, <nombre>» y «Tu estado»; el nombre se corta a 20 caracteres). Debajo, las tarjetas del inventario (cada una lleva a su pantalla), **Últimos Cambios** (los 5 más recientes, con el motivo arriba de cada entrada, stock antes y después, y fecha y hora argentinas) y **Productos Recientes** (los 3 últimos cargados, con su fecha de carga arriba y un alto que se ajusta a los campos que tiene cada uno). Los números usan puntos de miles y se achican para entrar en su tarjeta. «Ver más» abre el **Historial de Cambios**, paginado con «Cargar más».

**Inventario.**
- **Lista paginada:** muestra los primeros 20 productos con los filtros elegidos y, debajo, «Cargar más» suma 10 por vez; al cambiar un filtro, la búsqueda o el orden vuelve a empezar. Se apoya en `limit` y `offset` de `GET /products/`.
- **Orden y filtros:** el orden por nombre es alfabético (sin mayúsculas ni tildes) y por vencimiento no aparecen los productos sin fecha. Los filtros por categoría y ubicación se eligen con un buscador y el elegido va primero.
- **Información del producto:** tocar un producto abre «Información del Producto», con un acceso a su **Stock total**.
- **Stock total de producto:** pantalla completa donde se busca un producto por nombre y se ve la suma del stock de todos los que tienen el mismo nombre y categoría (de cualquier marca). El nombre y el resumen quedan fijos, solo se desplaza el listado de «Productos encontrados», y cada producto tiene una casilla para incluirlo o no en el total.

**Cargar.** Entrada (alta manual, producto existente y escaneo de etiqueta o comprobante, con cámaras para el vencimiento y el código de barras) y Salida (motivos Consumido, Vencido, Vendido y Alquilado; escaneo de comprobante; al elegir un producto se muestra solo su nombre y debajo una tarjeta con categoría, marca, stock actual y vencimiento). **Los campos empiezan siempre vacíos**: no se completan con la categoría o la ubicación de la acción anterior.

**Alertas.** El resumen cuenta las alertas críticas, las advertencias y las informativas; los filtros son Todas, Críticas, Stocks y Vencidos. Al volver a la pantalla siempre vuelve a «Todas». Cada entrada tiene un alto fijo (título y detalle de hasta dos renglones) y al tocarla se abre **«Detalle de Alerta»**: imagen, nombre, categoría, el motivo con el color de su nivel y su información, marca, stock y vencimiento (si tiene). Los datos vienen de `GET /alerts/*`.

**Perfil.** Todo se muestra como texto: datos personales, tipo de cuenta (una caja resaltada) y la configuración de alertas (días de stock, días por vencer y hora del chequeo, en **hora Argentina, UTC-3**). El lápiz del avatar abre el modo edición, donde se cambian nombre, apellido, usuario, tipo de cuenta y esos tres valores, con **Guardar y Cancelar debajo de todo**; mientras se edita no aparecen Idioma, Notificaciones ni Cerrar sesión. Cambiar de idioma pide confirmación y desactivar las notificaciones también.

**Recuperar contraseña.** «Olvidé mi contraseña» abre la pantalla con el mail del login ya completado.

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
