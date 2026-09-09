import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Figtree_400Regular, useFonts } from '@expo-google-fonts/figtree'
import { Roboto_500Medium } from '@expo-google-fonts/roboto'
import { useCallback, useEffect, useState } from 'react';
import DynamicList from '@/components/DynamicAlert';
import { Alert, alertService } from '@/services/alertService';
import { useFocusEffect } from 'expo-router';

export default function AlertasScreen() {
  const [] = useFonts({Figtree_400Regular, Roboto_500Medium})
  const filters = ['Todas', 'Críticas', 'Stocks', 'Vencimientos']
  const [selected, setSelected] = useState<String>('Todas')
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsSummary, setAlertsSummary] = useState({critical: 0, warning: 0, info: 0});
  const [loading, setLoading] = useState(false);
  const alertContainer = {
    critical: styles.criticalContainer,
    warning: styles.warningContainer,
    info: styles.infoContainer
  }
  const alertTextColor = {
    critical: '#671a1c',
    warning: '#564209',
    info: '#14554b'
  };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await alertService.getAlerts();
      const summaryData = await alertService.getSummaryAlerts();
      setAlertsSummary(summaryData)
      setAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAlertsFilter = async (filter: string) => {
    setSelected(filter);
    try {
      switch(filter) {
        case 'Críticas':
          setAlerts(await alertService.getCriticalAlerts());
          break
        case 'Stocks':
          setAlerts(await alertService.getStockAlerts());
          break
        case 'Vencimientos':
          setAlerts(await alertService.getExpiryAlerts());
          break
        default:
          setAlerts(await alertService.getAlerts());
          break
      }
    } catch(error) {
      console.error('Error fetching alerts:', error);
    }
  }
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.headerText}>Centro de Alertas</Text>
      </View>
      <ScrollView style={{margin: 16}}>
        <View style={styles.alertSummary}>
          {Object.entries(alertsSummary).map(([key, value]) => (
            <View key={key} style={[styles.alertSummaryItem, alertContainer[key as keyof typeof alertContainer]]}>
              <Text style={[styles.alertSummaryItemValue, { color: alertTextColor[key as keyof typeof alertTextColor]}]}>{value}</Text>
              <Text style={[styles.alertSummaryItemText, { color: alertTextColor[key as keyof typeof alertTextColor]}]}>{key === "critical" ? "Críticas" : key === "warning" ? "Advertencias" : "Info"}</Text>
            </View>
          ))}
        </View>
        <View style={styles.filterBar}>
          {filters.map((filter) => (
            <Pressable
              key={filter}
              onPress={() => handleAlertsFilter(filter)}
              style={[
                styles.filterBarItem,
                selected == filter && styles.selectedFilterBarItem,
              ]}
            >
              <Text style={[
                styles.filterBarItemText,
                selected == filter && styles.selectedFilterBarItemText
              ]}>{filter}</Text>
            </Pressable>
          ))}
        </View>
        {alerts.length === 0 ? (
          <View style={{alignItems: 'center', marginTop: 32}}>
            <Text style={{fontFamily: 'Figtree_400Regular', color: '#828282'}}>No hay alertas para mostrar.</Text>
          </View>
        ) : (
          <DynamicList alertsData={alerts} />
        )}
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
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  alertSummaryItem: { alignItems: 'center', flex: 1 },
  alertSummaryItemValue: { fontSize: 24, fontFamily: 'Figtree_400Regular' },
  alertSummaryItemText: { fontSize: 16, fontFamily: 'Figtree_400Regular' },
  criticalContainer: { backgroundColor: '#e5484d8f', borderBottomLeftRadius: 10, borderTopLeftRadius: 10 },
  warningContainer: { backgroundColor: '#fbbc059d', marginHorizontal: 4 },
  infoContainer: { backgroundColor: '#2db7a352', borderBottomRightRadius: 10, borderTopRightRadius: 10 },
  filterBar: { flexDirection: 'row', justifyContent: 'space-around', margin: 16 },
  filterBarItem: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 8 },
  filterBarItemText: { fontFamily: 'Figtree_400Regular', color: '#828282' },
  selectedFilterBarItem: { backgroundColor: '#14554b', borderRadius: 10, paddingHorizontal: 8 },
  selectedFilterBarItemText: { fontFamily: 'Figtree_400Regular', color: '#fff' }
})
