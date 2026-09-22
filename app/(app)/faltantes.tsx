import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Alert, alertService } from '@/services/alertService';

export default function FaltantesScreen() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    alertService.getStockAlerts()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerText}>{t('faltantes.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : (
        <ScrollView style={styles.container}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={40} color={Colors.placeholder} />
              <Text style={styles.emptyText}>{t('faltantes.empty')}</Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={item.id} style={styles.card}>
                <Image
                  source={item.image_url ? { uri: item.image_url } : require('../../assets/icon.png')}
                  style={styles.image}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.product_name}</Text>
                  <Text style={styles.detail}>
                    {t('faltantes.currentStock', { stock: item.product_stock ?? 0 })}
                  </Text>
                </View>
                <View style={[styles.badge, item.level === 'critical' ? styles.badgeCritical : styles.badgeWarning]}>
                  <Text style={styles.badgeText}>
                    {item.days_until_stockout != null
                      ? t('faltantes.daysLeft', { count: item.days_until_stockout })
                      : t('faltantes.soon')}
                  </Text>
                </View>
              </View>
            ))
          )}
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
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyText: { color: Colors.textSecondary, fontSize: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fafafa',
    marginBottom: 10,
  },
  image: { width: 42, height: 42, borderRadius: 8 },
  name: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  detail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  badgeCritical: { backgroundColor: '#e5484d8f' },
  badgeWarning: { backgroundColor: '#fbbc059d' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#4a2f0a' },
});
