import { View, Text, StyleSheet, ScrollView } from 'react-native';
import StatCard from '@/components/StatCard';
import ProductItem from '@/components/ProductItem';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>JohDoestri, Johnson</Text>

      {/* Paneles de estadísticas */}
      <View style={styles.statsRow}>
        <StatCard title="Productos en stock" value="230" label="+15 esta semana" labelColor="green" />
        <StatCard title="Alertas activas" value="6" label="2 críticas" labelColor="red" />
      </View>
      <View style={styles.statsRow}>
        <StatCard title="Por vencer" value="32" label="Esta semana" labelColor="green" />
        <StatCard title="A reponer" value="12" label="Stock bajo" labelColor="orange" />
      </View>

      {/* Lista de productos recientes */}
      <Text style={styles.section}>Productos Recientes</Text>
      <ProductItem name="Leche entera 1L" expiry="16 abr" stock="2 ud." status="Bajo" statusColor="orange" />
      <ProductItem name="Aceite de Oliva 500ml" expiry="12 dic" stock="1 ud." />
      <ProductItem name="Yogur Danonino x4" expiry="9 abr" stock="1 ud." status="Urgente" statusColor="red" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f3f6', padding: 16 },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  statsRow: { flexDirection: 'row' },
  section: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
});
