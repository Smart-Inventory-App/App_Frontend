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
import { Ionicons } from '@expo/vector-icons';
import { splitByOrigin } from '@/utils/alertInfo';

export default function AlertasScreen() {
  const [] = useFonts({Figtree_400Regular, Roboto_500Medium})
  const filters = ['Todas', 'Críticas', 'Stock', 'Vencimiento']
  const [selected, setSelected] = useState<String>('Todas')
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsSummary, setAlertsSummary] = useState({critical: 0, warning: 0, total: 0});
  const [loading, setLoading] = useState(false);
  const [detailAlert, setDetailAlert] = useState<Alert | null>(null);
  const alertContainer = {
    critical: styles.criticalContainer,
    warning: styles.warningContainer,
    total: styles.infoContainer
  }
  const alertTextColor = {
    critical: '#671a1c',
    warning: '#564209',
    total: '#14554b'
  };
  const alertSummaryLabel = { critical: 'Críticas', warning: 'Advertencias', total: 'Total' };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await alertService.getAlerts();
      const summaryData = await alertService.getSummaryAlerts();
      // Los tres números salen de la misma lista que se ve: críticas + advertencias = total
      setAlertsSummary({critical: summaryData.critical, warning: summaryData.warning, total: summaryData.total})
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
        case 'Stock':
          setAlerts(await alertService.getStockAlerts());
          break
        case 'Vencimiento':
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
  const { rule: ruleAlerts, system: systemAlerts } = splitByOrigin(alerts);

  return (
    <>
      <ScreenHeader title="Centro de Alertas" onHomePress={() => router.navigate('/(tabs)/')} />
      <ScrollView style={{margin: 16}}>
        <View style={styles.alertSummary}>
          {Object.entries(alertsSummary).map(([key, value]) => (
            <View key={key} testID={`alert-summary-${key}`} style={[styles.alertSummaryItem, alertContainer[key as keyof typeof alertContainer]]}>
              <Text testID={`alert-summary-value-${key}`} style={[styles.alertSummaryItemValue, { color: alertTextColor[key as keyof typeof alertTextColor]}]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{value}</Text>
              <Text testID={`alert-summary-text-${key}`} style={[styles.alertSummaryItemText, { color: alertTextColor[key as keyof typeof alertTextColor]}]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{alertSummaryLabel[key as keyof typeof alertSummaryLabel]}</Text>
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
          <>
            {/* Primero las que salen de las reglas del usuario (días de anticipación del vencimiento y stock mínimo) */}
            {ruleAlerts.length > 0 && (
              <View testID="alerts-section-rule">
                <View style={[styles.sectionHeader, styles.ruleHeader]}>
                  <Ionicons name="options-outline" size={20} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: Colors.primary }]}>Según tus reglas</Text>
                    <Text style={styles.sectionSubtitle}>
                      Vencimiento y stock mínimo, con los límites que configuraste.
                    </Text>
                  </View>
                </View>
                <DynamicList alertsData={ruleAlerts} onPressAlert={setDetailAlert} origin="rule" />
              </View>
            )}
            {/* Después las que calcula el sistema con el consumo de cada producto */}
            {systemAlerts.length > 0 && (
              <View testID="alerts-section-system">
                <View style={[styles.sectionHeader, styles.systemHeader]}>
                  <Ionicons name="sparkles-outline" size={20} color="#6e6e6e" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: '#4a4a4a' }]}>Generadas por el sistema</Text>
                    <Text style={styles.sectionSubtitle}>
                      Predicciones con tu consumo, como el ritmo con el que se vencería un producto.
                    </Text>
                  </View>
                </View>
                <DynamicList alertsData={systemAlerts} onPressAlert={setDetailAlert} origin="system" />
              </View>
            )}
          </>
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 2, paddingLeft: 10, borderLeftWidth: 4 },
  ruleHeader: { borderLeftColor: Colors.primary },
  systemHeader: { borderLeftColor: '#bdbdbd', marginTop: 20 },
  sectionTitle: { fontFamily: 'Figtree_400Regular', fontSize: 16, fontWeight: '700' },
  sectionSubtitle: { fontFamily: 'Figtree_400Regular', fontSize: 12, color: '#828282', marginTop: 1 },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginVertical: 16 },
  filterBarItem: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 4, paddingVertical: 9 },
  filterBarItemText: { fontFamily: 'Figtree_400Regular', fontSize: 14, color: '#828282' },
  selectedFilterBarItem: { backgroundColor: Colors.primary },
  selectedFilterBarItemText: { color: '#fff', fontWeight: '600' }
})
