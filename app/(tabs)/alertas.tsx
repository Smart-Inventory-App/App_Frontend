import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Figtree_400Regular, useFonts } from '@expo-google-fonts/figtree'
import { Roboto_500Medium } from '@expo-google-fonts/roboto'

export default function AlertasScreen() {
  const [] = useFonts({Figtree_400Regular, Roboto_500Medium})
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.headerText}>Centro de Alertas</Text>
      </View>
      <ScrollView style={{margin: 16}}>
        <View style={styles.alertSummary}>
          <View style={styles.alertSummaryItem}>
            <Text style={styles.alertSummaryItemValue}>2</Text>
            <Text style={styles.alertSummaryItemText}>Críticas</Text>
          </View>
          <View style={styles.alertSummaryItem}>
            <Text style={styles.alertSummaryItemValue}>3</Text>
            <Text style={styles.alertSummaryItemText}>Advertencias</Text>
          </View>
          <View style={styles.alertSummaryItem}>
            <Text style={styles.alertSummaryItemValue}>1</Text>
            <Text style={styles.alertSummaryItemText}>Info</Text>
          </View>
        </View>
        <View style={styles.filterBar}>
          <View style={styles.filterBarItem}>
            <Text style={styles.filterBarItemText}>Todas</Text>
          </View>
          <View style={styles.filterBarItem}>
            <Text style={styles.filterBarItemText}>Críticas</Text>
          </View>
          <View style={styles.filterBarItem}>
            <Text style={styles.filterBarItemText}>Stocks</Text>
          </View>
          <View style={styles.filterBarItem}>
            <Text style={styles.filterBarItemText}>Vencimientos</Text>
          </View>
        </View>
        {/* <DynamicList /> */}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#fff', padding: 16 },
  headerText: { fontSize: 20, margin: 12, fontFamily: 'Roboto_500Medium' },
  alertSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#2db7a352',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  alertSummaryItem: { alignItems: 'center' },
  alertSummaryItemValue: { color: '#14554b', fontSize: 24, fontFamily: 'Figtree_400Regular' },
  alertSummaryItemText: { color: '#14554b', fontSize: 16, fontFamily: 'Figtree_400Regular' },
  filterBar: { flexDirection: 'row', justifyContent: 'space-around', margin: 16},
  filterBarItem: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 8},
  filterBarItemText: { fontFamily: 'Figtree_400Regular', color: '#828282' }
})