import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import StatCard from '@/components/StatCard';
import HomeHeader from '@/components/HomeHeader';
import ChangesHistoryModal from '@/components/ChangesHistoryModal';
import ProductDetailModal, { GeneralAlertRules } from '@/components/ProductDetailModal';
import ProductLotRow from '@/components/ProductLotRow';
import RecentChangeRow, { CHANGE_ROW_HEIGHT } from '@/components/RecentChangeRow';
import { Figtree_400Regular, useFonts } from '@expo-google-fonts/figtree';
import { Roboto_500Medium } from '@expo-google-fonts/roboto';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';
import { productService } from '@/services/productService';
import { profileService } from '@/services/profileService';
import { Product, StockChange } from '@/types/product';
import { formatThousands } from '@/utils/numbers';
import { markWelcomeSeen, shouldWelcome } from '@/utils/welcomeState';

const LAST_CHANGES = 5;
const RECENT_PRODUCTS = 3;
// Alto de cada fila de los listados: todas las de un mismo listado miden lo mismo

export default function HomeScreen() {
  useFonts({ Figtree_400Regular, Roboto_500Medium });
  const { t } = useTranslation();
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [changes, setChanges] = useState<StockChange[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [coverageDaysThreshold, setLowStockThreshold] = useState(5);
  const [expiryDaysThreshold, setExpiryDaysThreshold] = useState(7);
  const [welcome, setWelcome] = useState(shouldWelcome());
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);

  // "Bienvenido" al entrar a la app; si el usuario cambia de pantalla y vuelve, "Tu estado"
  useFocusEffect(useCallback(() => {
    setWelcome(shouldWelcome());
    return () => markWelcomeSeen();
  }, []));

  const fetchData = useCallback(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      productService.getProducts(),
      profileService.getProfile(),
      productService.getRecentChanges(LAST_CHANGES).catch(() => [] as StockChange[]),
    ])
      .then(([prods, profile, recentChanges]) => {
        setProducts(prods);
        setChanges(recentChanges);
        setLowStockThreshold(profile.coverageDaysThreshold);
        setExpiryDaysThreshold(profile.expiryDaysThreshold);
        // Se saluda con el nombre de la persona, nunca con su usuario
        setDisplayName(profile.firstName?.trim() || '');
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
  // El listado llega del más nuevo al más viejo
  const recentProducts = products.slice(0, RECENT_PRODUCTS);
  const generalRules: GeneralAlertRules = { coverageDays: coverageDaysThreshold, expiryDays: expiryDaysThreshold };

  const goToInventory = () => router.navigate('/(tabs)/inventario');
  const goToAlerts = () => router.navigate('/(tabs)/alertas');

  return (
    <>
      <HomeHeader greeting={t(welcome ? 'home.welcome' : 'home.status')} name={displayName} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard
                testID="stat-products"
                icon="cube"
                accent={Colors.primaryDark}
                title={t('home.products')}
                value={formatThousands(products.length)}
                label={t('home.productsLabel')}
                labelColor="green"
                onPress={goToInventory}
              />
              <StatCard
                testID="stat-stock"
                icon="layers"
                accent={Colors.primary}
                title={t('home.totalStock')}
                value={formatThousands(totalStock)}
                label={t('home.totalStockLabel')}
                labelColor="green"
                onPress={goToInventory}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                testID="stat-expiring"
                icon="time"
                title={t('home.expiringSoon')}
                value={formatThousands(expiringSoon)}
                label={t('home.expiringSoonLabel', { days: expiryDaysThreshold })}
                labelColor="yellow"
                onPress={goToAlerts}
              />
              <StatCard
                testID="stat-low"
                icon="trending-down"
                title={t('home.lowStock')}
                value={formatThousands(lowStock)}
                label={t('home.lowStockLabel', { days: coverageDaysThreshold })}
                labelColor="red"
                onPress={goToAlerts}
              />
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

            <View style={styles.sectionRow}>
              <Text testID="home-section-changes" style={styles.section}>{t('home.lastChanges')}</Text>
              <TouchableOpacity testID="home-changes-more" style={styles.more} onPress={() => setHistoryVisible(true)}>
                <Ionicons name="chevron-forward" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {changes.length === 0 ? (
              <Text style={styles.empty}>{t('home.noChanges')}</Text>
            ) : (
              changes.map(change => (
                <RecentChangeRow key={change.id} change={change} onPress={setDetailProduct} height={CHANGE_ROW_HEIGHT} />
              ))
            )}

            <View style={styles.sectionRow}>
              <Text testID="home-section-recent" style={styles.section}>{t('home.recentProducts')}</Text>
              <TouchableOpacity testID="home-recent-more" style={styles.more} onPress={goToInventory}>
                <Ionicons name="chevron-forward" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {recentProducts.length === 0 ? (
              <Text style={styles.empty}>{t('home.noProducts')}</Text>
            ) : (
              recentProducts.map(p => (
                <ProductLotRow key={p.id} product={p} onPress={setDetailProduct} showLoadDate />
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Información del producto, sin el botón "Stock total": eso es solo de Inventario */}
      <ProductDetailModal product={detailProduct} generalRules={generalRules} onClose={() => setDetailProduct(null)} />
      <ChangesHistoryModal visible={historyVisible} generalRules={generalRules} onClose={() => setHistoryVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f3f6' },
  content: { padding: 12, paddingTop: 16, paddingBottom: 32 },
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 6,
    marginHorizontal: 6,
  },
  section: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Figtree_400Regular',
  },
  more: { padding: 4 },
  empty: { color: '#888', textAlign: 'center', marginTop: 8, marginBottom: 8 },
});
