import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import StatCard from '@/components/StatCard';
import ProductItem from '@/components/ProductItem';
import { Figtree_400Regular, useFonts } from '@expo-google-fonts/figtree';
import { Roboto_500Medium } from '@expo-google-fonts/roboto';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';
import { productService } from '@/services/productService';
import { settingsService } from '@/services/settingsService';
import { Product } from '@/types/product';

function decodeName(token: string | null): string {
  if (!token) return '';
  try {
    const p = JSON.parse(atob(token.split('.')[1]));
    const full = [p.given_name, p.family_name].filter(Boolean).join(' ');
    return full || p.preferred_username || p.email || '';
  } catch {
    return '';
  }
}

export default function HomeScreen() {
  useFonts({ Figtree_400Regular, Roboto_500Medium });
  const { t } = useTranslation();
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [expiryDaysThreshold, setExpiryDaysThreshold] = useState(7);

  const displayName = useMemo(() => decodeName(token), [token]);

  const fetchData = useCallback(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([productService.getProducts(), settingsService.getAll()])
      .then(([prods, s]) => {
        setProducts(prods);
        setLowStockThreshold(s.lowStock);
        setExpiryDaysThreshold(s.expiryDays);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useFocusEffect(fetchData);

  const today = new Date();
  const inNDays = new Date(today.getTime() + expiryDaysThreshold * 24 * 60 * 60 * 1000);

  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const lowStock = products.filter(p => p.stock <= lowStockThreshold).length;
  const expiringSoon = products.filter(p => {
    if (!p.vencimiento) return false;
    const d = new Date(p.vencimiento);
    return d >= today && d <= inNDays;
  }).length;
  const recentProducts = products.slice(0, 3);

  return (
    <>
      <View style={styles.headerContainer}>
        <Text style={styles.appName}>{t('common.appName')}</Text>
        <Text style={styles.header}>{displayName || t('home.welcome')}</Text>
      </View>
      <ScrollView style={styles.container}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard title={t('home.totalStock')} value={String(totalStock)} label={t('home.totalStockLabel')} labelColor="green" />
              <StatCard title={t('home.lowStock')} value={String(lowStock)} label={`≤ ${lowStockThreshold} ${t('home.lowStockUnit')}`} labelColor="red" />
            </View>
            <View style={styles.statsRow}>
              <StatCard title={t('home.expiringSoon')} value={String(expiringSoon)} label={t('home.expiringSoonLabel', { days: expiryDaysThreshold })} labelColor="yellow" />
              <StatCard title={t('home.products')} value={String(products.length)} label={t('home.productsLabel')} labelColor="green" />
            </View>

            <Text style={styles.section}>{t('home.recentProducts')}</Text>
            {recentProducts.length === 0 ? (
              <Text style={styles.empty}>{t('home.noProducts')}</Text>
            ) : (
              recentProducts.map(p => (
                <ProductItem
                  key={p.id}
                  name={p.nombre}
                  expiry={p.vencimiento ?? '—'}
                  stock={`${p.stock} ud.`}
                  imageUrl={p.imagen_url ?? undefined}
                />
              ))
            )}
          </>
        )}
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
    padding: 16,
    paddingTop: 48,
  },
  appName: { fontSize: 13, color: Colors.textSecondary, marginLeft: 12, marginTop: 4, fontFamily: 'Figtree_400Regular', letterSpacing: 0.5 },
  header: { fontSize: 22, marginLeft: 12, marginBottom: 8, fontFamily: 'Roboto_500Medium' },
  statsRow: { flexDirection: 'row' },
  section: { fontSize: 14, fontWeight: 'bold', marginTop: 20, marginBottom: 10, fontFamily: 'Figtree_400Regular' },
  empty: { color: '#888', textAlign: 'center', marginTop: 16 },
});
