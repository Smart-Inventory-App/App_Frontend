import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import StatCard from '@/components/StatCard';
import ScreenHeader from '@/components/ScreenHeader';
import ProductItem from '@/components/ProductItem';
import { Figtree_400Regular, useFonts } from '@expo-google-fonts/figtree';
import { Roboto_500Medium } from '@expo-google-fonts/roboto';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';
import { productService } from '@/services/productService';
import { profileService } from '@/services/profileService';
import { Product } from '@/types/product';

export default function HomeScreen() {
  useFonts({ Figtree_400Regular, Roboto_500Medium });
  const { t } = useTranslation();
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [coverageDaysThreshold, setLowStockThreshold] = useState(5);
  const [expiryDaysThreshold, setExpiryDaysThreshold] = useState(7);

  const fetchData = useCallback(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([productService.getProducts(), profileService.getProfile()])
      .then(([prods, profile]) => {
        setProducts(prods);
        setLowStockThreshold(profile.coverageDaysThreshold);
        setExpiryDaysThreshold(profile.expiryDaysThreshold);
        setDisplayName(profile.username || profile.firstName || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useFocusEffect(fetchData);

  const today = new Date();

  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const lowStock = products.filter(p => p.stock < (p.stock_minimo ?? coverageDaysThreshold)).length;
  const expiringSoon = products.filter(p => {
    if (!p.vencimiento) return false;
    const d = new Date(p.vencimiento);
    const days = p.dias_alerta_vencimiento ?? expiryDaysThreshold;
    const limit = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    return d >= today && d <= limit;
  }).length;
  const recentProducts = products.slice(0, 3);

  return (
    <>
      <ScreenHeader
        title={displayName ? `${t('home.welcome')}, ${displayName}` : t('home.welcome')}
        left={<Text style={styles.appName}>{t('common.appName')}</Text>}
      />
      <ScrollView style={styles.container}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard title={t('home.totalStock')} value={String(totalStock)} label={t('home.totalStockLabel')} labelColor="green" />
              <StatCard title={t('home.lowStock')} value={String(lowStock)} label={t('home.lowStockLabel', { days: coverageDaysThreshold })} labelColor="red" />
            </View>
            <View style={styles.statsRow}>
              <StatCard title={t('home.expiringSoon')} value={String(expiringSoon)} label={t('home.expiringSoonLabel', { days: expiryDaysThreshold })} labelColor="yellow" />
              <StatCard title={t('home.products')} value={String(products.length)} label={t('home.productsLabel')} labelColor="green" />
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(app)/faltantes')}>
                <Ionicons name="cart-outline" size={20} color={Colors.primary} />
                <Text style={styles.actionText}>{t('home.actionFaltantes')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(app)/reposicion')}>
                <Ionicons name="trending-up-outline" size={20} color={Colors.primary} />
                <Text style={styles.actionText}>{t('home.actionReposicion')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(app)/tendencias')}>
                <Ionicons name="stats-chart-outline" size={20} color={Colors.primary} />
                <Text style={styles.actionText}>{t('home.actionTendencias')}</Text>
              </TouchableOpacity>
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
  appName: { fontSize: 13, color: Colors.textSecondary, fontFamily: 'Figtree_400Regular', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionText: { fontSize: 11, color: Colors.textPrimary, fontFamily: 'Figtree_400Regular', textAlign: 'center' },
  section: { fontSize: 14, fontWeight: 'bold', marginTop: 20, marginBottom: 10, fontFamily: 'Figtree_400Regular' },
  empty: { color: '#888', textAlign: 'center', marginTop: 16 },
});
