import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Figtree_400Regular, useFonts } from '@expo-google-fonts/figtree'
import { Roboto_500Medium } from '@expo-google-fonts/roboto'
import { useCallback, useEffect, useState } from 'react';
import DynamicList from '@/components/DynamicAlert';
import ScreenHeader from '@/components/ScreenHeader';
import AlertDetailModal from '@/components/AlertDetailModal';
import { Alert, alertService } from '@/services/alertService';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function AlertasScreen() {
  const [] = useFonts({Figtree_400Regular, Roboto_500Medium})
  const filters = ['Todas', 'Críticas', 'Stocks', 'Vencidos']
  const [selected, setSelected] = useState<String>('Todas')
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsSummary, setAlertsSummary] = useState({critical: 0, warning: 0, info: 0});
  const [loading, setLoading] = useState(false);
  const [detailAlert, setDetailAlert] = useState<Alert | null>(null);
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
      // Al volver a la pantalla siempre se ve el filtro "Todas" con todas las alertas
      setSelected('Todas');
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
        case 'Vencidos':
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
      <ScreenHeader title="Centro de Alertas" onHomePress={() => router.navigate('/(tabs)/')} />
      <ScrollView style={{margin: 16}}>
        <View style={styles.alertSummary}>
          {Object.entries(alertsSummary).map(([key, value]) => (
            <View key={key} testID={`alert-summary-${key}`} style={[styles.alertSummaryItem, alertContainer[key as keyof typeof alertContainer]]}>
              <Text testID={`alert-summary-value-${key}`} style={[styles.alertSummaryItemValue, { color: alertTextColor[key as keyof typeof alertTextColor]}]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{value}</Text>
              <Text testID={`alert-summary-text-${key}`} style={[styles.alertSummaryItemText, { color: alertTextColor[key as keyof typeof alertTextColor]}]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{key === "critical" ? "Críticas" : key === "warning" ? "Advertencias" : "Info"}</Text>
            </View>
          ))}
        </View>
        <View style={styles.filterBar}>
          {filters.map((filter) => (
            <Pressable
              key={filter}
              testID={`alert-filter-${filter}`}
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
          <DynamicList alertsData={alerts} onPressAlert={setDetailAlert} />
        )}
      </ScrollView>
      <AlertDetailModal alert={detailAlert} onClose={() => setDetailAlert(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  alertSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  alertSummaryItem: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingVertical: 14, paddingHorizontal: 6 },
  alertSummaryItemValue: { alignSelf: 'stretch', textAlign: 'center', fontSize: 28, lineHeight: 34, fontFamily: 'Figtree_400Regular' },
  // El texto se achica solo si el cuadrado es angosto, para que "Advertencias" entre siempre en un renglón
  alertSummaryItemText: { alignSelf: 'stretch', textAlign: 'center', fontSize: 16, lineHeight: 22, marginTop: 2, fontFamily: 'Figtree_400Regular' },
  criticalContainer: { backgroundColor: '#e5484d8f', borderBottomLeftRadius: 10, borderTopLeftRadius: 10 },
  warningContainer: { backgroundColor: '#fbbc059d', marginHorizontal: 4 },
  infoContainer: { backgroundColor: '#2db7a352', borderBottomRightRadius: 10, borderTopRightRadius: 10 },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginVertical: 16 },
  filterBarItem: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 4, paddingVertical: 9 },
  filterBarItemText: { fontFamily: 'Figtree_400Regular', fontSize: 14, color: '#828282' },
  selectedFilterBarItem: { backgroundColor: Colors.primary },
  selectedFilterBarItemText: { color: '#fff', fontWeight: '600' }
})
