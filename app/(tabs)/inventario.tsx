import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { productService } from '@/services/productService';
import { Product, ProductCreate } from '@/types/product';
import ProductFormFields from '@/components/ProductFormFields';
import HistorialModal from '@/components/HistorialModal';

export default function InventarioScreen() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);
  const [selectedUbicacion, setSelectedUbicacion] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [historialProduct, setHistorialProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProductCreate>>({});
  const [saving, setSaving] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{ categorias: string[]; ubicaciones: string[]; marcas: string[] }>({
    categorias: [],
    ubicaciones: [],
    marcas: [],
  });
  const [extraUbicaciones, setExtraUbicaciones] = useState<string[]>([]);
  const [extraCategorias, setExtraCategorias] = useState<string[]>([]);
  const [extraMarcas, setExtraMarcas] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'nombre' | 'stock' | 'vencimiento' | 'categoria' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Debounce search input before hitting the backend
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await productService.getProducts({
        search: search || undefined,
        categoria: selectedCategoria ?? undefined,
        ubicacion: selectedUbicacion ?? undefined,
        sort_by: sortField ?? undefined,
        sort_dir: sortDir,
      });
      setProducts(data);
    } catch {
      Alert.alert('Error', t('inventory.loadError'));
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategoria, selectedUbicacion, sortField, sortDir, t]);

  const loadFilterOptions = useCallback(async () => {
    try {
      setFilterOptions(await productService.getFilterOptions());
    } catch {
      // filter chips are non-critical, ignore failures
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useFocusEffect(useCallback(() => { loadFilterOptions(); }, [loadFilterOptions]));

  const categories = useMemo(() => {
    return [...new Set([...filterOptions.categorias, ...extraCategorias])];
  }, [filterOptions.categorias, extraCategorias]);

  const ubicaciones = useMemo(() => {
    return [...new Set([...filterOptions.ubicaciones, ...extraUbicaciones])];
  }, [filterOptions.ubicaciones, extraUbicaciones]);

  const marcas = useMemo(() => {
    return [...new Set([...filterOptions.marcas, ...extraMarcas])];
  }, [filterOptions.marcas, extraMarcas]);

  const handleSearch = (text: string) => setSearchInput(text);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortField(null); setSortDir('asc'); }
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleDelete = (product: Product) => {
    Alert.alert(
      t('inventory.deleteTitle'),
      t('inventory.deleteConfirm', { name: product.nombre }),
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: t('inventory.deleteTitle'),
          style: 'destructive',
          onPress: async () => {
            try {
              await productService.deleteProduct(product.id);
              setProducts(prev => prev.filter(p => p.id !== product.id));
              loadFilterOptions();
            } catch {
              Alert.alert('Error', t('inventory.deleteError'));
            }
          },
        },
      ]
    );
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      nombre: product.nombre,
      marca: product.marca,
      categoria: product.categoria,
      stock: product.stock,
      vencimiento: product.vencimiento,
      descripcion: product.descripcion,
      ubicacion: product.ubicacion,
      imagen_url: product.imagen_url,
      stock_minimo: product.stock_minimo,
      dias_alerta_vencimiento: product.dias_alerta_vencimiento,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    setSaving(true);
    try {
      const updated = await productService.updateProduct(editingProduct.id, editForm);
      setProducts(prev => prev.map(p => (p.id === updated.id ? updated : p)));
      setEditingProduct(null);
      loadFilterOptions();
    } catch {
      Alert.alert('Error', t('inventory.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (product: Product) => {
    if (!product.vencimiento) return 'green';
    const daysLeft = Math.ceil(
      (new Date(product.vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft <= 3) return 'red';
    if (daysLeft <= 7) return 'yellow';
    return 'green';
  };

  const renderItem = ({ item }: { item: Product }) => {
    const color = getStatusColor(item);
    const labelStyle = [
      styles.dotLabel,
      color === 'green' && styles.labelGreen,
      color === 'yellow' && styles.labelYellow,
      color === 'red' && styles.labelRed,
    ];
    return (
      <View style={styles.item}>
        <Image
          source={item.imagen_url ? { uri: item.imagen_url } : require('../../assets/icon.png')}
          style={styles.itemImage}
        />
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.nombre}</Text>
          {item.marca ? <Text style={styles.itemSub}>{item.marca}</Text> : null}
          <Text style={styles.itemSub}>{t('inventory.filterCategory')}: {item.categoria}</Text>
          {item.ubicacion ? (
            <Text style={styles.itemSub}>
              <Ionicons name="location-outline" size={11} /> {item.ubicacion}
            </Text>
          ) : null}
          <View style={styles.itemRow}>
            <Text style={styles.itemDetail}>Stock: {item.stock}</Text>
            {item.vencimiento ? (
              <Text style={styles.itemDetail}>Vence: {item.vencimiento}</Text>
            ) : null}
            <View style={labelStyle} />
          </View>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
            <Ionicons name="pencil" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setHistorialProduct(item)} style={styles.actionBtn}>
            <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
            <Ionicons name="trash" size={18} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const hasActiveFilters = !!(searchInput || selectedCategoria || selectedUbicacion);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('inventory.title')}</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color={Colors.placeholder} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('inventory.search')}
          placeholderTextColor={Colors.placeholder}
          value={searchInput}
          onChangeText={handleSearch}
        />
        {searchInput.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.placeholder} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sortRow}>
        <Ionicons name="swap-vertical-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.sortLabel}>{t('inventory.sortBy')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={[styles.chipsContent, { paddingLeft: 0 }]}
        >
          {(['nombre', 'stock', 'vencimiento', 'categoria'] as const).map(field => {
            const active = sortField === field;
            const arrow = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
            return (
              <TouchableOpacity
                key={field}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => handleSort(field)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(`inventory.sort_${field}`)}
                  {arrow}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {categories.length > 0 && (
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>{t('inventory.filterCategory')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            <TouchableOpacity
              style={[styles.chip, !selectedCategoria && styles.chipActive]}
              onPress={() => setSelectedCategoria(null)}
            >
              <Text style={[styles.chipText, !selectedCategoria && styles.chipTextActive]}>
                {t('inventory.allCategories')}
              </Text>
            </TouchableOpacity>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, selectedCategoria === cat && styles.chipActive]}
                onPress={() => setSelectedCategoria(prev => prev === cat ? null : cat)}
              >
                <Text style={[styles.chipText, selectedCategoria === cat && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {ubicaciones.length > 0 && (
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>{t('inventory.filterLocation')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            <TouchableOpacity
              style={[styles.chip, !selectedUbicacion && styles.chipActive]}
              onPress={() => setSelectedUbicacion(null)}
            >
              <Text style={[styles.chipText, !selectedUbicacion && styles.chipTextActive]}>
                {t('inventory.allLocations')}
              </Text>
            </TouchableOpacity>
            {ubicaciones.map(loc => (
              <TouchableOpacity
                key={loc}
                style={[styles.chip, selectedUbicacion === loc && styles.chipActive]}
                onPress={() => setSelectedUbicacion(prev => prev === loc ? null : loc)}
              >
                <Text style={[styles.chipText, selectedUbicacion === loc && styles.chipTextActive]}>
                  {loc}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : products.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cube-outline" size={48} color={Colors.placeholder} />
          <Text style={styles.emptyText}>
            {hasActiveFilters ? t('inventory.noResults') : t('inventory.empty')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
        />
      )}

      <Modal visible={!!editingProduct} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('inventory.editTitle')}</Text>
              <TouchableOpacity onPress={() => setEditingProduct(null)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <ProductFormFields
                form={editForm}
                onChange={setEditForm}
                ubicacionOptions={ubicaciones}
                onAddUbicacion={loc => setExtraUbicaciones(prev => [...new Set([...prev, loc])])}
                categoriaOptions={categories}
                onAddCategoria={cat => setExtraCategorias(prev => [...new Set([...prev, cat])])}
                marcaOptions={marcas}
                onAddMarca={marca => setExtraMarcas(prev => [...new Set([...prev, marca])])}
              />
            </ScrollView>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSaveEdit}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? t('inventory.saving') : t('inventory.saveChanges')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <HistorialModal
        product={historialProduct}
        visible={!!historialProduct}
        onClose={() => setHistorialProduct(null)}
        onChanged={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f3f6' },
  header: { backgroundColor: '#fff', padding: 16, paddingTop: 48 },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.textPrimary },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 1,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 4,
  },
  sortLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterRow: { marginBottom: 4 },
  filterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 4,
    marginTop: 6,
  },
  chipsScroll: { flexGrow: 0 },
  chipsContent: { paddingHorizontal: 16, paddingBottom: 4, gap: 8, flexDirection: 'row' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.inputBorder ?? '#ddd',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  item: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
  },
  itemImage: { width: 44, height: 44, borderRadius: 8, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: 'bold', color: Colors.textPrimary },
  itemSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 12 },
  itemDetail: { fontSize: 12, color: Colors.textSecondary },
  itemActions: { flexDirection: 'column', gap: 8 },
  actionBtn: { padding: 6 },
  dotLabel: { width: 10, height: 10, borderRadius: 5 },
  labelGreen: { backgroundColor: '#2db7a3' },
  labelYellow: { backgroundColor: '#fbbc05' },
  labelRed: { backgroundColor: '#e5484d' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: Colors.textSecondary, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.textPrimary },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
