import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import AppTextInput from '@/components/AppTextInput';
import ConfirmModal from '@/components/ConfirmModal';
import ProductInfoCard from '@/components/ProductInfoCard';
import { productService } from '@/services/productService';
import { ReceiptInfo, SalidaOCRItem, ProductDraft } from '@/types/ocr';
import { ExitReason, ProductSuggestion } from '@/types/product';
import { isoToDisplay } from '@/utils/dateInput';
import { selectedFirst } from '@/utils/selectedFirst';
import { EXIT_REASONS, EXIT_REASON_LABEL_KEY } from '@/utils/exitReasons';
import {
  blankReceiptItem,
  buildReceiptPayload,
  initReceiptItems,
  mergeSuggestions,

  RECEIPT_STOCK_MAX_DIGITS,
  ReceiptDirection,
  ReceiptItem,
  ReceiptItemError,
  validateReceiptItems,
} from '@/utils/receiptItems';

// Espera después de la última letra del nombre antes de buscar productos parecidos
const SEARCH_DELAY_MS = 300;

interface Props {
  /** Lo que se leyó del documento, un producto por renglón. */
  drafts: ProductDraft[];
  comprobante?: ReceiptInfo | null;
  direction: ReceiptDirection;
  /** Salida: el motivo elegido. */
  motivo: ExitReason | null;
  onMotivoChange: (motivo: ExitReason | null) => void;
  confirming: boolean;
  /** Error de la última confirmación (por ejemplo, la red). */
  error: string | null;
  /** Los productos ya validados, listos para enviar. */
  onConfirm: (items: SalidaOCRItem[]) => void;
  /** Volver a pedir otra imagen. */
  onScanAnother: () => void;
}

// Productos leídos de un ticket, remito o factura (entrada y salida): cada uno con lo que decía el documento, el nombre
// identificado, los productos del inventario más parecidos y el stock. Todos se cargan al confirmar; los que no sirven se descartan.
export default function ReceiptItemsReview({
  drafts, comprobante, direction, motivo, onMotivoChange, confirming, error, onConfirm, onScanAnother,
}: Props) {
  const { t } = useTranslation();
  const isEntrada = direction === 'entrada';
  const [items, setItems] = useState<ReceiptItem[]>(() => initReceiptItems(drafts));
  const [removingId, setRemovingId] = useState<number | null>(null);
  // Después de intentar confirmar, se marca lo que falta en cada producto
  const [submitted, setSubmitted] = useState(false);
  const nextId = useRef(drafts.length);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const pending = timers.current;
    return () => {
      mounted.current = false;
      Object.values(pending).forEach(clearTimeout);
    };
  }, []);

  const updateItem = (id: number, patch: Partial<ReceiptItem>) =>
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));

  // Al cambiar el nombre se pierde el producto elegido y se buscan los parecidos al nuevo nombre
  const changeName = (id: number, text: string) => {
    updateItem(id, { name: text, selected: null, options: [], similarity: {}, searched: false });
    clearTimeout(timers.current[id]);
    const name = text.trim();
    if (name.length < 2) return;
    timers.current[id] = setTimeout(async () => {
      const [byMatch, bySuggest] = await Promise.allSettled([
        productService.matchProducts(name),
        productService.suggestProducts(name),
      ]);
      if (!mounted.current || (byMatch.status === 'rejected' && bySuggest.status === 'rejected')) return;
      const found = mergeSuggestions(
        byMatch.status === 'fulfilled' ? byMatch.value : [],
        bySuggest.status === 'fulfilled' ? bySuggest.value : [],
      );
      // Si mientras tanto siguió escribiendo, esta búsqueda ya no sirve
      setItems(prev => prev.map(item => (item.id === id && item.name === text ? { ...item, options: found, searched: true } : item)));
    }, SEARCH_DELAY_MS);
  };

  const pickOption = (id: number, option: ProductSuggestion) =>
    updateItem(id, { selected: option, name: option.nombre, options: [], similarity: {}, searched: true });

  const changeQuantity = (id: number, value: string) =>
    updateItem(id, { quantity: value.replace(/[^0-9]/g, ''), quantityTouched: true });

  const addItem = () => {
    const id = nextId.current++;
    // El nuevo queda al inicio de la lista, a la vista
    setItems(prev => [blankReceiptItem(id), ...prev]);
  };

  const removeItem = (id: number) => {
    clearTimeout(timers.current[id]);
    setItems(prev => prev.filter(item => item.id !== id));
    setRemovingId(null);
  };

  const errors = validateReceiptItems(items, direction);

  const handleConfirm = () => {
    if (items.length === 0) return;
    setSubmitted(true);
    if (Object.values(errors).some(list => list.length > 0)) return;
    onConfirm(buildReceiptPayload(items));
  };

  const messageOf = (error: ReceiptItemError): string => {
    if (error.field === 'name') return t(error.kind === 'noName' ? 'existing.nameRequired' : 'scan.receiptPickProduct');
    if (error.kind === 'required') return t('product.validationStock');
    return t('scan.receiptStockExceeds', { available: error.available });
  };

  const nameError = (item: ReceiptItem) => (submitted ? errors[item.id].find(e => e.field === 'name') : undefined);
  // Pasarse del stock se avisa enseguida; el stock en blanco, cuando el usuario ya lo tocó o intentó confirmar
  const quantityError = (item: ReceiptItem) =>
    errors[item.id].find(e => e.field === 'quantity' && (e.kind === 'exceeds' || submitted || item.quantityTouched));

  const renderOptions = (item: ReceiptItem) => {
    if (item.selected) {
      return <ProductInfoCard product={item.selected} testIDPrefix={`receipt-selected-${item.id}`} />;
    }
    if (item.options.length > 0) {
      return (
        <View style={styles.optionsBox} testID={`receipt-options-${item.id}`}>
          {item.options.map(option => (
            <TouchableOpacity
              key={option.id}
              testID={`receipt-option-${item.id}-${option.id}`}
              style={styles.optionRow}
              onPress={() => pickOption(item.id, option)}
            >
              <Ionicons name="cube-outline" size={16} color={Colors.textSecondary} />
              <View style={styles.optionTextBox}>
                <Text style={styles.optionText}>{option.nombre}{option.marca ? ` · ${option.marca}` : ''}</Text>
                <Text style={styles.optionSubtext}>
                  {option.vencimiento ? t('scan.productExpires', { date: isoToDisplay(option.vencimiento) }) : t('scan.productNoExpiry')}
                  {' · '}{t('scan.receiptStock', { stock: option.stock })}
                </Text>
              </View>
              {item.similarity[option.id] != null && (
                <Text testID={`receipt-similarity-${item.id}-${option.id}`} style={styles.similarity}>
                  {t('scan.receiptSimilarity', { value: item.similarity[option.id] })}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    if (item.searched && item.name.trim()) {
      return <Text testID={`receipt-no-match-${item.id}`} style={styles.hintText}>{t('scan.receiptNoMatch')}</Text>;
    }
    return null;
  };

  const renderItem = (item: ReceiptItem) => {
    const nameProblem = nameError(item);
    const quantityProblem = quantityError(item);
    return (
      <View key={item.id} style={styles.item} testID={`receipt-line-${item.id}`}>
        <View style={styles.itemHeader} testID={`receipt-header-${item.id}`}>
          <View style={styles.itemHeaderText}>
            {item.manual ? (
              <Text testID={`receipt-manual-${item.id}`} style={styles.readText}>{t(isEntrada ? 'scan.receiptManualEntrada' : 'scan.receiptManualSalida')}</Text>
            ) : item.textoLeido ? (
              <>
                <Text testID={`receipt-read-label-${item.id}`} style={styles.readLabel}>{t('scan.receiptReadLabel')}</Text>
                <Text testID={`receipt-read-${item.id}`} style={styles.readText}>{item.textoLeido}</Text>
              </>
            ) : null}
          </View>
          <TouchableOpacity
            testID={`receipt-remove-${item.id}`}
            accessibilityLabel={t('scan.receiptRemove')}
            style={styles.removeButton}
            onPress={() => setRemovingId(item.id)}
          >
            <Ionicons name="remove" size={18} color={Colors.error} />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>{t('scan.receiptProduct')}</Text>
        <AppTextInput
          testID={`receipt-name-${item.id}`}
          style={[styles.input, nameProblem && styles.inputError]}
          placeholder={t('existing.namePlaceholder')}
          placeholderTextColor={Colors.placeholder}
          value={item.name}
          onChangeText={text => changeName(item.id, text)}
        />
        {nameProblem ? <Text testID={`receipt-name-error-${item.id}`} style={styles.fieldError}>{messageOf(nameProblem)}</Text> : null}
        {renderOptions(item)}

        <Text style={styles.label}>{t('scan.receiptStockLabel')}</Text>
        <AppTextInput
          testID={`receipt-quantity-${item.id}`}
          style={[styles.input, quantityProblem && styles.inputError]}
          placeholder="0"
          placeholderTextColor={Colors.placeholder}
          keyboardType="numeric"
          maxLength={RECEIPT_STOCK_MAX_DIGITS}
          value={item.quantity}
          onChangeText={value => changeQuantity(item.id, value)}
        />
        {quantityProblem ? (
          <Text testID={`receipt-quantity-error-${item.id}`} style={styles.fieldError}>{messageOf(quantityProblem)}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View>
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      <Text style={[styles.sectionTitle, styles.firstTitle]}>{t('scan.receiptHeaderTitle')}</Text>
      {comprobante?.comercio ? <Text style={styles.hintText}>{t('scan.receiptComercio', { value: comprobante.comercio })}</Text> : null}
      {comprobante?.fecha_compra ? <Text style={styles.hintText}>{t('scan.receiptFecha', { value: comprobante.fecha_compra })}</Text> : null}
      {comprobante?.total != null ? <Text style={styles.hintText}>{t('scan.receiptTotal', { value: comprobante.total })}</Text> : null}

      {!isEntrada && (
        <View>
          <Text style={styles.sectionTitle}>{t('product.salidaMotivo')}</Text>
          {/* Los motivos van uno al lado del otro, y se deslizan hacia el costado */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="receipt-motivos" contentContainerStyle={styles.motivos}>
            {/* El motivo elegido pasa al inicio, y al deseleccionarlo vuelve a su lugar */}
            {selectedFirst(EXIT_REASONS, reason => reason === motivo).map(reason => (
              <TouchableOpacity
                key={reason}
                testID={`receipt-motivo-${reason}`}
                style={[styles.chip, motivo === reason && styles.chipActive]}
                onPress={() => onMotivoChange(motivo === reason ? null : reason)}
              >
                <Text style={[styles.chipText, motivo === reason && styles.chipTextActive]}>{t(EXIT_REASON_LABEL_KEY[reason])}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.itemsHeader}>
        <Text testID="receipt-items-title" style={styles.itemsTitle}>{t(isEntrada ? 'scan.receiptItemsTitleEntrada' : 'scan.receiptItemsTitleSalida')}</Text>
        <TouchableOpacity testID="receipt-add" accessibilityLabel={t('scan.receiptAdd')} style={styles.addButton} onPress={addItem}>
          <Ionicons name="add" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {items.length === 0 ? <Text testID="receipt-empty" style={styles.emptyText}>{t('scan.receiptNoItems')}</Text> : null}
      {items.map(renderItem)}

      <TouchableOpacity
        style={[styles.confirmButton, !isEntrada && styles.confirmButtonExit, (confirming || items.length === 0) && styles.disabled]}
        onPress={handleConfirm}
        disabled={confirming || items.length === 0}
        testID="confirm-receipt"
      >
        <Text style={styles.confirmButtonText}>{confirming ? t('scan.confirming') : t(isEntrada ? 'scan.receiptSubmitEntrada' : 'scan.receiptSubmit')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.backLink} onPress={onScanAnother} testID="receipt-scan-another">
        <Text style={styles.backLinkText}>{t('scan.scanAnother')}</Text>
      </TouchableOpacity>

      <ConfirmModal
        visible={removingId !== null}
        message={t('scan.receiptRemoveConfirm')}
        confirmLabel={t('scan.receiptRemoveYes')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => removingId !== null && removeItem(removingId)}
        onCancel={() => setRemovingId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  errorBanner: { color: Colors.error, fontSize: 13, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginTop: 12, marginBottom: 8 },
  firstTitle: { marginTop: 4 },
  hintText: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  emptyText: { color: Colors.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' },
  motivos: { flexDirection: 'row', gap: 6, paddingRight: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, color: Colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  itemsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 },
  itemsTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  // Solo el contorno y el símbolo llevan color; el fondo es blanco
  addButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  item: { borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 10, padding: 12, marginBottom: 12 },
  // El botón de descartar queda centrado con el texto de la izquierda (el texto leído con su rótulo, o la carga manual)
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemHeaderText: { flex: 1, minHeight: 30, justifyContent: 'center' },
  readLabel: { fontSize: 11, color: Colors.textSecondary },
  readText: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  removeButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginTop: 8 },
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
  inputError: { borderColor: Colors.inputBorderError },
  fieldError: { color: Colors.error, fontSize: 12, marginTop: 6 },
  optionsBox: { marginTop: 8, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionTextBox: { flex: 1 },
  optionText: { fontSize: 14, color: Colors.textPrimary },
  optionSubtext: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  similarity: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  confirmButton: { backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
  confirmButtonExit: { backgroundColor: Colors.error },
  confirmButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  disabled: { opacity: 0.5 },
  backLink: { alignItems: 'center', marginTop: 16 },
  backLinkText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
