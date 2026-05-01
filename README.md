# App Frontend - TPP

React Native + Expo frontend para Smart Inventory Application.

---

## 📋 Tabla de Contenidos

1. [Setup Local](#setup-local)
2. [Desarrollo](#desarrollo)
3. [Testing](#testing)
4. [Preparar para Deployment](#preparar-para-deployment)
5. [Deployment](#deployment)
6. [Troubleshooting](#troubleshooting)

---

## Setup Local

### Requisitos Previos

- **Node.js 18+** (descargar desde https://nodejs.org/)
- **npm o yarn**
- **Expo CLI** (se instala con npm)
- **Backend corriendo** en `http://localhost:8000` (ver `App_backend/README.md`)
- **Git**

### Paso 1: Clonar y navegar al proyecto

```bash
cd App_Frontend
```

### Paso 2: Crear archivo `.env` para desarrollo

```bash
cat > .env << 'EOF'
EXPO_PUBLIC_API_URL=http://localhost:8000
ENV=development
EOF
```

### Paso 3: Instalar dependencias

```bash
npm install --legacy-peer-deps
```

Si tienes problemas:

```bash
# Limpiar caché de npm
npm cache clean --force

# Eliminar node_modules
rm -rf node_modules package-lock.json

# Reinstalar
npm install --legacy-peer-deps
```

### Paso 4: Iniciar el servidor de desarrollo

```bash
npm start
```

Verás un output como:

```
› Metro waiting on exp://172.18.0.1:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

### Paso 5: Abrir en navegador (más fácil para desarrollo)

Presiona **`w`** en el terminal para abrir en navegador.

Se abrirá en: http://localhost:8081

---

## Desarrollo

### Estructura del Proyecto

```
App_Frontend/
├── app/                         # Rutas con Expo Router
│   ├── _layout.tsx             # Layout principal
│   └── index.tsx               # Home screen
├── src/
│   ├── components/             # Componentes reutilizables
│   ├── context/
│   │   └── AuthContext.tsx      # Context de autenticación
│   ├── hooks/                   # Custom hooks
│   │   ├── useAuth.ts          # Hook de auth
│   │   └── useFetch.ts         # Hook de requests HTTP
│   ├── services/
│   │   └── api.ts              # Llamadas API
│   ├── types/
│   │   └── navigation.ts       # Tipos de TypeScript
│   └── utils/
│       ├── storage.ts          # AsyncStorage helpers
│       ├── trpc.ts             # Configuración tRPC
│       ├── trpcClient.ts       # Cliente tRPC
│       └── TRPCProvider.tsx     # Provider tRPC
├── __tests__/                   # Tests
├── package.json
├── tsconfig.json
├── babel.config.js
├── eas.json                     # Configuración EAS
└── .env                         # Variables de ambiente
```

### Hot Reload en Desarrollo

Expo tiene fast refresh automático. Cada vez que guardas un archivo, la app se recarga.

Si necesitas control manual:

```
En el terminal mientras corre Expo:
- Presiona 'r' → Forzar reload
- Presiona 'i' → Abrir en iOS Simulator
- Presiona 'a' → Abrir en Android Emulator
- Presiona 'w' → Abrir en Web
- Presiona 'm' → Ver más opciones
```

### Conectar a Backend Local

El archivo `.env` controla la URL:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
```

### Ver logs de la app

```bash
# En el terminal donde corre expo
# Los logs aparecen automáticamente

# O abre las DevTools presionando 'd' en el terminal
```

### Comandos útiles en desarrollo

```bash
# Limpiar caché de Expo
npx expo start -c

# Limpiar caché de Metro bundler
npx expo start --clear

# Ver versión de Expo
npx expo -v

# Actualizar paquetes
npm update
```

---

## Testing

### Ejecutar tests unitarios

```bash
npm test
```

### Tests disponibles

```bash
# Todos los tests
npm test

# Solo tests de HomeScreen
npm test HomeScreen.test.tsx

# Watch mode (rerun tests on file changes)
npm test -- --watch

# Coverage
npm test -- --coverage
```
---

## Resumen: Git Push → Deployment

```bash
# 1. Crear rama de desarrollo
git checkout -b feature/nueva-feature

# 2. Hacer cambios y tests
npm test

# 3. Commit
git add .
git commit -m "feat: descripción del cambio"

# 4. Push a rama
git push origin feature/nueva-feature

# 5. Crear Pull Request en GitHub

# 6. Una vez merged a main, los workflows CI/CD:
#    - Ejecutan tests
#    - Buildan
#    - Deployan automáticamente

# 7. Monitorear deployment
eas build --status
```

---

## Links Útiles

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [Expo Router](https://docs.expo.dev/routing/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [tRPC Docs](https://trpc.io/)

---

## 📱 Ejecutar en dispositivo

### Con Expo Go (teléfono)

1. Descarga "Expo Go" en App Store o Google Play
2. Escanea el QR que aparece en el terminal
3. Se abrirá en tu teléfono

### Generar APK/IPA

```bash
eas build --platform android
```

(Requiere cuenta en Expo)

---

## 🐛 Troubleshooting

**"Module not found" errors:**
```bash
npm install --legacy-peer-deps
# O si falla
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

**"EXPO_PUBLIC_API_URL is undefined":**
```bash
# Verifica .env existe
cat .env
# Si no está, crea o edita:
echo "EXPO_PUBLIC_API_URL=http://localhost:8000" > .env
```

**"Cannot connect to backend":**
```bash
# Verifica que backend esté corriendo
curl http://localhost:8000/health

# Si falla, inicia Docker
docker-compose up -d -C App_backend
```

**Puerto 19000 en uso:**
```bash
npm start -- --port 19001
```

---

## 🔗 Backend

Documentación del backend: [App_backend/README.md](../App_backend/README.md)

Conexión: Se comunica via HTTP con tRPC en `http://localhost:8000/trpc`

---

## 📚 Recursos

- [Expo Docs](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)
- [Expo Router](https://docs.expo.dev/router/introduction)
- [tRPC Docs](https://trpc.io/docs)
