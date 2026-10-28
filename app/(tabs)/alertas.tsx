import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Figtree_400Regular, useFonts } from '@expo-google-fonts/figtree'
import { Roboto_500Medium } from '@expo-google-fonts/roboto'
import { useCallback, useState } from 'react';
import DynamicList from '@/components/DynamicAlert';
import ScreenHeader from '@/components/ScreenHeader';
import AlertDetailModal from '@/components/AlertDetailModal';
import { Alert, alertService } from '@/services/alertService';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/colors';
import { splitByOrigin } from '@/utils/alertInfo';

type TypeFilter = 'Todas' | 'Stock' | 'Vencimiento';
type LevelFilter = 'critical' | 'warning';

const TYPE_FILTERS: TypeFilter[] = ['Todas', 'Stock', 'Vencimiento'];
const LEVELS: { key: LevelFilter; label: string }[] = [
  { key: 'critical', label: 'Críticas' },
  { key: 'warning', label: 'Advertencias' },
];

// Qué alertas entran en cada opción de tipo
const matchesType = (alert: Alert, filter: TypeFilter) => {
  if (filter === 'Stock') return alert.type === 'stock_low_coverage';
  if (filter === 'Vencimiento') return alert.type === 'expiry' || alert.type === 'slow_pace';
  return true;
};

export default function AlertasScreen() {
  const [] = useFonts({Figtree_400Regular, Roboto_500Medium})
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('Todas')
  // Tocar «Críticas» o «Advertencias» muestra solo esas; volver a tocarlas las vuelve a mostrar todas
  const [levelFilter, setLevelFilter] = useState<LevelFilter | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [detailAlert, setDetailAlert] = useState<Alert | null>(null);
  const levelContainer = { critical: styles.criticalContainer, warning: styles.warningContainer }
  const levelTextColor = { critical: '#671a1c', warning: '#564209' };

  const load = useCallback(async () => {
    try {
      setAlerts(await alertService.getAlerts());
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Al volver a la pantalla siempre se ven todas las alertas, sin filtros
      setTypeFilter('Todas');
      setLevelFilter(null);
      load();
    }, [load])
  );

  // Los números de «Críticas» y «Advertencias» son los de la opción de tipo elegida, así coinciden con lo que se ve al tocarlos
  const ofType = alerts.filter(alert => matchesType(alert, typeFilter));
  const counts = { critical: ofType.filter(a => a.level === 'critical').length, warning: ofType.filter(a => a.level === 'warning').length };
  const visible = levelFilter ? ofType.filter(alert => alert.level === levelFilter) : ofType;
  const { rule: ruleAlerts, system: systemAlerts } = splitByOrigin(visible);

  return (
    <>
      <ScreenHeader title="Centro de Alertas" onHomePress={() => router.navigate('/(tabs)/')} />
      <ScrollView style={{margin: 16}}>
        <View style={styles.alertSummary}>
          {LEVELS.map(({ key, label }) => (
            <Pressable
              key={key}
              testID={`alert-summary-${key}`}
              accessibilityRole="button"
              accessibilityState={{ selected: levelFilter === key }}
              onPress={() => setLevelFilter(current => (current === key ? null : key))}
              style={[styles.alertSummaryItem, levelContainer[key], levelFilter === key && { borderColor: levelTextColor[key] }]}
            >
              <Text testID={`alert-summary-value-${key}`} style={[styles.alertSummaryItemValue, { color: levelTextColor[key] }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{counts[key]}</Text>
              <Text testID={`alert-summary-text-${key}`} style={[styles.alertSummaryItemText, { color: levelTextColor[key] }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.filterBar}>
          {TYPE_FILTERS.map((filter) => (
            <Pressable
              key={filter}
              testID={`alert-filter-${filter}`}
              onPress={() => setTypeFilter(filter)}
              style={[
                styles.filterBarItem,
                typeFilter == filter && styles.selectedFilterBarItem,
              ]}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[
                styles.filterBarItemText,
                typeFilter == filter && styles.selectedFilterBarItemText
              ]}>{filter}</Text>
            </Pressable>
          ))}
        </View>
        {visible.length === 0 ? (
          <View style={{alignItems: 'center', marginTop: 32}}>
            <Text style={{fontFamily: 'Figtree_400Regular', color: '#828282'}}>No hay alertas para mostrar.</Text>
          </View>
        ) : (
          <>
            {/* Primero las que salen de las reglas del usuario (días de anticipación del vencimiento y stock mínimo) */}
            {ruleAlerts.length > 0 && (
              <View testID="alerts-section-rule">
                <View style={[styles.sectionHeader, styles.ruleHeader]}>
                  <Text style={[styles.sectionTitle, { color: Colors.primary }]}>Según tus reglas</Text>
                  <Text style={styles.sectionSubtitle} numberOfLines={1}>Vencimiento y stock mínimo configurado.</Text>
                </View>
                <DynamicList alertsData={ruleAlerts} onPressAlert={setDetailAlert} />
              </View>
            )}
            {/* Después las que calcula el sistema con el consumo de cada producto */}
            {systemAlerts.length > 0 && (
              <View testID="alerts-section-system">
                <View style={[styles.sectionHeader, styles.systemHeader]}>
                  <Text style={[styles.sectionTitle, { color: '#4a4a4a' }]}>Generado por el sistema</Text>
                  <Text style={styles.sectionSubtitle} numberOfLines={1}>Predicciones con tu flujo de productos.</Text>
                </View>
                <DynamicList alertsData={systemAlerts} onPressAlert={setDetailAlert} />
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
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  alertSummaryItem: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  alertSummaryItemValue: { alignSelf: 'stretch', textAlign: 'center', fontSize: 28, lineHeight: 34, fontFamily: 'Figtree_400Regular' },
  // El texto se achica solo si el cuadrado es angosto, para que "Advertencias" entre siempre en un renglón
  alertSummaryItemText: { alignSelf: 'stretch', textAlign: 'center', fontSize: 16, lineHeight: 22, marginTop: 2, fontFamily: 'Figtree_400Regular' },
  criticalContainer: { backgroundColor: '#e5484d8f' },
  warningContainer: { backgroundColor: '#fbbc059d' },
  // Sin ícono: un ícono acá parecería un botón, y es solo un título
  sectionHeader: { marginTop: 8, marginBottom: 2, paddingLeft: 10, borderLeftWidth: 4 },
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
