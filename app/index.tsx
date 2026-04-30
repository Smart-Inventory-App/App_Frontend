import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';



export default function HomeScreen() {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setStatus('Conectando...');
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${API_URL}/test`);
      const data = await response.json();
      console.log("API_URL:", API_URL);
      setStatus(`✅ ${data.message}`);
    } catch (error) {
      setStatus(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenido Smart Inventory</Text>
      
      <Pressable 
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={testConnection}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Probando...' : 'Test Backend'}
        </Text>
      </Pressable>

      {status && <Text style={styles.status}>{status}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
});
