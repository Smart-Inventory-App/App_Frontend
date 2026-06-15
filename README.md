# App Frontend — Smart Inventory

React Native + Expo (web/iOS/Android) frontend para Smart Inventory.

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

```bash
echo "EXPO_PUBLIC_API_URL=http://localhost:8000" > .env
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
| 1 | `App_backend` | `docker-compose up` — Postgres + Keycloak |
| 2 | `App_backend` | `source venv/bin/activate && python main.py` — Backend FastAPI |
| 3 | `App_Frontend` | `npx expo start --web` — Frontend Expo |

> Si hay migraciones nuevas, correr `alembic upgrade head` (con venv activado) antes de levantar el backend.

> Si el backend devuelve 401, el token de Keycloak expiró (~5 min). Hacer logout/login en la app.

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
│       ├── index.tsx           # Home — resumen del inventario
│       ├── inventario.tsx      # Lista de productos con filtros
│       ├── cargar.tsx          # Alta de producto
│       ├── alertas.tsx         # Alertas (placeholder)
│       └── perfil.tsx          # Perfil de usuario
├── src/
│   ├── components/
│   │   ├── ProductFormFields.tsx  # Formulario reutilizable de producto
│   │   ├── ProductItem.tsx
│   │   └── StatCard.tsx
│   ├── constants/
│   │   └── colors.ts
│   ├── context/
│   │   └── AuthContext.tsx     # Token Keycloak — login/logout
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
