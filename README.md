# App Frontend - TPP

React Native + Expo frontend para Smart Inventory Application.

## 🚀 Quick Start - Desarrollo Local

### Requisitos
- Node.js 18+
- npm
- Backend corriendo en `http://localhost:8000` (ver `App_backend/README.md`)

### 1. Instala dependencias

```bash
cd App_Frontend
npm install --legacy-peer-deps
```

### 2. Configura la URL del Backend

Verifica que existe el archivo `.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
```

Si no existe, créalo.

### 3. Inicia Expo

```bash
npm start
```

Verás un output como:
```
› Metro waiting on exp://172.18.0.1:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

### 4. Abre en Web (más fácil)

Presiona **`w`** en el terminal para abrir en navegador.

Se abrirá automáticamente en http://localhost:19000

---

## 🧪 Prueba la Conexión

1. La app mostrará un botón **"Test Backend"**
2. Tócalo para verificar que el frontend se conecta al backend
3. Si funciona, verás ✅ en la app y en los logs del backend

---

## 📋 Desarrollo

### Archivos principales

```
App_Frontend/
├── app/                    # Rutas (Expo Router)
│   ├── _layout.tsx        # Layout principal
│   └── index.tsx          # Home screen
├── src/
│   ├── components/        # Componentes reutilizables
│   ├── hooks/             # Custom hooks (useAuth, useFetch)
│   ├── services/          # API calls
│   ├── utils/
│   │   ├── trpc.ts        # tRPC setup
│   │   ├── trpcClient.ts  # Cliente tRPC
│   │   └── TRPCProvider.tsx # Provider
│   └── context/           # React Context
```

### Estructura de componentes

Ejemplo simple:
```tsx
import { View, Text, Pressable } from 'react-native';

export default function MyComponent() {
  return (
    <View>
      <Text>Hola</Text>
    </View>
  );
}
```

---

## 🔄 Hot Reload

Expo proporciona fast refresh automático. Cada vez que guardas un archivo, la app se recarga.

Si no funciona:
- Presiona **`r`** en el terminal para forzar reload
- Presiona **`m`** para ver más opciones

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
