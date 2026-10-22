import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import AppTextInput from '@/components/AppTextInput';
import BottomSheetModal from '@/components/BottomSheetModal';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import ProductInfoCard from '@/components/ProductInfoCard';
import { getScanErrorMessage, ocrService } from '@/services/ocrService';
import { productService } from '@/services/productService';
import { ProductDraft, ProductMatch, ScanDocType, ScanState } from '@/types/ocr';
import { ProductSuggestion } from '@/types/product';
import { BARCODE_MAX_DIGITS, isValidBarcode, onlyDigits } from '@/utils/barcode';
import { isoToDisplay } from '@/utils/dateInput';
import { formatWaitSeconds } from '@/utils/ocrDraft';

// El campo muestra también la marca del producto elegido ("Nombre · Marca")
const NAME_INPUT_MAX = 60;
const STOCK_MAX_DIGITS = 6;

type Method = 'name' | 'barcode' | 'label' | 'receipt';
type Step = 'menu' | 'name' | 'source' | 'processing' | 'edit' | 'results';

interface Props {
  visible: boolean;
  onClose: () => void;
  /**
   * "entry": ingresar stock a un producto existente (nombre, etiqueta o código de barras).
   * "exit": escanear para una salida (código de barras, etiqueta o factura); al elegir el producto se vuelve
   * al formulario de salida con él cargado.
   */
  mode?: 'entry' | 'exit';
  /** Entrada: se llama después de sumar el stock al producto elegido. */
  onSuccess?: () => void;
  /** Salida: el producto que el usuario eligió entre las coincidencias. */
  onSelectProduct?: (product: ProductSuggestion) => void;
  /** Salida: el usuario eligió la factura o remito, que se procesa con el escaneo de comprobantes. */
  onPickReceipt?: () => void;
}

const METHOD_DOC_TYPE: Record<'barcode' | 'label', ScanDocType> = {
  barcode: 'barcode',
  label: 'product_label',
};

const toSuggestion = (match: ProductMatch): ProductSuggestion => ({
  id: match.id,
  nombre: match.nombre,
  marca: match.marca ?? undefined,
  categoria: match.categoria ?? '',
  ubicacion: match.ubicacion ?? undefined,
  vencimiento: match.vencimiento ?? undefined,
  codigo_barras: match.codigo_barras ?? undefined,
  stock: match.stock,
});

const productLabel = (p: ProductSuggestion) => p.nombre + (p.marca ? ` · ${p.marca}` : '');

// "Ingresar producto existente": se suma stock a un producto que el usuario ya tiene cargado,
// encontrándolo por nombre, por la etiqueta o por el código de barras.
export default function ExistingProductModal({ visible, onClose, mode = 'entry', onSuccess, onSelectProduct, onPickReceipt }: Props) {
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('menu');
  const [method, setMethod] = useState<Method | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueInfo, setQueueInfo] = useState<{ position?: number | null; wait?: number | null }>({});

  // Búsqueda por nombre
  const [query, setQuery] = useState('');

  // Lo escaneado, editable antes de buscar
  const [barcode, setBarcode] = useState('');
  const [labelName, setLabelName] = useState('');
  const [labelDraft, setLabelDraft] = useState<ProductDraft | null>(null);

  const [options, setOptions] = useState<ProductSuggestion[]>([]);
  const [selected, setSelected] = useState<ProductSuggestion | null>(null);
  const [stock, setStock] = useState('');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const cancelledRef = useRef(false);

  function resetAll() {
    setStep('menu');
    setMethod(null);
    setError(null);
    setQueueInfo({});
    setQuery('');
    setBarcode('');
    setLabelName('');
    setLabelDraft(null);
    setOptions([]);
    setSelected(null);
    setStock('');
    setSearching(false);
    setSaving(false);
  }

  useEffect(() => {
    if (!visible) return;
    cancelledRef.current = false;
    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Sugerencias mientras el usuario escribe el nombre
  useEffect(() => {
    if (step !== 'name' || selected) return;
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      productService.suggestProducts(q)
        .then(found => { if (!cancelled) setOptions(found); })
        .catch(() => { if (!cancelled) setOptions([]); });
    }, 300);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query, selected, step]);

  const handleClose = () => {
    cancelledRef.current = true;
    resetAll();
    onClose();
  };

  const clearSelection = () => {
    setSelected(null);
    setStock('');
    setError(null);
  };

  const handlePickMethod = (picked: Method) => {
    if (picked === 'receipt') {
      onPickReceipt?.();
      handleClose();
      return;
    }
    setMethod(picked);
    setError(null);
    setStep(picked === 'name' ? 'name' : 'source');
  };

  const handleBackToMenu = () => {
    resetAll();
  };

  // ── Por nombre ──────────────────────────────────────────────────────────────

  const handleQueryChange = (value: string) => {
    setQuery(value);
    clearSelection();
  };

  const handlePickOption = (option: ProductSuggestion) => {
    // En una salida el producto elegido vuelve al formulario, donde se indican la cantidad y el motivo
    if (mode === 'exit') {
      onSelectProduct?.(option);
      handleClose();
      return;
    }
    setSelected(option);
    setError(null);
    if (method === 'name') {
      // En el campo va solo el nombre: la marca y los demás datos se muestran debajo, en la tarjeta del producto
      setQuery(option.nombre);
      setOptions([]);
    }
  };

  // ── Por escaneo ─────────────────────────────────────────────────────────────

  const handlePickSource = async (source: 'camera' | 'gallery') => {
    if (!method || method === 'name' || method === 'receipt') return;
    setError(null);
    try {
      const asset = await ocrService.pickImage(source);
      if (!asset) return;
      await runScan(METHOD_DOC_TYPE[method], asset);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('scan.errorUpload'));
      setStep('source');
    }
  };

  const runScan = async (type: ScanDocType, asset: { uri: string; fileName?: string | null; mimeType?: string | null }) => {
    setStep('processing');
    setQueueInfo({});
    let stage: 'upload' | 'poll' = 'upload';
    try {
      const initial = await ocrService.scan(
        { uri: asset.uri, name: asset.fileName, type: asset.mimeType },
        type,
      );
      stage = 'poll';
      const finalState: ScanState = initial.status === 'done' || initial.status === 'failed'
        ? initial
        : await ocrService.pollJob(initial.job_id as string, {
            onUpdate: (state) => setQueueInfo({ position: state.queue_position, wait: state.estimated_wait_seconds }),
            shouldStop: () => cancelledRef.current,
          });

      if (cancelledRef.current) return;

      if (finalState.status === 'failed' || !finalState.result) {
        setError(finalState.error ? t('existing.scanFailed', { reason: finalState.error }) : t('existing.scanFailedNoReason'));
        setStep('source');
        return;
      }

      const draft = finalState.result.draft;
      if (type === 'barcode') {
        setBarcode(onlyDigits(draft?.codigo_barras ?? ''));
      } else {
        setLabelDraft(draft);
        setLabelName(draft?.nombre ?? '');
      }
      setStep('edit');
    } catch (err: unknown) {
      if (cancelledRef.current) return;
      const message = err instanceof Error && err.message === 'timeout'
        ? t('scan.errorTimeout')
        : err instanceof Error && err.message === 'cancelado'
          ? null
          : getScanErrorMessage(err, stage === 'upload' ? t('scan.errorUpload') : t('scan.errorPoll'));
      if (message) setError(message);
      setStep('source');
    }
  };

  // Con lo escaneado ya corregido se buscan los productos; si no hay ninguno, se vuelve a editar
  const handleConfirmEdit = async () => {
    setError(null);
    if (method === 'barcode') {
      if (!isValidBarcode(barcode)) {
        setError(t('product.validationCodigoBarras'));
        return;
      }
      await search(() => productService.getProductsByBarcode(barcode), t('existing.barcodeNotFound'));
      return;
    }
    const name = labelName.trim();
    if (!name) {
      setError(t('existing.nameRequired'));
      return;
    }
    await search(async () => {
      const found = await productService.suggestProducts(name);
      // Con el nombre tal cual lo leyó la etiqueta, también sirven las coincidencias que armó el escaneo
      if (found.length === 0 && name === (labelDraft?.nombre ?? '').trim()) {
        return (labelDraft?.coincidencias ?? []).map(toSuggestion);
      }
      return found;
    }, t('existing.nameNotFound', { name }));
  };

  const search = async (find: () => Promise<ProductSuggestion[]>, notFoundMessage: string) => {
    setSearching(true);
    try {
      const found = await find();
      if (found.length === 0) {
        setError(notFoundMessage);
        return;
      }
      setOptions(found);
      clearSelection();
      setStep('results');
    } catch {
      setError(t('existing.searchError'));
    } finally {
      setSearching(false);
    }
  };

  // ── Stock ───────────────────────────────────────────────────────────────────

  const handleConfirmStock = async () => {
    const quantity = parseInt(stock, 10);
    if (!selected || !quantity || quantity <= 0) {
      setError(t('product.validationStock'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await productService.restockProduct(selected.id, quantity);
      onSuccess?.();
      handleClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('product.saveError'));
    } finally {
      setSaving(false);
    }
  };

  // ── Pantallas ───────────────────────────────────────────────────────────────

  const renderError = () => (error ? <Text testID="existing-error" style={styles.errorBanner}>{error}</Text> : null);

  // `spaced`: debajo de un campo de texto, el título se separa del campo
  const renderOptionsList = (spaced = false) => (
    <View>
      <Text testID="existing-options-title" style={[styles.sectionTitle, spaced && styles.optionsTitleSpaced]}>{t('existing.optionsTitle')}</Text>
      <View style={styles.optionsBox}>
        {options.map(option => (
          <TouchableOpacity
            key={option.id}
            testID={`existing-option-product-${option.id}`}
            style={styles.optionRow}
            onPress={() => handlePickOption(option)}
          >
            <Ionicons name="cube-outline" size={16} color={Colors.textSecondary} />
            <View style={styles.optionTextBox}>
              <Text style={styles.optionText}>{productLabel(option)}</Text>
              <Text style={styles.optionSubtext}>
                {option.vencimiento ? `Vence ${isoToDisplay(option.vencimiento)}` : 'Sin vencimiento'} · Stock: {option.stock}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Con un producto elegido desaparecen las demás opciones y se pide el stock a ingresar
  const renderStockForm = () => {
    if (!selected) return null;
    return (
      <View>
        {method !== 'name' && (
          <View style={styles.selectedRow} testID="existing-selected">
            <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
            <View style={styles.optionTextBox}>
              <Text style={styles.optionText}>{productLabel(selected)}</Text>
              <Text style={styles.optionSubtext}>{t('existing.stockCurrent', { stock: selected.stock })}</Text>
            </View>
            <TouchableOpacity testID="existing-change" onPress={clearSelection}>
              <Text style={styles.linkText}>{t('existing.change')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {method === 'name' && <ProductInfoCard product={selected} testIDPrefix="existing-selected" />}
        <Text style={styles.label}>{t('existing.stockLabel')} *</Text>
        <AppTextInput
          testID="existing-stock-input"
          style={styles.input}
          placeholder="0"
          placeholderTextColor={Colors.placeholder}
          keyboardType="numeric"
          maxLength={STOCK_MAX_DIGITS}
          value={stock}
          onChangeText={v => { setStock(v.replace(/[^0-9]/g, '')); setError(null); }}
        />
        {renderError()}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.cancelAction} onPress={handleClose} testID="existing-cancel">
            <Text style={styles.cancelActionText}>{t('existing.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmAction, saving && styles.disabled]}
            onPress={handleConfirmStock}
            disabled={saving}
            testID="existing-confirm"
          >
            <Text style={styles.confirmActionText}>{t('existing.confirm')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderMenu = () => (
    <View>
      <Text style={styles.sectionTitle}>{t(mode === 'exit' ? 'scan.docTypeTitle' : 'existing.menuTitle')}</Text>
      {mode === 'exit' ? (
        <>
          <TouchableOpacity style={styles.menuButton} onPress={() => handlePickMethod('barcode')} testID="existing-method-barcode">
            <Ionicons name="barcode-outline" size={24} color={Colors.primary} />
            <Text style={styles.menuButtonText}>{t('existing.exitByBarcode')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={() => handlePickMethod('label')} testID="existing-method-label">
            <Ionicons name="pricetag-outline" size={24} color={Colors.primary} />
            <Text style={styles.menuButtonText}>{t('existing.exitByLabel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={() => handlePickMethod('receipt')} testID="existing-method-receipt">
            <Ionicons name="receipt-outline" size={24} color={Colors.primary} />
            <Text style={styles.menuButtonText}>{t('existing.exitByReceipt')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity style={styles.menuButton} onPress={() => handlePickMethod('name')} testID="existing-method-name">
            <Ionicons name="create-outline" size={24} color={Colors.primary} />
            <Text style={styles.menuButtonText}>{t('existing.byName')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={() => handlePickMethod('label')} testID="existing-method-label">
            <Ionicons name="pricetag-outline" size={24} color={Colors.primary} />
            <Text style={styles.menuButtonText}>{t('existing.byLabel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={() => handlePickMethod('barcode')} testID="existing-method-barcode">
            <Ionicons name="barcode-outline" size={24} color={Colors.primary} />
            <Text style={styles.menuButtonText}>{t('existing.byBarcode')}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderNameStep = () => (
    <View>
      <Text style={styles.label}>{t('existing.nameLabel')} *</Text>
      <AppTextInput
        testID="existing-name-input"
        style={styles.input}
        placeholder={t('existing.namePlaceholder')}
        placeholderTextColor={Colors.placeholder}
        value={query}
        onChangeText={handleQueryChange}
        maxLength={NAME_INPUT_MAX}
      />
      {!selected && options.length > 0 && renderOptionsList(true)}
      {renderStockForm()}
      {!selected && (
        <TouchableOpacity style={styles.backLink} onPress={handleBackToMenu} testID="existing-back">
          <Text style={styles.backLinkText}>{t('existing.back')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSourceStep = () => (
    <View>
      {renderError()}
      <Text style={styles.sectionTitle}>{t('scan.sourceTitle')}</Text>
      <TouchableOpacity style={styles.bigButton} onPress={() => handlePickSource('camera')} testID="existing-source-camera">
        <Ionicons name="camera-outline" size={22} color="#fff" />
        <Text style={styles.bigButtonText}>{t('scan.sourceCamera')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.bigButton, styles.bigButtonSecondary]} onPress={() => handlePickSource('gallery')} testID="existing-source-gallery">
        <Ionicons name="images-outline" size={22} color={Colors.primary} />
        <Text style={styles.bigButtonSecondaryText}>{t('scan.sourceGallery')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.backLink} onPress={handleBackToMenu} testID="existing-back">
        <Text style={styles.backLinkText}>{t('existing.back')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderProcessingStep = () => (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.processingText}>{t('scan.processing')}</Text>
      {queueInfo.position != null && (
        <Text style={styles.queueText}>{t('scan.queuePosition', { position: queueInfo.position })}</Text>
      )}
      {queueInfo.wait != null && (
        <Text style={styles.queueText}>{t('scan.estimatedWait', { time: formatWaitSeconds(queueInfo.wait) })}</Text>
      )}
    </View>
  );

  const renderInfoLine = (label: string, value?: string | null) =>
    value ? <Text style={styles.hintText}>{label}: {value}</Text> : null;

  // Lo leído, para corregir antes de buscar (código de barras o nombre del producto)
  const renderEditStep = () => (
    <View>
      {renderError()}
      {method === 'barcode' ? (
        <>
          <Text style={styles.sectionTitle}>{barcode ? t('existing.barcodeTitle') : t('existing.barcodeNotRead')}</Text>
          <Text style={styles.label}>{t('product.codigoBarras')}</Text>
          <AppTextInput
            testID="existing-barcode-input"
            style={styles.input}
            keyboardType="number-pad"
            maxLength={BARCODE_MAX_DIGITS}
            value={barcode}
            onChangeText={v => { setBarcode(onlyDigits(v)); setError(null); }}
            placeholder={t('product.codigoBarras')}
            placeholderTextColor={Colors.placeholder}
          />
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>{t('existing.labelTitle')}</Text>
          {!labelDraft?.nombre ? <Text testID="existing-name-not-read" style={styles.hintText}>{t('existing.nameNotRead')}</Text> : null}
          {labelDraft?.texto_leido ? <Text style={styles.hintText}>{t('scan.readText', { text: labelDraft.texto_leido })}</Text> : null}
          {renderInfoLine(t('product.marca'), labelDraft?.marca)}
          {renderInfoLine(t('product.categoria'), labelDraft?.categoria)}
          {renderInfoLine(t('product.vencimiento'), labelDraft?.vencimiento ? isoToDisplay(labelDraft.vencimiento) : null)}
          <Text style={styles.label}>{t('existing.nameLabel')} *</Text>
          <AppTextInput
            testID="existing-label-name-input"
            style={styles.input}
            placeholder={t('existing.namePlaceholder')}
            placeholderTextColor={Colors.placeholder}
            value={labelName}
            onChangeText={v => { setLabelName(v); setError(null); }}
          />
        </>
      )}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.cancelAction} onPress={handleClose} testID="existing-edit-cancel">
          <Text style={styles.cancelActionText}>{t('existing.cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmAction, searching && styles.disabled]}
          onPress={handleConfirmEdit}
          disabled={searching}
          testID="existing-edit-confirm"
        >
          <Text style={styles.confirmActionText}>{t('existing.confirm')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderResultsStep = () => (
    <View>
      {!selected && renderOptionsList()}
      {renderStockForm()}
      {!selected && (
        <TouchableOpacity style={styles.backLink} onPress={() => { clearSelection(); setStep('edit'); }} testID="existing-edit-again">
          <Text style={styles.backLinkText}>{t('existing.editAgain')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 'name': return renderNameStep();
      case 'source': return renderSourceStep();
      case 'processing': return renderProcessingStep();
      case 'edit': return renderEditStep();
      case 'results': return renderResultsStep();
      case 'menu':
      default:
        return renderMenu();
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onRequestClose={handleClose}
      sheetStyle={styles.sheet}
      overlayTestID="existing-overlay"
      sheetTestID="existing-sheet"
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t(mode === 'exit' ? 'scan.openButton' : 'existing.title')}</Text>
        <TouchableOpacity onPress={handleClose} testID="existing-modal-close">
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        {renderStep()}
      </KeyboardAwareScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 20, fontFamily: 'Roboto_500Medium', color: Colors.textPrimary },
  content: { padding: 20, paddingTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 10 },
  optionsTitleSpaced: { marginTop: 24 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginTop: 12 },
  hintText: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  errorBanner: {
    backgroundColor: '#fdecea',
    color: Colors.inputBorderError,
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 12,
  },
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
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  menuButtonText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  optionsBox: {
    borderWidth: 1,
    borderColor: Colors.inputBorder ?? '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 4,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#f2fbf9',
  },
  optionTextBox: { flex: 1 },
  optionText: { fontSize: 14, color: Colors.textPrimary },
  optionSubtext: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  linkText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelAction: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: '#fff',
  },
  cancelActionText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 14 },
  confirmAction: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 10, backgroundColor: Colors.primary },
  confirmActionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  disabled: { opacity: 0.6 },
  bigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  bigButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  bigButtonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.primary },
  bigButtonSecondaryText: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
  backLink: { alignItems: 'center', marginTop: 14 },
  backLinkText: { color: Colors.textSecondary, fontSize: 13 },
  centered: { alignItems: 'center', paddingVertical: 24 },
  processingText: { marginTop: 12, fontSize: 14, color: Colors.textPrimary },
  queueText: { marginTop: 4, fontSize: 12, color: Colors.textSecondary },
});
