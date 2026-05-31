import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false}}>
          {/* Grupo de auth (sin navbar) */}
          <Stack.Screen
            name="auth"
            options={{ headerShown: false }}
          />

          {/* Grupo de tabs (con navbar) */}
          <Stack.Screen
            name="tabs"
            options={{ headerShown: false }}
          />
        </Stack>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
