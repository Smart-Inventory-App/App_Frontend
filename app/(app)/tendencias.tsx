import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { productService } from '@/services/productService';
import { TrendsResponse } from '@/types/product';

const PERIOD_DAYS = 14;

export default function TendenciasScreen() {
  const { t } = useTranslation();
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    productService.getTrends(PERIOD_DAYS)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  const maxDay = data ? Math.max(1, ...data.consumo_por_dia.map((d) => d.quantity)) : 1;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerText}>{t('tendencias.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading || !data ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : (
        <ScrollView style={styles.container}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{data.total_consumido}</Text>
              <Text style={styles.statLabel}>{t('tendencias.consumed', { days: PERIOD_DAYS })}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: Colors.primaryDark }]}>{data.total_entradas}</Text>
              <Text style={styles.statLabel}>{t('tendencias.restocked', { days: PERIOD_DAYS })}</Text>
            </View>
          </View>

          <Text style={styles.section}>{t('tendencias.dailyChart')}</Text>
          <View style={styles.chart}>
            {data.consumo_por_dia.map((d) => {
              const height = Math.max(3, (d.quantity / maxDay) * 90);
              return (
                <View key={d.day} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View style={[styles.bar, { height }]} />
                  </View>
                  <Text style={styles.barLabel}>{d.day.slice(8, 10)}</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.section}>{t('tendencias.topProducts')}</Text>
          {data.top_productos.length === 0 ? (
            <Text style={styles.empty}>{t('tendencias.noData')}</Text>
          ) : (
            data.top_productos.map((p, i) => (
              <View key={p.product_id} style={styles.rankRow}>
                <Text style={styles.rankIndex}>{i + 1}</Text>
                <Text style={styles.rankName} numberOfLines={1}>{p.nombre}</Text>
                <Text style={styles.rankQty}>{p.cantidad}</Text>
              </View>
            ))
          )}

          {data.productos_menos_usados.length > 0 && (
            <>
              <Text style={styles.section}>{t('tendencias.leastUsed')}</Text>
              {data.productos_menos_usados.map((p) => (
                <View key={p.product_id} style={styles.rankRow}>
                  <Ionicons name="trending-down-outline" size={16} color={Colors.placeholder} />
                  <Text style={styles.rankName} numberOfLines={1}>{p.nombre}</Text>
                  <Text style={styles.rankQty}>{p.cantidad}</Text>
                </View>
              ))}
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    paddingTop: 52,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerText: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary },
  container: { flex: 1, padding: 16 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  section: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginTop: 24, marginBottom: 12 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120 },
  barCol: { alignItems: 'center', flex: 1 },
  barTrack: { height: 90, justifyContent: 'flex-end' },
  bar: { width: 8, borderRadius: 4, backgroundColor: Colors.primary },
  barLabel: { fontSize: 9, color: Colors.placeholder, marginTop: 6 },
  empty: { color: Colors.textSecondary, fontSize: 14 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rankIndex: { fontSize: 13, fontWeight: '700', color: Colors.placeholder, width: 16 },
  rankName: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  rankQty: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
});
