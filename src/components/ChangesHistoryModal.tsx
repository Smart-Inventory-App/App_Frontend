import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import ProductDetailModal, { GeneralAlertRules } from '@/components/ProductDetailModal';
import RecentChangeRow, { CHANGE_ROW_HEIGHT } from '@/components/RecentChangeRow';
import ScreenHeader from '@/components/ScreenHeader';
import { productService } from '@/services/productService';
import { Product, StockChange } from '@/types/product';

// Cuántos cambios se muestran de una vez, y cuántos más se suman cada vez que se toca "Cargar más"
export const CHANGES_PAGE_SIZE = 10;

interface Props {
  visible: boolean;
  onClose: () => void;
  generalRules?: GeneralAlertRules | null;
}

// Pantalla completa con los últimos cambios de stock, de 10 en 10, con las mismas filas que el inicio.
export default function ChangesHistoryModal({ visible, onClose, generalRules }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [changes, setChanges] = useState<StockChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  // Para ignorar la respuesta de una carga vieja si la ventana se cerró y volvió a abrir
  const requestRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    const request = ++requestRef.current;
    setChanges([]);
    setHasMore(false);
    setError(null);
    setDetailProduct(null);
    setLoadingMore(false);
    setLoading(true);
    productService.getRecentChanges(CHANGES_PAGE_SIZE, 0)
      .then(page => {
        if (request !== requestRef.current) return;
        setChanges(page);
        setHasMore(page.length === CHANGES_PAGE_SIZE);
      })
      .catch(() => { if (request === requestRef.current) setError(t('home.changesError')); })
      .finally(() => { if (request === requestRef.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const loadMore = () => {
    if (loadingMore) return;
    const request = requestRef.current;
    setLoadingMore(true);
    setError(null);
    productService.getRecentChanges(CHANGES_PAGE_SIZE, changes.length)
      .then(page => {
        if (request !== requestRef.current) return;
        // Si entraron cambios nuevos mientras tanto, la página puede traer alguno que ya está en la lista
        setChanges(prev => {
          const known = new Set(prev.map(change => change.id));
          return [...prev, ...page.filter(change => !known.has(change.id))];
        });
        setHasMore(page.length === CHANGES_PAGE_SIZE);
      })
      .catch(() => { if (request === requestRef.current) setError(t('home.changesError')); })
      .finally(() => { if (request === requestRef.current) setLoadingMore(false); });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        <ScreenHeader
          title={t('home.history')}
          left={
            <TouchableOpacity testID="changes-history-back" accessibilityLabel={t('home.back')} onPress={onClose}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          }
        />
        <ScrollView
          testID="changes-history-list"
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
        >
          {loading && <ActivityIndicator testID="changes-history-loading" color={Colors.primary} style={styles.loading} />}
          {!loading && changes.length === 0 && !error && (
            <Text testID="changes-history-empty" style={styles.empty}>{t('home.noChanges')}</Text>
          )}
          {changes.map(change => (
            <RecentChangeRow key={change.id} change={change} onPress={setDetailProduct} height={CHANGE_ROW_HEIGHT} />
          ))}
          {error && <Text testID="changes-history-error" style={styles.error}>{error}</Text>}
          {!loading && hasMore && (
            <TouchableOpacity
              testID="changes-load-more"
              style={[styles.moreBtn, loadingMore && styles.moreBtnDisabled]}
              disabled={loadingMore}
              onPress={loadMore}
            >
              {loadingMore
                ? <ActivityIndicator testID="changes-more-loading" size="small" color={Colors.primary} />
                : <Text style={styles.moreBtnText}>{t('home.loadMore')}</Text>}
            </TouchableOpacity>
          )}
        </ScrollView>
        {/* Sin el botón "Stock total": acá solo se mira la información del producto */}
        <ProductDetailModal product={detailProduct} generalRules={generalRules} onClose={() => setDetailProduct(null)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f3f6' },
  container: { flex: 1, backgroundColor: '#f2f3f6' },
  content: { padding: 16 },
  loading: { marginTop: 24 },
  empty: { color: '#888', textAlign: 'center', marginTop: 24 },
  error: { color: Colors.inputBorderError, fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 4 },
  moreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  moreBtnDisabled: { opacity: 0.6 },
  moreBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
});
