import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { productService } from '@/services/productService';
import { ReposicionSuggestion } from '@/types/product';

export default function ReposicionScreen() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ReposicionSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    productService.getReposicionSugerida()
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
        <Text style={styles.headerText}>{t('reposicion.title')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.subtitle}>{t('reposicion.subtitle')}</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : (
        <ScrollView style={styles.container}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={40} color={Colors.placeholder} />
              <Text style={styles.emptyText}>{t('reposicion.empty')}</Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={item.product_id} style={styles.card}>
                <Image
                  source={item.imagen_url ? { uri: item.imagen_url } : require('../../assets/icon.png')}
                  style={styles.image}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.nombre}</Text>
                  <Text style={styles.detail}>
                    {t('reposicion.currentStock', { stock: item.stock })}
                    {item.days_until_stockout != null
                      ? ` · ${t('faltantes.daysLeft', { count: item.days_until_stockout })}`
                      : ''}
                  </Text>
                </View>
                <View style={styles.qtyBox}>
                  <Text style={styles.qtyNumber}>+{item.suggested_qty}</Text>
                  <Text style={styles.qtyLabel}>{t('reposicion.units')}</Text>
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
  subtitle: { fontSize: 13, color: Colors.textSecondary, paddingHorizontal: 16, paddingTop: 12 },
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
  qtyBox: { alignItems: 'center', minWidth: 48 },
  qtyNumber: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  qtyLabel: { fontSize: 10, color: Colors.textSecondary },
});
