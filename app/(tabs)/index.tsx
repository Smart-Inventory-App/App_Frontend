import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import StatCard from '@/components/StatCard';
import { AlertTypeFilter, requestAlertFilter } from '@/utils/alertFilterRequest';
import HomeHeader from '@/components/HomeHeader';
import ChangesHistoryModal from '@/components/ChangesHistoryModal';
import TrendsModal from '@/components/TrendsModal';
import ProductDetailModal, { GeneralAlertRules } from '@/components/ProductDetailModal';
import ProductLotRow from '@/components/ProductLotRow';
import RecentChangeRow, { CHANGE_ROW_HEIGHT } from '@/components/RecentChangeRow';
import { Figtree_400Regular, useFonts } from '@expo-google-fonts/figtree';
import { Roboto_500Medium } from '@expo-google-fonts/roboto';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';
import { productService } from '@/services/productService';
import { alertService, AlertSummary } from '@/services/alertService';
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
  const [trendsVisible, setTrendsVisible] = useState(false);
  // Los productos vencidos o por vencer y los que están bajo su stock mínimo salen de las alertas: son los mismos números
  // que el Centro de Alertas
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);

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
      alertService.getSummaryAlerts().catch(() => null),
    ])
      .then(([prods, profile, recentChanges, summary]) => {
        setProducts(prods);
        setAlertSummary(summary);
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
  // Sin el resumen de alertas (si no se pudo cargar) se muestra un guion antes que un número que no coincida
  const alertCount = (count?: number) => (count == null ? '–' : formatThousands(count));
  // El listado llega del más nuevo al más viejo
  const recentProducts = products.slice(0, RECENT_PRODUCTS);
  const generalRules: GeneralAlertRules = { coverageDays: coverageDaysThreshold, expiryDays: expiryDaysThreshold };

  const goToInventory = () => router.navigate('/(tabs)/inventario');
  const goToAlerts = (filter: AlertTypeFilter) => {
    requestAlertFilter(filter);
    router.navigate('/(tabs)/alertas');
  };

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
                labelSolid
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
                value={alertCount(alertSummary?.expiring)}
                label={t('home.expiringSoonLabel')}
                labelColor="yellow"
                onPress={() => goToAlerts('Vencimiento')}
              />
              <StatCard
                testID="stat-low"
                icon="trending-down"
                title={t('home.lowStock')}
                value={alertCount(alertSummary?.low_stock)}
                label={t('home.lowStockLabel')}
                labelColor="red"
                labelSolid
                onPress={() => goToAlerts('Stock')}
              />
            </View>

            {/* Tendencias de consumo: un botón ancho debajo de los cuatro principales, con el mismo formato que ellos */}
            <TouchableOpacity testID="home-trends" style={styles.trendsCard} activeOpacity={0.8} onPress={() => setTrendsVisible(true)}>
              <View style={styles.trendsIcon}>
                <Ionicons name="stats-chart" size={22} color={Colors.primary} />
              </View>
              <View style={styles.trendsText}>
                <Text style={styles.trendsTitle}>{t('home.actionTendencias')}</Text>
                <Text style={styles.trendsSubtitle}>{t('home.trendsSubtitle')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.placeholder} />
            </TouchableOpacity>

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
      <TrendsModal visible={trendsVisible} onClose={() => setTrendsVisible(false)} />
      <ChangesHistoryModal visible={historyVisible} generalRules={generalRules} onClose={() => setHistoryVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f3f6' },
  content: { padding: 12, paddingTop: 16, paddingBottom: 32 },
  statsRow: { flexDirection: 'row' },
  trendsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 6,
    marginHorizontal: 6,
    elevation: 3,
    shadowColor: '#1B3A8F',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  trendsIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2CC4B422', alignItems: 'center', justifyContent: 'center' },
  trendsText: { flex: 1 },
  trendsTitle: { fontSize: 16, color: Colors.textPrimary, fontFamily: 'Roboto_500Medium' },
  trendsSubtitle: { fontSize: 12, color: Colors.textSecondary, fontFamily: 'Figtree_400Regular', marginTop: 2 },
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
