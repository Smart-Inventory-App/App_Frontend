import { StyleSheet, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import FixedTabBanner from '../../src/components/FixedTabBanner';
import { useAuth } from '../../src/context/AuthContext';
import { endTabTransition, slideTransition, startTabTransition } from '../../src/utils/tabTransition';

// Al cambiar de pestaña la pantalla se desliza hacia el lado en el que está la pestaña elegida. Estas opciones son
// siempre las mismas objetos: si cambiaran en medio de un deslizamiento, el navegador reiniciaría la animación.
const screenOptions = { headerShown: false, ...slideTransition };
const screenListeners = ({ route }: { route: { name: string } }) => ({
  transitionStart: () => startTabTransition(route.name),
  transitionEnd: () => endTabTransition(),
});

export default function TabsLayout() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();

  // Si la sesión se cierra (manual o por vencimiento), se vuelve al login.
  if (!isLoading && !isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <View style={styles.root}>
      <Tabs screenOptions={screenOptions} screenListeners={screenListeners}>
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.home'),
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="inventario"
          options={{
            title: t('tabs.inventory'),
            tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="cargar"
          options={{
            title: t('tabs.load'),
            tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="alertas"
          options={{
            title: t('tabs.alerts'),
            tabBarIcon: ({ color, size }) => <Ionicons name="alert-circle" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: t('tabs.profile'),
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
      </Tabs>
      {/* Banner quieto durante el deslizamiento entre pestañas que no son Inicio (tiene su propio estado) */}
      <FixedTabBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
