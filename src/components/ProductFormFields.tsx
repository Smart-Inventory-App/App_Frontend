import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { ProductCreate, ProductSuggestion } from '@/types/product';
import { pickFromGallery, pickFromCamera } from '@/services/imageService';
import BottomSheetModal from '@/components/BottomSheetModal';
import DatePickerModal from '@/components/DatePickerModal';
import { applySuggestionToForm } from '@/utils/ocrDraft';
import { BARCODE_MAX_DIGITS, describeBarcodeLengths, onlyDigits } from '@/utils/barcode';
import { displayToIso, formatDateDigits, isoToDisplay } from '@/utils/dateInput';
import { findSimilarOptions } from '@/utils/optionSearch';
import { truncateLabel } from '@/utils/text';

const NOMBRE_MAX = 20;
const OPTION_MAX = 20;
const DESCRIPCION_MAX = 400;
const STOCK_MAX_DIGITS = 6;

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
}

// Campo de selección por chips (categoría, marca, ubicación) con alta de valores nuevos.
function OptionPicker({
  label, required, testKey, options, value, placeholder, onChange, onAdd, showLocationIcon,
}: OptionPickerProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const similar = useMemo(() => findSimilarOptions(draft, options), [draft, options]);

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
        {options.map(option => (
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
}: Props) {
  const { t } = useTranslation();
  const [vencText, setVencText] = useState(() => isoToDisplay(form.vencimiento));
  const [showCalendar, setShowCalendar] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
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

  const doUpload = async (picker: () => Promise<string | null>) => {
    setShowImagePicker(false);
    try {
      setUploadingImage(true);
      const url = await picker();
      if (url) set('imagen_url', url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al subir la imagen.';
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
        onFocus={() => setNombreFocused(true)}
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
      />

      <Text style={styles.label}>{t('product.stock')} *</Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        placeholderTextColor={Colors.placeholder}
        keyboardType="numeric"
        maxLength={STOCK_MAX_DIGITS}
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
      />

      <Text style={styles.label}>{t('product.vencimiento')}</Text>
      <View style={styles.dateRow}>
        <TextInput
          testID="input-vencimiento"
          style={[styles.input, styles.dateInput, vencInvalid && styles.inputError]}
          placeholder={t('product.vencimientoPlaceholder')}
          placeholderTextColor={Colors.placeholder}
          keyboardType="number-pad"
          maxLength={10}
          value={vencText}
          onChangeText={handleVencimientoChange}
        />
        <TouchableOpacity testID="open-calendar" style={[styles.squareBtn, styles.calendarBtn]} onPress={() => setShowCalendar(true)}>
          <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      <DatePickerModal
        visible={showCalendar}
        value={form.vencimiento}
        onSelect={handlePickDate}
        onClose={() => setShowCalendar(false)}
      />

      <Text style={styles.label}>{t('product.codigoBarras')}</Text>
      <TextInput
        testID="input-codigo-barras"
        style={styles.input}
        placeholder={t('product.codigoBarrasPlaceholder', { lengths: describeBarcodeLengths(t('product.codigoBarrasOr')) })}
        placeholderTextColor={Colors.placeholder}
        keyboardType="number-pad"
        maxLength={BARCODE_MAX_DIGITS}
        value={form.codigo_barras ?? ''}
        onChangeText={v => set('codigo_barras', onlyDigits(v) || undefined)}
      />

      <Text style={styles.sectionLabel}>{t('product.alertasTitle')}</Text>
      <View style={styles.alertRow}>
        <View style={styles.alertField}>
          <View testID="alert-label-box-stock-minimo" style={styles.alertLabelBox}>
            <Text style={[styles.label, styles.alertLabel]}>{t('product.stockMinimo')}</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder={t('product.defaultPlaceholder')}
            placeholderTextColor={Colors.placeholder}
            keyboardType="numeric"
            value={form.stock_minimo != null ? String(form.stock_minimo) : ''}
            onChangeText={(v) => {
              const n = parseInt(v, 10);
              set('stock_minimo', v.trim() === '' ? undefined : (isNaN(n) ? form.stock_minimo : n));
            }}
          />
          <Text style={styles.ruleHint}>
            {form.stock_minimo != null ? t('product.reglaPropia') : t('product.usandoReglaGeneral')}
          </Text>
        </View>
        <View style={styles.alertField}>
          <View testID="alert-label-box-dias" style={styles.alertLabelBox}>
            <Text style={[styles.label, styles.alertLabel]}>{t('product.diasAlertaVencimiento')}</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder={t('product.defaultPlaceholder')}
            placeholderTextColor={Colors.placeholder}
            keyboardType="numeric"
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
      </View>

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
        showLocationIcon
      />

      <Text style={styles.label}>{t('product.imagen')}</Text>
      {form.imagen_url ? (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: form.imagen_url }} style={styles.imagePreview} resizeMode="cover" />
          <TouchableOpacity style={styles.imageChangeBtn} onPress={() => setShowImagePicker(true)} disabled={uploadingImage}>
            {uploadingImage
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <><Ionicons name="pencil-outline" size={16} color={Colors.primary} /><Text style={styles.imageChangeBtnText}>{t('product.imagenCambiar')}</Text></>
            }
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.imageBtn} onPress={() => setShowImagePicker(true)} disabled={uploadingImage}>
          {uploadingImage
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <><Ionicons name="image-outline" size={20} color={Colors.primary} /><Text style={styles.imageBtnTextActive}>{t('product.imagenSeleccionar')}</Text></>
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
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>{t('product.imagenSeleccionar')}</Text>

        <TouchableOpacity style={styles.modalOption} onPress={() => doUpload(pickFromCamera)}>
          <View style={styles.modalOptionIcon}>
            <Ionicons name="camera-outline" size={22} color={Colors.primary} />
          </View>
          <Text style={styles.modalOptionText}>{t('product.imagenCamara')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.modalOption} onPress={() => doUpload(pickFromGallery)}>
          <View style={styles.modalOptionIcon}>
            <Ionicons name="images-outline" size={22} color={Colors.primary} />
          </View>
          <Text style={styles.modalOptionText}>{t('product.imagenGaleria')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.modalCancel} onPress={() => setShowImagePicker(false)}>
          <Text style={styles.modalCancelText}>Cancelar</Text>
        </TouchableOpacity>
      </BottomSheetModal>
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
  alertRow: { flexDirection: 'row', gap: 12 },
  alertField: { flex: 1 },
  // Reserva dos renglones y apoya el título contra el input: los dos campos quedan a la misma altura aunque un título ocupe más de una línea
  alertLabelBox: { minHeight: 32, marginTop: 12, justifyContent: 'flex-end' },
  alertLabel: { lineHeight: 16, marginTop: 0 },
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
  imageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    gap: 8,
    backgroundColor: '#fafafa',
  },
  imageBtnTextActive: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
  imagePreviewContainer: { marginTop: 4, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.inputBorder },
  imagePreview: { width: '100%', height: 180 },
  imageChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: '#fafafa',
  },
  imageChangeBtnText: { fontSize: 13, color: Colors.primary },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
    gap: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginBottom: 12,
  },
  // Mismo formato que el título "Flujo de producto", un poco más chico
  modalTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Roboto_500Medium',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionText: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  modalCancel: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f2f3f6',
  },
  modalCancelText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
});
