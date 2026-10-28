import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import ScreenHeader from '@/components/ScreenHeader';
import { productService } from '@/services/productService';
import { TrendsResponse } from '@/types/product';
import {
  averagePerDay, barHeight, changeVsPrevious, formatDayLong, formatDayShort, monthSegments, peakIndex, TREND_PERIODS, TrendPeriod,
} from '@/utils/trends';

const CHART_HEIGHT = 120;
const MIN_BAR_WIDTH = 18;
// Márgenes de la pantalla y de la tarjeta del gráfico: lo que no es del gráfico
const CHART_SIDE_SPACE = 2 * 16 + 2 * 12;
// A partir de este ancho de tramo, el nombre del mes se escribe entero
const LONG_MONTH_WIDTH = 80;

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Pantalla completa con las tendencias de consumo: el período se elige, el gráfico se toca día por día y se compara
// con el período anterior. Se abre desde abajo, igual que el historial de cambios.
export default function TrendsModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [period, setPeriod] = useState<TrendPeriod>(14);
  const [data, setData] = useState<TrendsResponse | null>(null);
  // Lo consumido en los días anteriores al período, para compararlo (no se puede si no se pudo cargar)
  const [previousTotal, setPreviousTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const chartRef = useRef<ScrollView>(null);
  // Para ignorar la respuesta de una carga vieja si el usuario cambió de período o cerró la ventana
  const requestRef = useRef(0);

  const load = () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(false);
    // El doble de días trae también el período anterior: lo consumido antes es la diferencia entre los dos totales
    Promise.all([
      productService.getTrends(period),
      productService.getTrends(period * 2).catch(() => null),
    ])
      .then(([current, wide]) => {
        if (request !== requestRef.current) return;
        setData(current);
        setPreviousTotal(wide ? Math.max(0, wide.total_consumido - current.total_consumido) : null);
        setSelected(peakIndex(current.consumo_por_dia));
      })
      .catch(() => {
        if (request !== requestRef.current) return;
        setData(null);
        setError(true);
      })
      .finally(() => { if (request === requestRef.current) setLoading(false); });
  };

  useEffect(() => {
    if (visible) load();
    else requestRef.current += 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, period]);

  const days = data?.consumo_por_dia ?? [];
  const max = Math.max(0, ...days.map(point => point.quantity));
  const barWidth = Math.max(MIN_BAR_WIDTH, Math.floor((width - CHART_SIDE_SPACE) / period));
  const change = data ? changeVsPrevious(data.total_consumido, previousTotal) : null;
  const peak = peakIndex(days);
  const chosen = selected !== null ? days[selected] : null;
  const rankMax = Math.max(1, ...(data?.top_productos ?? []).map(p => p.cantidad));
  const lowMax = Math.max(1, ...(data?.productos_menos_usados ?? []).map(p => p.cantidad));
  const units = (n: number) => t(n === 1 ? 'tendencias.unitOne' : 'tendencias.unitMany', { count: n });

  const changeText = () => {
    if (!change) return t('tendencias.noPrevious');
    const key = change.direction === 'up' ? 'tendencias.changeUp' : change.direction === 'down' ? 'tendencias.changeDown' : 'tendencias.changeSame';
    return t(key, { percent: change.percent, days: period });
  };

  return (
    <Modal visible={visible} animationType="slide" hardwareAccelerated statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.screen}>
        <ScreenHeader
          title={t('tendencias.title')}
          left={
            <TouchableOpacity testID="trends-back" accessibilityLabel={t('tendencias.back')} onPress={onClose}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          }
        />
        <ScrollView testID="trends-scroll" style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}>
          <View style={styles.periods}>
            {TREND_PERIODS.map(option => (
              <TouchableOpacity
                key={option}
                testID={`trends-period-${option}`}
                accessibilityState={{ selected: period === option }}
                style={[styles.periodChip, period === option && styles.periodChipActive]}
                onPress={() => setPeriod(option)}
              >
                <Text style={[styles.periodText, period === option && styles.periodTextActive]}>{t('tendencias.periodDays', { count: option })}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading && <ActivityIndicator testID="trends-loading" color={Colors.primary} style={styles.loading} />}

          {!loading && error && (
            <View style={styles.errorBox}>
              <Text testID="trends-error" style={styles.errorText}>{t('tendencias.loadError')}</Text>
              <TouchableOpacity testID="trends-retry" style={styles.retry} onPress={load}>
                <Text style={styles.retryText}>{t('tendencias.retry')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && data && (
            <>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text testID="trends-consumed" style={styles.statValue}>{data.total_consumido}</Text>
                  <Text style={styles.statLabel}>{t('tendencias.consumed')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text testID="trends-restocked" style={[styles.statValue, { color: Colors.primaryDark }]}>{data.total_entradas}</Text>
                  <Text style={styles.statLabel}>{t('tendencias.restocked')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text testID="trends-average" style={styles.statValue}>{averagePerDay(data.total_consumido, period)}</Text>
                  <Text style={styles.statLabel}>{t('tendencias.average')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text testID="trends-peak" style={styles.statValue}>{peak !== null ? days[peak].quantity : '–'}</Text>
                  <Text style={styles.statLabel}>{peak !== null ? t('tendencias.peakOn', { date: formatDayShort(days[peak].day) }) : t('tendencias.peak')}</Text>
                </View>
              </View>

              <View
                testID="trends-change"
                style={[styles.changeBox, change?.direction === 'up' && styles.changeUp, change?.direction === 'down' && styles.changeDown]}
              >
                <Ionicons
                  name={change?.direction === 'up' ? 'trending-up' : change?.direction === 'down' ? 'trending-down' : 'remove'}
                  size={18}
                  color={Colors.textSecondary}
                />
                <Text testID="trends-change-text" style={styles.changeText}>{changeText()}</Text>
              </View>

              <Text style={styles.section}>{t('tendencias.dailyChart')}</Text>
              <View style={styles.chartCard}>
                {data.total_consumido === 0 && (
                  <Text testID="trends-empty-period" style={styles.emptyPeriod}>{t('tendencias.emptyPeriod', { days: period })}</Text>
                )}
                <ScrollView
                  ref={chartRef}
                  testID="trends-chart-scroll"
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  onContentSizeChange={() => chartRef.current?.scrollToEnd({ animated: false })}
                >
                  <View style={{ width: barWidth * days.length }}>
                    <View style={styles.monthRow}>
                      {monthSegments(days).map(segment => (
                        <View key={segment.key} testID={`trends-month-${segment.key}`} style={[styles.monthSegment, { width: segment.count * barWidth }]}>
                          <Text style={styles.monthText} numberOfLines={1}>
                            {segment.count * barWidth >= LONG_MONTH_WIDTH ? segment.long : segment.short}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.bars}>
                      {days.map((point, index) => (
                        <TouchableOpacity
                          key={point.day}
                          testID={`trends-bar-${index}`}
                          accessibilityLabel={`${formatDayLong(point.day)}: ${units(point.quantity)}`}
                          accessibilityState={{ selected: selected === index }}
                          activeOpacity={0.7}
                          style={[styles.barSlot, { width: barWidth }]}
                          onPress={() => setSelected(index)}
                        >
                          <View
                            testID={`trends-bar-fill-${index}`}
                            style={[
                              styles.bar,
                              { height: barHeight(point.quantity, max, CHART_HEIGHT), width: Math.max(8, barWidth - 8) },
                              point.quantity === 0 && styles.barEmpty,
                              selected === index && styles.barSelected,
                            ]}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.dayRow}>
                      {days.map((point, index) => (
                        <Text key={point.day} style={[styles.dayLabel, { width: barWidth }, selected === index && styles.dayLabelSelected]}>
                          {Number(point.day.slice(8, 10))}
                        </Text>
                      ))}
                    </View>
                  </View>
                </ScrollView>
                <View testID="trends-day-detail" style={styles.dayDetail}>
                  {chosen ? (
                    <>
                      <Text testID="trends-day-title" style={styles.dayDetailTitle}>{formatDayLong(chosen.day)}</Text>
                      <Text testID="trends-day-units" style={styles.dayDetailUnits}>
                        {chosen.quantity > 0 ? t(chosen.quantity === 1 ? 'tendencias.consumedThatDayOne' : 'tendencias.consumedThatDay', { units: units(chosen.quantity) }) : t('tendencias.noConsumption')}
                      </Text>
                    </>
                  ) : (
                    <Text testID="trends-day-hint" style={styles.dayDetailHint}>{t('tendencias.chartHint')}</Text>
                  )}
                </View>
              </View>

              <Text style={styles.section}>{t('tendencias.topProducts')}</Text>
              {data.top_productos.length === 0 ? (
                <Text testID="trends-no-top" style={styles.empty}>{t('tendencias.noData')}</Text>
              ) : (
                data.top_productos.map((p, i) => (
                  <View key={p.product_id} testID={`trends-top-${i}`} style={styles.rankRow}>
                    <View style={styles.rankHead}>
                      <Text style={styles.rankIndex}>{i + 1}</Text>
                      <Text style={styles.rankName} numberOfLines={1}>{p.nombre}</Text>
                      <Text style={styles.rankQty}>{units(p.cantidad)}</Text>
                    </View>
                    <View style={styles.rankTrack}>
                      <View testID={`trends-top-bar-${i}`} style={[styles.rankFill, { width: `${Math.round((p.cantidad / rankMax) * 100)}%` }]} />
                    </View>
                  </View>
                ))
              )}

              {data.productos_menos_usados.length > 0 && (
                <>
                  <Text style={styles.section}>{t('tendencias.leastUsed')}</Text>
                  {data.productos_menos_usados.map((p, i) => (
                    <View key={p.product_id} testID={`trends-low-${i}`} style={styles.rankRow}>
                      <View style={styles.rankHead}>
                        <Ionicons name="trending-down-outline" size={16} color={Colors.placeholder} />
                        <Text style={styles.rankName} numberOfLines={1}>{p.nombre}</Text>
                        <Text style={styles.rankQty}>{units(p.cantidad)}</Text>
                      </View>
                      <View style={styles.rankTrack}>
                        <View style={[styles.rankFill, styles.rankFillLow, { width: `${Math.round((p.cantidad / lowMax) * 100)}%` }]} />
                      </View>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f3f6' },
  container: { flex: 1, backgroundColor: '#f2f3f6' },
  content: { padding: 16 },
  periods: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  periodChip: { flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 9 },
  periodChipActive: { backgroundColor: Colors.primary },
  periodText: { fontSize: 14, color: Colors.textSecondary },
  periodTextActive: { color: '#fff', fontWeight: '600' },
  loading: { marginTop: 32 },
  errorBox: { alignItems: 'center', marginTop: 24, gap: 12 },
  errorText: { color: Colors.inputBorderError, fontSize: 14, textAlign: 'center' },
  retry: { borderWidth: 1, borderColor: Colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#fff' },
  retryText: { color: Colors.primary, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    elevation: 2,
    shadowColor: '#1B3A8F',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statValue: { fontSize: 26, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  changeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#fff' },
  changeUp: { backgroundColor: '#fff4e0' },
  changeDown: { backgroundColor: '#e6f7f5' },
  changeText: { flex: 1, fontSize: 13, color: Colors.textPrimary },
  section: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginTop: 22, marginBottom: 10 },
  chartCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12 },
  emptyPeriod: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  monthRow: { flexDirection: 'row', height: 20 },
  monthSegment: { borderLeftWidth: 1, borderLeftColor: '#e3e3e8', paddingLeft: 4, justifyContent: 'center' },
  monthText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, marginTop: 4 },
  barSlot: { height: CHART_HEIGHT, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { borderRadius: 4, backgroundColor: Colors.primary },
  barEmpty: { backgroundColor: '#dfe3e8' },
  barSelected: { backgroundColor: Colors.primaryDark },
  dayRow: { flexDirection: 'row', marginTop: 4 },
  dayLabel: { fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },
  dayLabelSelected: { color: Colors.primaryDark, fontWeight: '700' },
  dayDetail: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', minHeight: 48, justifyContent: 'center' },
  dayDetailTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  dayDetailUnits: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  dayDetailHint: { fontSize: 13, color: Colors.textSecondary },
  empty: { color: '#888', textAlign: 'center', marginTop: 8 },
  rankRow: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  rankHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankIndex: { width: 18, fontSize: 14, fontWeight: '700', color: Colors.primary },
  rankName: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  rankQty: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  rankTrack: { height: 6, borderRadius: 3, backgroundColor: '#eef0f3', marginTop: 8, overflow: 'hidden' },
  rankFill: { height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  rankFillLow: { backgroundColor: Colors.placeholder },
});
