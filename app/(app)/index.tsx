import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';

export default function HomeScreen() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenido a Smart Inventory</Text>
      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24, backgroundColor: Colors.background },
  title: { fontSize: 22, fontWeight: '700', color: Colors.primaryDark, textAlign: 'center', paddingHorizontal: 32 },
  button: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 8 },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});
