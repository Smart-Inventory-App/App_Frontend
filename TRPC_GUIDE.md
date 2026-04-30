# Quick Start - tRPC Communication

Frontend y Backend están conectados con **tRPC** para comunicación type-safe.

## Cómo funciona

tRPC permite que el frontend llame directamente a funciones del backend con type checking completo en tiempo de compilación.

### Registro de usuario

```typescript
import { useAuth } from '@/hooks/useAuth';

export default function RegisterScreen() {
  const { register, isLoading } = useAuth();

  const handleRegister = async () => {
    try {
      const user = await register('user@example.com', 'username', 'password');
      console.log('Usuario registrado:', user);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    // JSX aquí
  );
}
```

### Login

```typescript
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();

  const handleLogin = async () => {
    try {
      const token = await login('user@example.com', 'password');
      console.log('Logueo exitoso');
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    // JSX aquí
  );
}
```

### Obtener usuario actual

```typescript
import { useAuth } from '@/hooks/useAuth';

export default function ProfileScreen() {
  const { user } = useAuth();

  return (
    <View>
      <Text>Bienvenido {user?.username}</Text>
    </View>
  );
}
```

## Tipos

Todo es type-safe. Los tipos se comparten entre frontend y backend automáticamente:

```typescript
// Esto viene del backend, TypeScript lo sabe
const user: typeof AppRouter['user']['me']['_def']['_output_in'] = {
  id: 1,
  email: 'user@example.com',
  username: 'username',
};
```

## Ventajas de tRPC

✅ **Type-safe**: Errores de compilación en lugar de runtime
✅ **Autocomplete**: IntelliSense perfecto en VSCode
✅ **End-to-end typing**: Tipos compartidos entre frontend y backend
✅ **Sin GraphQL**: Más simple que GraphQL
✅ **Caching automático**: React Query integrado

## URLs

- Local: `http://localhost:8000/trpc`
- Producción: `https://your-backend.up.railway.app/trpc`
