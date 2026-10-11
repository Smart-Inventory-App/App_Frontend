import React, { useCallback, useState, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { productService } from '@/services/productService';
import { ProductCreate, ProductSuggestion } from '@/types/product';
import ProductFormFields from '@/components/ProductFormFields';
import ScreenHeader from '@/components/ScreenHeader';
import { isValidBarcode } from '@/utils/barcode';
import ScanModal, { ScanSuccessKind } from '@/components/ScanModal';

const SALIDA_NOTA_MAX = 50;

const EMPTY_FORM = (): Partial<ProductCreate> => ({});

type Direction = 'entrada' | 'salida';

export default function CargarScreen() {
  const { t } = useTranslation();
  const [direction, setDirection] = useState<Direction>('entrada');
  const [form, setForm] = useState<Partial<ProductCreate>>(EMPTY_FORM());
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ubicacionOptions, setUbicacionOptions] = useState<string[]>([]);
  const [categoriaOptions, setCategoriaOptions] = useState<string[]>([]);
  const [marcaOptions, setMarcaOptions] = useState<string[]>([]);
  const [merged, setMerged] = useState(false);
  const [scanVisible, setScanVisible] = useState(false);
  const [scanSuccessKind, setScanSuccessKind] = useState<ScanSuccessKind | null>(null);

  const [salidaQuery, setSalidaQuery] = useState('');
  const [salidaSuggestions, setSalidaSuggestions] = useState<ProductSuggestion[]>([]);
  const [salidaSelected, setSalidaSelected] = useState<ProductSuggestion | null>(null);
  const [salidaCantidad, setSalidaCantidad] = useState('');
  const [salidaMotivo, setSalidaMotivo] = useState<'consumed' | 'expired'>('consumed');
  const [salidaNota, setSalidaNota] = useState('');

  const applyDefaults = useCallback(() => {
    productService.getDefaults()
      .then(({ last_categoria, last_ubicacion }) => {
        setForm(prev => ({
          ...prev,
          categoria: prev.categoria ?? last_categoria ?? undefined,
          ubicacion: prev.ubicacion ?? last_ubicacion ?? undefined,
        }));
      })
      .catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => {
    productService.getFilterOptions()
      .then(({ categorias, ubicaciones, marcas }) => {
        setCategoriaOptions(categorias);
        setUbicacionOptions(ubicaciones);
        setMarcaOptions(marcas);
      })
      .catch(() => {});
    applyDefaults();
  }, [applyDefaults]));

  useEffect(() => {
    if (salidaSelected) return;
    const q = salidaQuery.trim();
    if (q.length < 2) {
      setSalidaSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      productService.suggestProducts(q).then(setSalidaSuggestions).catch(() => setSalidaSuggestions([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [salidaQuery, salidaSelected]);

  const validate = (): string | null => {
    if (!form.nombre?.trim()) return t('product.validationNombre');
    if (!form.categoria?.trim()) return t('product.validationCategoria');
    if (form.stock === undefined || isNaN(form.stock) || form.stock <= 0) return t('product.validationStock');
    if (form.vencimiento) {
      const d = new Date(form.vencimiento);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.vencimiento) || isNaN(d.getTime())) {
        return t('product.validationVencimiento');
      }
    }
    if (form.codigo_barras && !isValidBarcode(form.codigo_barras)) return t('product.validationCodigoBarras');
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await productService.createProduct(form as ProductCreate);
      setMerged(Boolean(created.merged));
      setSuccess(true);
    } catch (err: unknown) {
      const detail = (err as any)?.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((e: any) => e.msg ?? JSON.stringify(e)).join('\n'));
      } else {
        const msg = (err as any)?.message;
        setError(msg ?? t('product.saveError'));
      }
    } finally {
      setSaving(false);
    }
  };

  const validateSalida = (): string | null => {
    if (!salidaSelected) return t('product.validationSalidaProducto');
    const n = Number(salidaCantidad);
    if (!salidaCantidad || isNaN(n) || n <= 0) return t('product.validationSalidaCantidad');
    return null;
  };

  const handleSalidaSubmit = async () => {
    const validationError = validateSalida();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await productService.registerEvent(salidaSelected!.id, Number(salidaCantidad), salidaMotivo, salidaNota);
      setMerged(false);
      setSuccess(true);
    } catch (err: unknown) {
      const detail = (err as any)?.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((e: any) => e.msg ?? JSON.stringify(e)).join('\n'));
      } else {
        const msg = (err as any)?.message;
        setError(msg ?? t('product.saveError'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLoadAnother = () => {
    setForm(EMPTY_FORM());
    setSalidaQuery('');
    setSalidaSelected(null);
    setSalidaCantidad('');
    setSalidaMotivo('consumed');
    setSalidaNota('');
    setSuccess(false);
    setMerged(false);
    setScanSuccessKind(null);
    setError(null);
  };

  const handleScanSuccess = (kind: ScanSuccessKind) => {
    setScanSuccessKind(kind);
    setMerged(kind === 'merged');
    setSuccess(true);
  };

  const scanSuccessMessage = (): string => {
    switch (scanSuccessKind) {
      case 'merged': return t('product.successMsgMerged');
      case 'updated': return t('scan.successUpdated');
      case 'salida': return t('product.successMsgSalida');
      default: return t('scan.successCreated');
    }
  };

  const handleSelectDirection = (d: Direction) => {
    setDirection(d);
    setError(null);
  };

  const handleAddUbicacion = (loc: string) => {
    setUbicacionOptions(prev => [...new Set([...prev, loc])]);
  };

  const handleAddCategoria = (cat: string) => {
    setCategoriaOptions(prev => [...new Set([...prev, cat])]);
  };

  const handleAddMarca = (marca: string) => {
    setMarcaOptions(prev => [...new Set([...prev, marca])]);
  };

  const pickSalidaSuggestion = (s: ProductSuggestion) => {
    setSalidaSelected(s);
    setSalidaQuery(s.nombre + (s.marca ? ` · ${s.marca}` : ''));
    setSalidaSuggestions([]);
  };

  const onSalidaQueryChange = (v: string) => {
    setSalidaQuery(v);
    setSalidaSelected(null);
  };

  if (success) {
    return (
      <View style={styles.successContainer}>
        <Ionicons name="checkmark-circle" size={72} color={Colors.primary} />
        <Text style={styles.successTitle}>{t('product.successTitle')}</Text>
        <Text style={styles.successMsg}>
          {scanSuccessKind
            ? scanSuccessMessage()
            : direction === 'salida'
              ? t('product.successMsgSalida')
              : merged ? t('product.successMsgMerged') : t('product.successMsg')}
        </Text>
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={() => router.replace('/(tabs)/inventario')}
        >
          <Text style={styles.submitBtnText}>{t('product.goToInventory')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleLoadAnother}>
          <Text style={styles.secondaryBtnText}>
            {direction === 'salida' ? t('product.registerAnother') : t('product.loadAnother')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title={t('product.loadTitle')}
        keepTitleWhole
        right={
          <View testID="direction-row" style={styles.directionRow}>
            <TouchableOpacity
              testID="direction-entrada"
            style={[styles.directionBtn, direction === 'entrada' && styles.directionBtnActive]}
              onPress={() => handleSelectDirection('entrada')}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.directionBtnText, direction === 'entrada' && styles.directionBtnTextActive]}>
                {t('product.entrada')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.directionBtn, direction === 'salida' && styles.directionBtnActiveSalida]}
              onPress={() => handleSelectDirection('salida')}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.directionBtnText, direction === 'salida' && styles.directionBtnTextActive]}>
                {t('product.salida')}
              </Text>
            </TouchableOpacity>
          </View>
        }
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {direction === 'entrada' ? (
          <>
          <TouchableOpacity style={styles.scanBtn} onPress={() => setScanVisible(true)} testID="open-scan-modal">
            <Ionicons name="camera-outline" size={18} color={Colors.primary} />
            <Text style={styles.scanBtnText}>{t('scan.openButton')}</Text>
          </TouchableOpacity>
          <ProductFormFields
            form={form}
            onChange={setForm}
            ubicacionOptions={ubicacionOptions}
            onAddUbicacion={handleAddUbicacion}
            categoriaOptions={categoriaOptions}
            onAddCategoria={handleAddCategoria}
            marcaOptions={marcaOptions}
            onAddMarca={handleAddMarca}
            suggestNombre={productService.suggestProducts}
          />
          </>
        ) : (
          <View style={styles.container}>
            <Text style={styles.label}>{t('product.salidaProducto')} *</Text>
            <TextInput
              style={styles.input}
              placeholder={t('product.salidaProductoPlaceholder')}
              placeholderTextColor={Colors.placeholder}
              value={salidaQuery}
              onChangeText={onSalidaQueryChange}
            />
            {!salidaSelected && salidaSuggestions.length > 0 && (
              <View style={styles.suggestionsBox}>
                {salidaSuggestions.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.suggestionItem}
                    onPress={() => pickSalidaSuggestion(s)}
                  >
                    <Ionicons name="cube-outline" size={14} color={Colors.textSecondary} />
                    <View>
                      <Text style={styles.suggestionText}>
                        {s.nombre}{s.marca ? ` · ${s.marca}` : ''}
                      </Text>
                      <Text style={styles.suggestionSubtext}>
                        {s.vencimiento ? `Vence ${s.vencimiento}` : 'Sin vencimiento'} · Stock: {s.stock}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>{t('product.salidaCantidad')} *</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={Colors.placeholder}
              keyboardType="numeric"
              maxLength={6}
              value={salidaCantidad}
              onChangeText={v => setSalidaCantidad(v.replace(/[^0-9]/g, ''))}
            />

            <Text style={styles.label}>{t('product.salidaMotivo')} *</Text>
            <View style={styles.chipsContent}>
              <TouchableOpacity
                style={[styles.chip, salidaMotivo === 'consumed' && styles.chipActive]}
                onPress={() => setSalidaMotivo('consumed')}
              >
                <Text style={[styles.chipText, salidaMotivo === 'consumed' && styles.chipTextActive]}>
                  {t('product.salidaMotivoConsumido')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, salidaMotivo === 'expired' && styles.chipActive]}
                onPress={() => setSalidaMotivo('expired')}
              >
                <Text style={[styles.chipText, salidaMotivo === 'expired' && styles.chipTextActive]}>
                  {t('product.salidaMotivoVencido')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.labelRow}>
              <Text style={styles.labelInRow}>{t('product.historialNotaPlaceholder')}</Text>
              <Text testID="salida-nota-counter" style={styles.counter}>{salidaNota.length}/{SALIDA_NOTA_MAX}</Text>
            </View>
            <TextInput
              testID="input-salida-nota"
              style={[styles.input, styles.multiline]}
              placeholder={t('product.salidaNotaPlaceholder')}
              placeholderTextColor={Colors.placeholder}
              multiline
              numberOfLines={3}
              maxLength={SALIDA_NOTA_MAX}
              value={salidaNota}
              onChangeText={setSalidaNota}
            />
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.submitBtn, direction === 'salida' && styles.submitBtnSalida, saving && { opacity: 0.6 }]}
          onPress={direction === 'entrada' ? handleSubmit : handleSalidaSubmit}
          disabled={saving}
        >
          <Text style={styles.submitBtnText}>
            {saving
              ? t('inventory.saving')
              : direction === 'entrada' ? t('product.saveProduct') : t('product.salidaSubmit')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <ScanModal
        visible={scanVisible}
        onClose={() => setScanVisible(false)}
        onSuccess={handleScanSuccess}
        categoriaOptions={categoriaOptions}
        onAddCategoria={handleAddCategoria}
        ubicacionOptions={ubicacionOptions}
        onAddUbicacion={handleAddUbicacion}
        marcaOptions={marcaOptions}
        onAddMarca={handleAddMarca}
        onApplyToForm={updater => setForm(updater)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Un poco corridos hacia la izquierda; si no entran, los textos se achican antes que el título
  directionRow: { flexShrink: 1, flexDirection: 'row', gap: 12, marginRight: 10 },
  // Texto un poco más chico que el título (22) y botón que no supera el renglón del banner (28 px)
  directionBtn: {
    flexShrink: 1,
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#f2f3f6',
  },
  directionBtnActive: { backgroundColor: Colors.primary },
  directionBtnActiveSalida: { backgroundColor: Colors.error },
  directionBtnText: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: Colors.textSecondary },
  directionBtnTextActive: { color: '#fff' },
  container: { flex: 1, backgroundColor: '#f2f3f6' },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  scanBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginTop: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 },
  labelInRow: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  counter: { fontSize: 12, color: Colors.textSecondary },
  multiline: { textAlignVertical: 'top', height: 72 },
  input: {
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: '#fafafa',
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
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: { fontSize: 14, color: Colors.textPrimary },
  suggestionSubtext: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  chipsContent: { flexDirection: 'row', gap: 8, marginTop: 6 },
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
  errorText: { color: Colors.error, fontSize: 13, marginTop: 8 },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnSalida: { backgroundColor: Colors.error },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  secondaryBtn: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 16 },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    backgroundColor: '#f2f3f6',
  },
  successTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary },
  successMsg: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
});
