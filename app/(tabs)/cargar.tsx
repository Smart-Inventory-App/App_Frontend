import React, { useCallback, useState, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { productService } from '@/services/productService';
import { ExitReason, ProductCreate, ProductSuggestion } from '@/types/product';
import { isoToDisplay } from '@/utils/dateInput';
import { EXIT_REASONS, EXIT_REASON_LABEL_KEY } from '@/utils/exitReasons';
import AppTextInput from '@/components/AppTextInput';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import ProductFormFields from '@/components/ProductFormFields';
import ScreenHeader from '@/components/ScreenHeader';
import { isValidBarcode } from '@/utils/barcode';
import ExistingProductModal from '@/components/ExistingProductModal';
import ScanModal, { ScanSuccessKind } from '@/components/ScanModal';
import { FixedScanDocType } from '@/types/ocr';

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
  const [existingVisible, setExistingVisible] = useState(false);
  // null: escaneo general (etiqueta o remito); si no, el campo que se escanea (fecha de vencimiento o código de barras)
  const [scanField, setScanField] = useState<FixedScanDocType | null>(null);
  const [exitScanVisible, setExitScanVisible] = useState(false);
  const [scanSuccessKind, setScanSuccessKind] = useState<ScanSuccessKind | null>(null);

  const [salidaQuery, setSalidaQuery] = useState('');
  const [salidaSuggestions, setSalidaSuggestions] = useState<ProductSuggestion[]>([]);
  const [salidaSelected, setSalidaSelected] = useState<ProductSuggestion | null>(null);
  const [salidaCantidad, setSalidaCantidad] = useState('');
  const [salidaMotivo, setSalidaMotivo] = useState<ExitReason>('consumed');
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
      // Con una fecha de vencimiento mal cargada se borra solo ese campo para que el usuario la escriba de nuevo
      if (validationError === t('product.validationVencimiento')) {
        setForm(prev => ({ ...prev, vencimiento: undefined }));
      }
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

  // Se sumó stock a un producto que ya estaba cargado
  const handleExistingSuccess = () => {
    setScanSuccessKind(null);
    setMerged(true);
    setSuccess(true);
  };

  const scanSuccessMessage = (): string => {
    switch (scanSuccessKind) {
      case 'merged': return t('product.successMsgMerged');
      case 'updated': return t('scan.successUpdated');
      case 'salida': return t('product.successMsgSalida');
      case 'restocked': return t('scan.successRestocked');
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
    // En el campo va solo el nombre: la marca y el stock se muestran debajo, como datos informativos
    setSalidaQuery(s.nombre);
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
      behavior="padding"
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
      <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content}>
        {direction === 'entrada' ? (
          <>
          <TouchableOpacity style={styles.scanBtn} onPress={() => setExistingVisible(true)} testID="open-existing-modal">
            <Ionicons name="cube-outline" size={18} color={Colors.primary} />
            <Text style={styles.scanBtnText}>{t('existing.openButton')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scanBtn} onPress={() => { setScanField(null); setScanVisible(true); }} testID="open-scan-modal">
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
            onScanField={field => { setScanField(field); setScanVisible(true); }}
          />
          </>
        ) : (
          <View style={styles.container}>
            <TouchableOpacity style={styles.scanBtn} onPress={() => setExitScanVisible(true)} testID="open-exit-scan-modal">
              <Ionicons name="camera-outline" size={18} color={Colors.primary} />
              <Text style={styles.scanBtnText}>{t('scan.openButton')}</Text>
            </TouchableOpacity>
            <Text style={styles.label}>{t('product.salidaProducto')} *</Text>
            <AppTextInput
              style={styles.input}
              placeholder={t('product.salidaProductoPlaceholder')}
              placeholderTextColor={Colors.placeholder}
              value={salidaQuery}
              onChangeText={onSalidaQueryChange}
            />
            {salidaSelected && (
              <View testID="salida-selected-info" style={styles.selectedInfo}>
                <View style={styles.infoCell}>
                  <Text style={styles.infoLabel}>{t('product.categoria')}</Text>
                  <Text testID="salida-selected-categoria" style={styles.infoValue}>{salidaSelected.categoria}</Text>
                </View>
                {salidaSelected.marca ? (
                  <View style={styles.infoCell}>
                    <Text style={styles.infoLabel}>{t('product.marca')}</Text>
                    <Text testID="salida-selected-marca" style={styles.infoValue}>{salidaSelected.marca}</Text>
                  </View>
                ) : null}
                <View style={styles.infoCell}>
                  <Text style={styles.infoLabel}>{t('product.salidaStockActual')}</Text>
                  <Text testID="salida-selected-stock" style={[styles.infoValue, styles.infoValueStrong]}>{String(salidaSelected.stock)}</Text>
                </View>
                <View style={styles.infoCell}>
                  <Text style={styles.infoLabel}>{t('product.vencimiento')}</Text>
                  <Text
                    testID="salida-selected-vencimiento"
                    style={[styles.infoValue, !salidaSelected.vencimiento && styles.infoValueEmpty]}
                  >
                    {salidaSelected.vencimiento ? isoToDisplay(salidaSelected.vencimiento) : t('scan.productNoExpiry')}
                  </Text>
                </View>
              </View>
            )}
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
            <AppTextInput
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
              {EXIT_REASONS.map(reason => (
                <TouchableOpacity
                  key={reason}
                  testID={`salida-motivo-${reason}`}
                  style={[styles.chip, salidaMotivo === reason && styles.chipActive]}
                  onPress={() => setSalidaMotivo(reason)}
                >
                  <Text style={[styles.chipText, salidaMotivo === reason && styles.chipTextActive]}>
                    {t(EXIT_REASON_LABEL_KEY[reason])}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.labelRow}>
              <Text style={styles.labelInRow}>{t('product.salidaNotaLabel')}</Text>
              <Text testID="salida-nota-counter" style={styles.counter}>{salidaNota.length}/{SALIDA_NOTA_MAX}</Text>
            </View>
            <AppTextInput
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
      </KeyboardAwareScrollView>
      <ExistingProductModal
        visible={existingVisible}
        onClose={() => setExistingVisible(false)}
        onSuccess={handleExistingSuccess}
      />
      <ExistingProductModal
        mode="exit"
        visible={exitScanVisible}
        onClose={() => setExitScanVisible(false)}
        onSelectProduct={pickSalidaSuggestion}
        onPickReceipt={() => { setScanField('receipt'); setScanVisible(true); }}
      />
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
        fixedDocType={scanField}
        receiptDirection={scanField === 'receipt' ? 'salida' : 'entrada'}
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
  // Datos del producto elegido: una tarjeta breve con dos columnas
  selectedInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e8e8ee',
  },
  infoCell: { width: '50%', paddingVertical: 4 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue: { fontSize: 14, color: Colors.textPrimary, marginTop: 1 },
  infoValueStrong: { fontWeight: '700', color: Colors.primary },
  infoValueEmpty: { color: Colors.placeholder },
  chipsContent: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
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
