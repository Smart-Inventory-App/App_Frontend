import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import StatCard from '@/components/StatCard';
import ProductItem from '@/components/ProductItem';
import { Figtree_400Regular, useFonts } from '@expo-google-fonts/figtree';
import { Roboto_500Medium } from '@expo-google-fonts/roboto'

export default function HomeScreen() {
  const [] = useFonts({Figtree_400Regular, Roboto_500Medium})
  //TODO: consulta a api y guardar los valores
  return (
    <>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>JohDoestri, Johnson</Text>
        <Image source={require("../../assets/icon.png")} style={styles.logo}></Image>
      </View>
      <ScrollView style={styles.container}>

        {/* Paneles de estadísticas */}
        <View style={styles.statsRow}>
          <StatCard title="Productos en stock" value="230" label="+15 esta semana" labelColor="green" />
          <StatCard title="Alertas activas" value="6" label="2 críticas" labelColor="red" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title="Por vencer" value="32" label="Esta semana" labelColor="yellow" />
          <StatCard title="A reponer" value="12" label="Stock bajo" labelColor="yellow" />
        </View>

        {/* Lista de productos recientes */}
        <Text style={styles.section}>Productos Recientes</Text>
        <ProductItem name="Leche entera 1L" expiry="16 abr" stock="2 ud." status="Bajo" statusColor="yellow" />
        <ProductItem name="Aceite de Oliva 500ml" expiry="12 dic" stock="1 ud." />
        <ProductItem name="Yogur Danonino x4" expiry="9 abr" stock="1 ud." status="Urgente" statusColor="red" />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f3f6', padding: 16 },
  headerContainer: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16
  },
  logo: { width: 50, height: 50, borderRadius: 20 },
  header: { fontSize: 20, margin: 12, fontFamily: 'Roboto_500Medium' },
  statsRow: { flexDirection: 'row' },
  section: { fontSize: 14, fontWeight: 'bold', marginTop: 20, marginBottom: 10, fontFamily: 'Figtree_400Regular' },
});
