import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import AppTextInput from '@/components/AppTextInput';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import ProductDetailModal, { GeneralAlertRules } from '@/components/ProductDetailModal';
import ProductLotRow, { LOT_ROW_HEIGHT } from '@/components/ProductLotRow';
import ScreenHeader from '@/components/ScreenHeader';
import { productService } from '@/services/productService';
import { Product, ProductGroupDetail, ProductGroupKey, ProductGroupSummary } from '@/types/product';

const NAME_MAX = 60;
const MIN_QUERY = 2;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Si se indica, se abre directamente con el stock total de ese producto (viene de su ventana de información). */
  initial?: ProductGroupKey | null;
  generalRules?: GeneralAlertRules | null;
}

// Pantalla completa "Stock total de producto": se busca un producto por nombre y se ve la suma del stock de todos
// los productos con ese nombre y categoría (de cualquier marca). Cada producto del listado se puede incluir o sacar
// de la suma con su casilla.
export default function StockTotalModal({ visible, onClose, initial, generalRules }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ProductGroupSummary[]>([]);
  const [searched, setSearched] = useState(false);
  const [group, setGroup] = useState<ProductGroupDetail | null>(null);
  // Productos del listado que entran en la suma (al principio, todos)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  // Para ignorar la respuesta de una búsqueda vieja si el usuario ya eligió o escribió otra cosa
  const requestRef = useRef(0);

  const loadGroup = (key: ProductGroupKey) => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    productService.getProductGroup(key)
      .then(detail => {
        if (request !== requestRef.current) return;
        setGroup(detail);
        setSelectedIds(new Set(detail.productos.map(product => product.id)));
      })
      .catch(() => { if (request === requestRef.current) setError(t('stockTotal.loadError')); })
      .finally(() => { if (request === requestRef.current) setLoading(false); });
  };

  useEffect(() => {
    if (!visible) return;
    requestRef.current++;
    setSuggestions([]);
    setSearched(false);
    setGroup(null);
    setError(null);
    setDetailProduct(null);
    setLoading(false);
    setQuery(initial?.nombre ?? '');
    if (initial) loadGroup(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Sugerencias de productos mientras el usuario escribe el nombre
  useEffect(() => {
    if (!visible || group || loading) return;
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setSuggestions([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      productService.suggestGroups(q)
        .then(found => { if (!cancelled) { setSuggestions(found); setSearched(true); } })
        .catch(() => { if (!cancelled) { setSuggestions([]); setSearched(false); } });
    }, 300);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query, group, loading, visible]);

  const handleQueryChange = (value: string) => {
    requestRef.current++;
    setQuery(value);
    setGroup(null);
    setError(null);
    setLoading(false);
  };

  const handlePick = (suggestion: ProductGroupSummary) => {
    setQuery(suggestion.nombre);
    setSuggestions([]);
    loadGroup(suggestion);
  };

  const toggleProduct = (product: Product) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(product.id)) next.delete(product.id);
      else next.add(product.id);
      return next;
    });
  };

  const units = (n: number) => t(n === 1 ? 'detail.unitOne' : 'detail.unitMany', { count: n });

  const renderSuggestions = () => (
    <View testID="stock-total-suggestions" style={styles.suggestionsBox}>
      {suggestions.map((s, index) => (
        <TouchableOpacity
          key={`${s.nombre}-${s.categoria}`}
          testID={`stock-total-suggestion-${index}`}
          style={styles.suggestionItem}
          onPress={() => handlePick(s)}
        >
          <Ionicons name="cube-outline" size={14} color={Colors.textSecondary} />
          <View style={styles.suggestionTextBox}>
            <Text style={styles.suggestionText}>{s.nombre}</Text>
            <Text style={styles.suggestionSubtext}>{s.categoria} · {t('stockTotal.total')}: {s.stock_total}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  // El stock total y la cantidad de productos se calculan con los que están marcados
  const renderSummary = (detail: ProductGroupDetail) => {
    const included = detail.productos.filter(product => selectedIds.has(product.id));
    const totalStock = included.reduce((sum, product) => sum + product.stock, 0);
    return (
      <>
        <View testID="stock-total-summary" style={styles.summary}>
          <Text testID="stock-total-nombre" style={styles.summaryName}>{detail.nombre}</Text>
          <Text testID="stock-total-categoria" style={styles.summarySub}>{t('product.categoria')}: {detail.categoria}</Text>
          <Text style={styles.totalLabel}>{t('stockTotal.total')}</Text>
          <Text testID="stock-total-value" style={styles.totalValue}>{units(totalStock)}</Text>
          <Text testID="stock-total-lots" style={styles.summarySub}>
            {t(included.length === 1 ? 'stockTotal.lotOne' : 'stockTotal.lotMany', { count: included.length })}
          </Text>
        </View>
        <Text style={styles.listTitle}>{t('stockTotal.listTitle')}</Text>
      </>
    );
  };

  // Lo único que se desplaza en la pantalla: los productos encontrados
  const renderLots = (detail: ProductGroupDetail) => (
    <ScrollView
      testID="stock-total-lots-scroll"
      style={styles.lots}
      contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      {detail.productos.map(product => (
        <ProductLotRow
          key={product.id}
          product={product}
          onPress={setDetailProduct}
          selected={selectedIds.has(product.id)}
          onToggle={toggleProduct}
          height={LOT_ROW_HEIGHT}
        />
      ))}
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <ScreenHeader
          title={t('stockTotal.title')}
          left={
            <TouchableOpacity testID="stock-total-back" accessibilityLabel={t('stockTotal.back')} onPress={onClose}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          }
        />
        {/* El nombre del producto y su información quedan fijos; con el producto elegido solo se desplaza el listado */}
        <View style={[styles.container, styles.content]}>
          <Text style={styles.label}>{t('stockTotal.nameLabel')}</Text>
          <AppTextInput
            testID="stock-total-input"
            style={styles.input}
            placeholder={t('stockTotal.namePlaceholder')}
            placeholderTextColor={Colors.placeholder}
            value={query}
            onChangeText={handleQueryChange}
            maxLength={NAME_MAX}
          />
          {error && <Text testID="stock-total-error" style={styles.errorText}>{error}</Text>}
          {group ? (
            <>
              {renderSummary(group)}
              {renderLots(group)}
            </>
          ) : (
            <KeyboardAwareScrollView
              testID="stock-total-search-scroll"
              style={styles.lots}
              contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
            >
              {!loading && suggestions.length > 0 && renderSuggestions()}
              {!loading && searched && suggestions.length === 0 && (
                <Text testID="stock-total-no-results" style={styles.hint}>{t('stockTotal.noResults')}</Text>
              )}
              {loading && <ActivityIndicator testID="stock-total-loading" color={Colors.primary} style={styles.loading} />}
            </KeyboardAwareScrollView>
          )}
        </View>
        {/* Sin el botón "Stock total": ya se está viendo el stock total */}
        <ProductDetailModal product={detailProduct} generalRules={generalRules} onClose={() => setDetailProduct(null)} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f3f6' },
  container: { flex: 1, backgroundColor: '#f2f3f6' },
  content: { padding: 16, paddingBottom: 0 },
  lots: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: '#fff',
    marginTop: 4,
  },
  suggestionsBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.inputBorder ?? '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionTextBox: { flex: 1 },
  suggestionText: { fontSize: 14, color: Colors.textPrimary },
  suggestionSubtext: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  hint: { fontSize: 13, color: Colors.textSecondary, marginTop: 10 },
  loading: { marginTop: 24 },
  errorText: { color: Colors.inputBorderError, fontSize: 13, marginTop: 12 },
  summary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    elevation: 1,
  },
  summaryName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  summarySub: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  totalLabel: { fontSize: 12, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14 },
  totalValue: { fontSize: 28, fontWeight: '700', color: Colors.primary, marginTop: 2 },
  listTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
});
