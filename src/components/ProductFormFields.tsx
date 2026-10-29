import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { ProductCreate, ProductSuggestion } from '@/types/product';
import { FieldScanDocType } from '@/types/ocr';
import { pickFromGallery, pickFromCamera, uploadImage, PickedImage } from '@/services/imageService';
import BottomSheetModal from '@/components/BottomSheetModal';
import ConfirmModal from '@/components/ConfirmModal';
import { useFieldFocus } from '@/components/KeyboardAwareScrollView';
import DatePickerModal from '@/components/DatePickerModal';
import ProductImage from '@/components/ProductImage';
import { applySuggestionToForm } from '@/utils/ocrDraft';
import { BARCODE_MAX_DIGITS, onlyDigits } from '@/utils/barcode';
import { displayToIso, formatDateDigits, isoToDisplay } from '@/utils/dateInput';
import { findSimilarOptions } from '@/utils/optionSearch';
import { selectedFirst } from '@/utils/selectedFirst';
import { truncateLabel } from '@/utils/text';

const NOMBRE_MAX = 20;
const OPTION_MAX = 20;
const DESCRIPCION_MAX = 400;
const STOCK_MAX_DIGITS = 6;
// Reglas de alerta propias del producto: hasta 9999999 de stock mínimo y hasta 999 días de anticipación
const STOCK_MINIMO_MAX_DIGITS = 7;
const DIAS_ALERTA_MAX_DIGITS = 3;

interface Props {
  form: Partial<ProductCreate>;
  onChange: (form: Partial<ProductCreate>) => void;
  ubicacionOptions?: string[];
  onAddUbicacion?: (loc: string) => void;
  categoriaOptions?: string[];
  onAddCategoria?: (cat: string) => void;
  marcaOptions?: string[];
  onAddMarca?: (marca: string) => void;
  suggestNombre?: (q: string) => Promise<ProductSuggestion[]>;
  /** Si se indica, la fecha de vencimiento y el código de barras muestran un botón de cámara para escanearlos. */
  onScanField?: (type: FieldScanDocType) => void;
}

const normalizeToExisting = (value: string, options: string[]): string => {
  const match = options.find(o => o.toLowerCase() === value.toLowerCase());
  return match ?? value;
};

interface OptionPickerProps {
  label: string;
  required?: boolean;
  testKey: string;
  options: string[];
  value?: string;
  placeholder: string;
  onChange: (value: string | undefined) => void;
  onAdd?: (value: string) => void;
  showLocationIcon?: boolean;
  onInputFocus?: () => void;
}

// Campo de selección por chips (categoría, marca, ubicación) con alta de valores nuevos.
function OptionPicker({
  label, required, testKey, options, value, placeholder, onChange, onAdd, showLocationIcon, onInputFocus,
}: OptionPickerProps) {
  const [adding, setAdding] = useState(false);
  const chipsRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');
  const similar = useMemo(() => findSimilarOptions(draft, options), [draft, options]);

  // La opción elegida va primero; al deseleccionarla vuelve a su lugar original (el orden de `options`).
  const ordered = useMemo(() => selectedFirst(options, o => o === value), [options, value]);

  // Vuelve al principio del renglón para que la opción elegida quede a la vista.
  useEffect(() => {
    chipsRef.current?.scrollTo?.({ x: 0, animated: true });
  }, [value]);

  const close = () => {
    setAdding(false);
    setDraft('');
  };

  const handleConfirm = () => {
    const trimmed = draft.trim();
    if (!trimmed) { close(); return; }
    const chosen = normalizeToExisting(trimmed, options);
    onChange(chosen);
    onAdd?.(chosen);
    close();
  };

  const handlePickSimilar = (option: string) => {
    onChange(option);
    close();
  };

  return (
    <>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <ScrollView
        ref={chipsRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
        keyboardShouldPersistTaps="handled"
      >
        {!adding && (
          <TouchableOpacity testID={`add-${testKey}`} style={styles.squareBtn} onPress={() => setAdding(true)}>
            <Ionicons name="add" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
        {ordered.map(option => (
          <TouchableOpacity
            key={option}
            style={[styles.chip, value === option && styles.chipActive]}
            onPress={() => onChange(value === option ? undefined : option)}
          >
            <Text style={[styles.chipText, value === option && styles.chipTextActive]}>{truncateLabel(option, OPTION_MAX)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {adding && (
        <>
          <View style={styles.newLocRow}>
            <TextInput
              testID={`input-${testKey}`}
              style={[styles.input, styles.newLocInput]}
              placeholder={placeholder}
              placeholderTextColor={Colors.placeholder}
              value={draft}
              onChangeText={setDraft}
              autoFocus
              onFocus={onInputFocus}
              maxLength={OPTION_MAX}
              onSubmitEditing={handleConfirm}
            />
            <TouchableOpacity testID={`confirm-${testKey}`} style={styles.newLocConfirm} onPress={handleConfirm}>
              <Ionicons name="checkmark" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.newLocCancel} onPress={close}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {similar.length > 0 && (
            <View style={styles.suggestionsBox}>
              {similar.map(option => (
                <TouchableOpacity
                  key={option}
                  testID={`similar-${testKey}-${option}`}
                  style={styles.suggestionItem}
                  onPress={() => handlePickSimilar(option)}
                >
                  <Ionicons name="search-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.suggestionText}>{truncateLabel(option, OPTION_MAX)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {value && !options.includes(value) && !adding && (
        <Text style={styles.selectedLoc}>
          {showLocationIcon && <Ionicons name="location-outline" size={12} />}
          {showLocationIcon ? ` ${truncateLabel(value, OPTION_MAX)}` : truncateLabel(value, OPTION_MAX)}
        </Text>
      )}
    </>
  );
}

export default function ProductFormFields({
  form,
  onChange,
  ubicacionOptions = [],
  onAddUbicacion,
  categoriaOptions = [],
  onAddCategoria,
  marcaOptions = [],
  onAddMarca,
  suggestNombre,
  onScanField,
}: Props) {
  const { t } = useTranslation();
  // Dentro de un KeyboardAwareScrollView, avisa qué campo se está completando para mostrarlo sobre el teclado
  const onFieldFocus = useFieldFocus() ?? undefined;
  const [vencText, setVencText] = useState(() => isoToDisplay(form.vencimiento));
  const [showCalendar, setShowCalendar] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  // Imagen elegida que espera la confirmación del usuario antes de subirse
  const [showImagePicker, setShowImagePicker] = useState(false);
  // Pregunta antes de quitar la imagen del producto a cargar
  const [confirmRemoveImage, setConfirmRemoveImage] = useState(false);
  // «Alertas personalizadas»: cerradas al entrar. Los valores viven en `form`, así que cerrarlas no los pierde
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [nombreSuggestions, setNombreSuggestions] = useState<ProductSuggestion[]>([]);
  const [nombreFocused, setNombreFocused] = useState(false);

  const set = (key: keyof ProductCreate, value: string | number | undefined) =>
    onChange({ ...form, [key]: value });

  useEffect(() => {
    if (!suggestNombre) return;
    const q = (form.nombre ?? '').trim();
    if (q.length < 2) {
      setNombreSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      suggestNombre(q).then(setNombreSuggestions).catch(() => setNombreSuggestions([]));
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.nombre, suggestNombre]);

  const handleSelectSuggestion = (s: ProductSuggestion) => {
    onChange(applySuggestionToForm(form, s));
    setNombreSuggestions([]);
  };

  // Elegir la imagen (galería o cámara) abre la pantalla del sistema para recortarla y confirmarla; con eso ya hecho, la
  // imagen se sube y se carga en el formulario directamente, sin otra ventana de confirmación
  const doPick = async (picker: () => Promise<PickedImage | null>) => {
    setShowImagePicker(false);
    try {
      const asset = await picker();
      if (!asset) return;
      setUploadingImage(true);
      set('imagen_url', await uploadImage(asset));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar la imagen.';
      Alert.alert('Error', message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Si el valor cambia desde afuera (sugerencia, OCR, reinicio del formulario), se refleja en el campo de texto.
  useEffect(() => {
    const current = form.vencimiento ?? '';
    const typed = displayToIso(vencText) ?? vencText;
    if (current !== typed && current !== vencText) setVencText(isoToDisplay(form.vencimiento));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vencimiento]);

  // Se guarda AAAA-MM-DD cuando la fecha está completa y es real; si no, el texto tal cual (la validación lo rechaza).
  const handleVencimientoChange = (raw: string) => {
    const formatted = formatDateDigits(raw);
    setVencText(formatted);
    set('vencimiento', formatted === '' ? undefined : (displayToIso(formatted) ?? formatted));
  };

  const handlePickDate = (iso: string) => {
    setVencText(isoToDisplay(iso));
    set('vencimiento', iso);
    setShowCalendar(false);
  };

  const vencInvalid = vencText.length === 10 && displayToIso(vencText) === null;

  // Con el botón de cámara el campo comparte renglón con el botón, igual que el de vencimiento
  const barcodeInput = (
    <TextInput
      testID="input-codigo-barras"
      style={onScanField ? [styles.input, styles.dateInput] : styles.input}
      placeholder={t('product.optional')}
      placeholderTextColor={Colors.placeholder}
      keyboardType="number-pad"
      maxLength={BARCODE_MAX_DIGITS}
      onFocus={onFieldFocus}
      value={form.codigo_barras ?? ''}
      onChangeText={v => set('codigo_barras', onlyDigits(v) || undefined)}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.labelInRow}>{t('product.nombre')} *</Text>
        <Text testID="nombre-counter" style={styles.counter}>{(form.nombre ?? '').length}/{NOMBRE_MAX}</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder={t('product.nombrePlaceholder')}
        placeholderTextColor={Colors.placeholder}
        value={form.nombre ?? ''}
        onChangeText={v => set('nombre', v)}
        onFocus={() => { setNombreFocused(true); onFieldFocus?.(); }}
        onBlur={() => setTimeout(() => setNombreFocused(false), 150)}
        maxLength={NOMBRE_MAX}
      />
      {nombreFocused && nombreSuggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {nombreSuggestions.map(s => (
            <TouchableOpacity
              key={s.id}
              style={styles.suggestionItem}
              onPress={() => handleSelectSuggestion(s)}
            >
              <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
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

      <OptionPicker
        label={t('product.categoria')}
        required
        testKey="categoria"
        options={categoriaOptions}
        value={form.categoria}
        placeholder={t('product.categoriaPlaceholder')}
        onChange={v => set('categoria', v)}
        onAdd={onAddCategoria}
        onInputFocus={onFieldFocus}
      />

      <Text style={styles.label}>{t('product.stock')} *</Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        placeholderTextColor={Colors.placeholder}
        keyboardType="numeric"
        maxLength={STOCK_MAX_DIGITS}
        onFocus={onFieldFocus}
        value={form.stock !== undefined ? String(form.stock) : ''}
        onChangeText={v => {
          const digits = v.replace(/[^0-9]/g, '');
          set('stock', digits === '' ? undefined : parseInt(digits, 10));
        }}
      />

      <OptionPicker
        label={t('product.marca')}
        testKey="marca"
        options={marcaOptions}
        value={form.marca}
        placeholder={t('product.optional')}
        onChange={v => set('marca', v)}
        onAdd={onAddMarca}
        onInputFocus={onFieldFocus}
      />

      <Text style={styles.label}>{t('product.fechaVencimiento')}</Text>
      <View style={styles.dateRow}>
        <TextInput
          testID="input-vencimiento"
          style={[styles.input, styles.dateInput, vencInvalid && styles.inputError]}
          placeholder={t('product.vencimientoPlaceholder')}
          placeholderTextColor={Colors.placeholder}
          keyboardType="number-pad"
          maxLength={10}
          onFocus={onFieldFocus}
          value={vencText}
          onChangeText={handleVencimientoChange}
        />
        <TouchableOpacity testID="open-calendar" style={[styles.squareBtn, styles.calendarBtn]} onPress={() => setShowCalendar(true)}>
          <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
        {onScanField && (
          <TouchableOpacity
            testID="scan-expiry"
            accessibilityLabel={t('product.scanExpiry')}
            style={[styles.squareBtn, styles.calendarBtn]}
            onPress={() => onScanField('expiry_date')}
          >
            <Ionicons name="camera-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>
      <DatePickerModal
        visible={showCalendar}
        value={form.vencimiento}
        onSelect={handlePickDate}
        onClose={() => setShowCalendar(false)}
      />

      <Text style={styles.label}>{t('product.codigoBarras')}</Text>
      {onScanField ? (
        <View style={styles.dateRow}>
          {barcodeInput}
          <TouchableOpacity
            testID="scan-barcode"
            accessibilityLabel={t('product.scanBarcode')}
            style={[styles.squareBtn, styles.calendarBtn]}
            onPress={() => onScanField('barcode')}
          >
            <Ionicons name="camera-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      ) : barcodeInput}

      <View style={styles.labelRow}>
        <Text style={styles.labelInRow}>{t('product.descripcion')}</Text>
        <Text testID="descripcion-counter" style={styles.counter}>{(form.descripcion ?? '').length}/{DESCRIPCION_MAX}</Text>
      </View>
      <TextInput
        style={[styles.input, styles.multiline]}
        testID="input-descripcion"
        placeholder={t('product.descripcionPlaceholder')}
        placeholderTextColor={Colors.placeholder}
        multiline
        numberOfLines={3}
        onFocus={onFieldFocus}
        value={form.descripcion ?? ''}
        onChangeText={v => set('descripcion', v || undefined)}
        maxLength={DESCRIPCION_MAX}
      />

      <OptionPicker
        label={t('product.ubicacion')}
        testKey="ubicacion"
        options={ubicacionOptions}
        value={form.ubicacion}
        placeholder={t('product.ubicacionPlaceholder')}
        onChange={v => set('ubicacion', v)}
        onAdd={onAddUbicacion}
        onInputFocus={onFieldFocus}
        showLocationIcon
      />

      {/* Alertas propias del producto: cerradas al entrar; lo escrito se conserva aunque se cierre y se vuelva a abrir */}
      <View style={styles.collapsibleHeader}>
        <Text style={styles.sectionLabelInRow}>{t('product.alertasTitle')}</Text>
        <TouchableOpacity
          testID="alerts-toggle"
          accessibilityRole="button"
          accessibilityLabel={alertsOpen ? t('product.alertasCerrar') : t('product.alertasAbrir')}
          accessibilityState={{ expanded: alertsOpen }}
          style={styles.collapsibleBtn}
          onPress={() => setAlertsOpen(open => !open)}
        >
          <Ionicons name={alertsOpen ? 'chevron-up' : 'chevron-down'} size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      {alertsOpen && (
        <View testID="alerts-section">
          <Text style={styles.label}>{t('product.stockMinimo')}</Text>
          <TextInput
            testID="input-stock-minimo"
            style={styles.input}
            placeholder={t('product.optional')}
            placeholderTextColor={Colors.placeholder}
            keyboardType="numeric"
            maxLength={STOCK_MINIMO_MAX_DIGITS}
            onFocus={onFieldFocus}
            value={form.stock_minimo != null ? String(form.stock_minimo) : ''}
            onChangeText={(v) => {
              const n = parseInt(v, 10);
              set('stock_minimo', v.trim() === '' ? undefined : (isNaN(n) ? form.stock_minimo : n));
            }}
          />
          <Text style={styles.ruleHint}>
            {form.stock_minimo != null ? t('product.reglaPropia') : t('product.usandoReglaGeneral')}
          </Text>

          <Text style={styles.label}>{t('product.diasAlertaVencimiento')}</Text>
          <TextInput
            testID="input-dias-alerta"
            style={styles.input}
            placeholder={t('product.optional')}
            placeholderTextColor={Colors.placeholder}
            keyboardType="numeric"
            maxLength={DIAS_ALERTA_MAX_DIGITS}
            onFocus={onFieldFocus}
            value={form.dias_alerta_vencimiento != null ? String(form.dias_alerta_vencimiento) : ''}
            onChangeText={(v) => {
              const n = parseInt(v, 10);
              set('dias_alerta_vencimiento', v.trim() === '' ? undefined : (isNaN(n) ? form.dias_alerta_vencimiento : n));
            }}
          />
          <Text style={styles.ruleHint}>
            {form.dias_alerta_vencimiento != null ? t('product.reglaPropia') : t('product.usandoReglaGeneral')}
          </Text>
        </View>
      )}

      <Text style={styles.label}>{t('product.imagen')}</Text>
      {form.imagen_url ? (
        <View testID="image-preview-container" style={styles.imagePreviewContainer}>
          <ProductImage uri={form.imagen_url} style={styles.imagePreview} resizeMode="cover" />
          <TouchableOpacity
            testID="remove-image-button"
            accessibilityLabel={t('product.imagenEliminar')}
            style={styles.imageRemoveBtn}
            onPress={() => setConfirmRemoveImage(true)}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
            <Text style={styles.imageRemoveBtnText}>{t('product.imagenEliminar')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          testID="select-image-button"
          style={styles.selectImageBtn}
          onPress={() => setShowImagePicker(true)}
          disabled={uploadingImage}
        >
          {uploadingImage
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <><Ionicons name="image-outline" size={18} color={Colors.primary} /><Text style={styles.selectImageBtnText}>{t('product.imagenSeleccionar')}</Text></>
          }
        </TouchableOpacity>
      )}

      {/* Igual que el historial de consumo: el fondo se oscurece con un fundido y solo la hoja sube */}
      <BottomSheetModal
        visible={showImagePicker}
        onRequestClose={() => setShowImagePicker(false)}
        sheetStyle={styles.modalSheet}
        overlayTestID="image-picker-overlay"
        sheetTestID="image-picker-sheet"
      >
        {/* Mismo formato que las demás ventanas que suben desde abajo (escanear imagen, producto existente): título con
            su botón de cerrar y las dos opciones como botones grandes */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('product.imagenSeleccionar')}</Text>
          <TouchableOpacity testID="image-picker-close" accessibilityLabel={t('scan.close')} onPress={() => setShowImagePicker(false)}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.modalContent}>
          <TouchableOpacity testID="image-picker-camera" style={styles.bigButton} onPress={() => doPick(pickFromCamera)}>
            <Ionicons name="camera-outline" size={22} color="#fff" />
            <Text style={styles.bigButtonText}>{t('product.imagenCamara')}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="image-picker-gallery" style={[styles.bigButton, styles.bigButtonSecondary]} onPress={() => doPick(pickFromGallery)}>
            <Ionicons name="images-outline" size={22} color={Colors.primary} />
            <Text style={styles.bigButtonSecondaryText}>{t('product.imagenGaleria')}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>


      <ConfirmModal
        visible={confirmRemoveImage}
        message={t('product.imagenEliminarConfirm')}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          setConfirmRemoveImage(false);
          set('imagen_url', undefined);
        }}
        onCancel={() => setConfirmRemoveImage(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginTop: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 },
  labelInRow: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  counter: { fontSize: 12, color: Colors.textSecondary },
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
  multiline: { textAlignVertical: 'top', height: 72 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Título de la sección a la izquierda y el botón de abrir o cerrar a la derecha, en el borde del formulario
  collapsibleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  sectionLabelInRow: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  collapsibleBtn: { width: 36, height: 36, alignItems: 'flex-end', justifyContent: 'center' },
  ruleHint: { fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
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
  chipsScroll: { flexGrow: 0, marginTop: 6 },
  chipsContent: { gap: 8, flexDirection: 'row', alignItems: 'center' },
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
  squareBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dateInput: { flex: 1, marginTop: 0 },
  calendarBtn: { height: 40, width: 40 },
  inputError: { borderColor: Colors.inputBorderError },
  newLocRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  newLocInput: { flex: 1, marginTop: 0 },
  newLocConfirm: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newLocCancel: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.inputBorder ?? '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  selectedLoc: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  // Mismo formato que los botones «Ingresar producto existente» y «Escanear» de la pantalla de carga
  selectImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
    marginTop: 4,
  },
  selectImageBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  // Vista previa cuadrada (1x1), centrada y con un tamaño máximo para que no ocupe toda la pantalla
  imagePreviewContainer: {
    marginTop: 4,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 280,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  imagePreview: { width: '100%', aspectRatio: 1 },
  imageRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: '#fafafa',
  },
  imageRemoveBtnText: { fontSize: 13, color: Colors.error },
  // Igual que las ventanas que suben desde abajo en el escaneo
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  // Mismo formato que el título "Flujo de producto", un poco más chico
  modalTitle: { fontSize: 20, lineHeight: 26, fontFamily: 'Roboto_500Medium', color: Colors.textPrimary },
  modalContent: { padding: 16, paddingBottom: 24 },
  bigButton: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  bigButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  bigButtonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.primary },
  bigButtonSecondaryText: { color: Colors.primary, fontWeight: 'bold', fontSize: 15 },
});
