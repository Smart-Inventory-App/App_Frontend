import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppTextInput from '@/components/AppTextInput';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { productService } from '@/services/productService';
import { ocrService, getScanErrorMessage } from '@/services/ocrService';
import { ProductCreate, ProductSuggestion } from '@/types/product';
import { FieldScanDocType, GENERAL_SCAN_DOC_TYPES, ProductMatch, SalidaOCRResult, ScanDocType, ScanState } from '@/types/ocr';
import {
  applyMatchToForm,
  applySuggestionToForm,
  buildSalidaItems,
  draftToProductForm,
  formatWaitSeconds,
  initReceiptLines,
  isLowConfidence,
  ReceiptLineState,
  validateProductForm,
} from '@/utils/ocrDraft';
import BottomSheetModal from '@/components/BottomSheetModal';
import ProductFormFields from '@/components/ProductFormFields';
import { BARCODE_MAX_DIGITS, isValidBarcode, onlyDigits } from '@/utils/barcode';
import { displayToIso, formatDateDigits, isoToDisplay } from '@/utils/dateInput';
import { selectedFirst } from '@/utils/selectedFirst';

// La lista de productos con el código muestra 3,5 filas: la mitad de la cuarta invita a deslizar
const BARCODE_ROW_HEIGHT = 60;
const BARCODE_ROW_GAP = 8;
const BARCODE_LIST_MAX_HEIGHT = 3.5 * (BARCODE_ROW_HEIGHT + BARCODE_ROW_GAP);

type Step = 'doc-type' | 'source' | 'processing' | 'review' | 'receipt-result';

export type ScanSuccessKind = 'created' | 'merged' | 'updated' | 'salida';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: (kind: ScanSuccessKind) => void;
  categoriaOptions?: string[];
  onAddCategoria?: (cat: string) => void;
  ubicacionOptions?: string[];
  onAddUbicacion?: (loc: string) => void;
  marcaOptions?: string[];
  onAddMarca?: (marca: string) => void;
  /**
   * El código de barras y la fecha de vencimiento escaneados no crean nada: se vuelcan al formulario de
   * "Flujo de producto" conservando lo que el usuario ya había completado.
   */
  onApplyToForm?: (updater: (form: Partial<ProductCreate>) => Partial<ProductCreate>) => void;
  /**
   * Si se indica (fecha de vencimiento o código de barras), el modal no pregunta qué se va a escanear:
   * arranca directamente en "elegí cómo cargar la foto" con el título de ese campo.
   */
  fixedDocType?: FieldScanDocType | null;
}

const DOC_TYPE_ICONS: Record<ScanDocType, keyof typeof Ionicons.glyphMap> = {
  product_label: 'pricetag-outline',
  expiry_date: 'calendar-outline',
  receipt: 'receipt-outline',
  barcode: 'barcode-outline',
};

export default function ScanModal({
  visible,
  onClose,
  onSuccess,
  categoriaOptions = [],
  onAddCategoria,
  ubicacionOptions = [],
  onAddUbicacion,
  marcaOptions = [],
  onAddMarca,
  onApplyToForm,
  fixedDocType = null,
}: Props) {
  const { t } = useTranslation();
  // Primer paso del modal: elegir el tipo de documento, o directamente la foto si el tipo ya está definido
  const firstStep: Step = fixedDocType ? 'source' : 'doc-type';

  const [step, setStep] = useState<Step>(firstStep);
  const [docType, setDocType] = useState<ScanDocType | null>(fixedDocType);
  const [error, setError] = useState<string | null>(null);
  const [queueInfo, setQueueInfo] = useState<{ position?: number | null; wait?: number | null }>({});
  const [scanResult, setScanResult] = useState<ScanState['result']>(null);

  const [draftForm, setDraftForm] = useState<Partial<ProductCreate>>({});
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Fecha de vencimiento escaneada: lo que se leyó y lo que el usuario deja (DD/MM/AAAA)
  const [expiryRead, setExpiryRead] = useState('');
  const [expiryText, setExpiryText] = useState('');

  // Código de barras escaneado, editable, y los productos del usuario que lo tienen
  const [barcodeValue, setBarcodeValue] = useState('');
  const [barcodeProducts, setBarcodeProducts] = useState<ProductSuggestion[]>([]);
  const [barcodeSelectedId, setBarcodeSelectedId] = useState<number | null>(null);

  const [lines, setLines] = useState<ReceiptLineState[]>([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [lineSearchQuery, setLineSearchQuery] = useState('');
  const [lineSearchResults, setLineSearchResults] = useState<ProductSuggestion[]>([]);
  const [receiptResult, setReceiptResult] = useState<SalidaOCRResult | null>(null);

  const cancelledRef = useRef(false);

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

  // Busca los productos que tienen el código mientras el usuario lo corrige
  useEffect(() => {
    if (docType !== 'barcode' || step !== 'review') return;
    if (!isValidBarcode(barcodeValue)) {
      setBarcodeProducts([]);
      setBarcodeSelectedId(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      productService
        .getProductsByBarcode(barcodeValue)
        .then(found => { if (!cancelled) setBarcodeProducts(found); })
        .catch(() => { if (!cancelled) setBarcodeProducts([]); });
    }, 400);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [docType, step, barcodeValue]);

  useEffect(() => {
    if (activeSearchIndex === null) return;
    const q = lineSearchQuery.trim();
    if (q.length < 2) {
      setLineSearchResults([]);
      return;
    }
    const handle = setTimeout(() => {
      productService.suggestProducts(q).then(setLineSearchResults).catch(() => setLineSearchResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [lineSearchQuery, activeSearchIndex]);

  function resetAll() {
    setStep(firstStep);
    setDocType(fixedDocType);
    setError(null);
    setQueueInfo({});
    setScanResult(null);
    setDraftForm({});
    setConfirmError(null);
    setConfirming(false);
    setExpiryRead('');
    setExpiryText('');
    setBarcodeValue('');
    setBarcodeProducts([]);
    setBarcodeSelectedId(null);
    setLines([]);
    setActiveSearchIndex(null);
    setLineSearchQuery('');
    setLineSearchResults([]);
    setReceiptResult(null);
  }

  const handleClose = () => {
    cancelledRef.current = true;
    resetAll();
    onClose();
  };

  const handlePickDocType = (type: ScanDocType) => {
    setDocType(type);
    setError(null);
    setStep('source');
  };

  const handlePickSource = async (source: 'camera' | 'gallery') => {
    if (!docType) return;
    setError(null);
    try {
      const asset = await ocrService.pickImage(source);
      if (!asset) return;
      await runScan(docType, asset);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('scan.errorUpload');
      setError(message);
      setStep(firstStep);
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
      const finalState = initial.status === 'done' || initial.status === 'failed'
        ? initial
        : await ocrService.pollJob(initial.job_id as string, {
            onUpdate: (state) => setQueueInfo({ position: state.queue_position, wait: state.estimated_wait_seconds }),
            shouldStop: () => cancelledRef.current,
          });

      if (cancelledRef.current) return;

      if (finalState.status === 'failed' || !finalState.result) {
        setError(t('scan.errorFailed', { reason: finalState.error ?? '' }));
        setStep(firstStep);
        return;
      }

      applyResult(type, finalState.result);
    } catch (err: unknown) {
      if (cancelledRef.current) return;
      const message = err instanceof Error && err.message === 'timeout'
        ? t('scan.errorTimeout')
        : err instanceof Error && err.message === 'cancelado'
          ? null
          : getScanErrorMessage(err, stage === 'upload' ? t('scan.errorUpload') : t('scan.errorPoll'));
      if (message) setError(message);
      setStep(firstStep);
    }
  };

  const applyResult = (type: ScanDocType, result: NonNullable<ScanState['result']>) => {
    setScanResult(result);
    if (type === 'receipt') {
      setLines(initReceiptLines(result.items));
    } else if (type === 'expiry_date') {
      const read = isoToDisplay(result.draft?.vencimiento ?? '');
      setExpiryRead(read);
      setExpiryText(read);
    } else if (type === 'barcode') {
      setBarcodeValue(onlyDigits(result.draft?.codigo_barras ?? ''));
    } else {
      setDraftForm(draftToProductForm(result.draft));
    }
    setStep('review');
  };

  const handleUseMatch = (match: ProductMatch) => {
    setDraftForm(prev => applyMatchToForm(prev, match));
  };

  const handleConfirmDraft = async () => {
    const errorCode = validateProductForm(draftForm);
    if (errorCode) {
      setConfirmError(t(`product.validation${errorCode.charAt(0).toUpperCase()}${errorCode.slice(1)}`));
      return;
    }
    setConfirmError(null);
    setConfirming(true);
    try {
      const created = await productService.createProduct(draftForm as ProductCreate);
      onSuccess(created.merged ? 'merged' : 'created');
      handleClose();
    } catch (err: unknown) {
      setConfirmError(getScanErrorMessage(err, t('product.saveError')));
    } finally {
      setConfirming(false);
    }
  };

  // Vuelve al formulario de "Flujo de producto" con la fecha escaneada, sin tocar el resto de lo completado
  const handleConfirmExpiry = () => {
    const iso = displayToIso(expiryText);
    if (!iso) {
      setExpiryText('');
      setConfirmError(t('product.validationVencimiento'));
      return;
    }
    onApplyToForm?.(form => ({ ...form, vencimiento: iso }));
    handleClose();
  };

  // Con un producto elegido se cargan sus datos; si no, solo el código de barras
  const handleConfirmBarcode = () => {
    if (!isValidBarcode(barcodeValue)) {
      setConfirmError(t('product.validationCodigoBarras'));
      return;
    }
    const selected = barcodeProducts.find(p => p.id === barcodeSelectedId);
    if (selected) {
      onApplyToForm?.(form => applySuggestionToForm(form, selected));
    } else {
      onApplyToForm?.(form => ({ ...form, codigo_barras: barcodeValue }));
    }
    handleClose();
  };

  const handleConfirmReceipt = async () => {
    const items = buildSalidaItems(lines);
    if (items.length === 0) {
      setConfirmError(t('scan.receiptNoItemsSelected'));
      return;
    }
    setConfirmError(null);
    setConfirming(true);
    try {
      const result = await ocrService.submitSalida(items, scanResult?.comprobante?.comercio);
      setReceiptResult(result);
      setStep('receipt-result');
    } catch (err: unknown) {
      setConfirmError(getScanErrorMessage(err, t('product.saveError')));
    } finally {
      setConfirming(false);
    }
  };

  const handleReceiptDone = () => {
    onSuccess('salida');
    handleClose();
  };

  const openLineSearch = (index: number) => {
    setActiveSearchIndex(index);
    setLineSearchQuery('');
    setLineSearchResults([]);
  };

  const pickLineSuggestion = (s: ProductSuggestion) => {
    if (activeSearchIndex === null) return;
    setLines(prev => prev.map((line, i) => (i === activeSearchIndex ? { ...line, productId: s.id } : line)));
    setActiveSearchIndex(null);
    setLineSearchResults([]);
  };

  const updateLineQuantity = (index: number, value: string) => {
    const digits = value.replace(/[^0-9]/g, '');
    const quantity = digits === '' ? 0 : parseInt(digits, 10);
    setLines(prev => prev.map((line, i) => (i === index ? { ...line, quantity } : line)));
  };

  const toggleLineIncluded = (index: number, match?: ProductMatch) => {
    setLines(prev => prev.map((line, i) => {
      if (i !== index) return line;
      if (line.productId != null) return { ...line, productId: null };
      return { ...line, productId: match?.id ?? line.draft.coincidencia_id ?? null };
    }));
  };

  const renderDocTypeStep = () => (
    <View>
      {error && <Text style={styles.errorBanner}>{error}</Text>}
      <Text style={styles.sectionTitle}>{t('scan.docTypeTitle')}</Text>
      <View style={styles.docTypeGrid}>
        {GENERAL_SCAN_DOC_TYPES.map(type => (
          <TouchableOpacity key={type} style={styles.docTypeCard} onPress={() => handlePickDocType(type)} testID={`doc-type-${type}`}>
            <Ionicons name={DOC_TYPE_ICONS[type]} size={28} color={Colors.primary} />
            <Text style={styles.docTypeCardText}>{t(`scan.docType.${type}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSourceStep = () => (
    <View>
      {error && <Text style={styles.errorBanner}>{error}</Text>}
      <Text style={styles.sectionTitle}>{t('scan.sourceTitle')}</Text>
      <TouchableOpacity style={styles.bigButton} onPress={() => handlePickSource('camera')} testID="scan-source-camera">
        <Ionicons name="camera-outline" size={22} color="#fff" />
        <Text style={styles.bigButtonText}>{t('scan.sourceCamera')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.bigButton, styles.bigButtonSecondary]} onPress={() => handlePickSource('gallery')} testID="scan-source-gallery">
        <Ionicons name="images-outline" size={22} color={Colors.primary} />
        <Text style={styles.bigButtonSecondaryText}>{t('scan.sourceGallery')}</Text>
      </TouchableOpacity>
      {!fixedDocType && (
        <TouchableOpacity style={styles.backLink} onPress={() => setStep('doc-type')}>
          <Text style={styles.backLinkText}>{t('scan.back')}</Text>
        </TouchableOpacity>
      )}
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

  const renderMatches = (coincidencias: ProductMatch[]) => {
    if (!coincidencias.length) return null;
    return (
      <View style={styles.matchesBox}>
        <Text style={styles.sectionTitle}>{t('scan.matchesTitle')}</Text>
        {coincidencias.map(match => (
          <TouchableOpacity key={match.id} style={styles.matchRow} onPress={() => handleUseMatch(match)} testID={`match-${match.id}`}>
            <Ionicons name="cube-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.matchText}>
              {match.nombre}{match.marca ? ` · ${match.marca}` : ''} ({Math.round(match.score * 100)}%)
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderSingleReview = () => {
    if (!scanResult) return null;
    const draft = scanResult.draft;
    return (
      <View>
        {confirmError && <Text style={styles.errorBanner}>{confirmError}</Text>}
        {draft?.texto_leido ? <Text style={styles.hintText}>{t('scan.readText', { text: draft.texto_leido })}</Text> : null}
        {scanResult.advertencias.length > 0 && <Text style={styles.warningText}>{t('scan.warnings')}</Text>}
        {draft && renderMatches(draft.coincidencias)}
        {draft && isLowConfidence(draft.confianzas, 'nombre') && (
          <Text style={styles.warningText}>{t('scan.lowConfidenceHint')}</Text>
        )}
        <ProductFormFields
          form={draftForm}
          onChange={setDraftForm}
          categoriaOptions={categoriaOptions}
          onAddCategoria={onAddCategoria}
          ubicacionOptions={ubicacionOptions}
          onAddUbicacion={onAddUbicacion}
          marcaOptions={marcaOptions}
          onAddMarca={onAddMarca}
        />
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmDraft} disabled={confirming} testID="confirm-draft">
          <Text style={styles.confirmButtonText}>{confirming ? t('scan.confirming') : t('scan.confirm')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={resetAll}>
          <Text style={styles.backLinkText}>{t('scan.scanAnother')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderActions = (onConfirm: () => void, testPrefix: string) => (
    <View style={styles.actionsRow}>
      <TouchableOpacity style={styles.cancelAction} onPress={handleClose} testID={`${testPrefix}-cancel`}>
        <Text style={styles.cancelActionText}>{t('common.cancel')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.confirmAction} onPress={onConfirm} testID={`${testPrefix}-confirm`}>
        <Text style={styles.confirmActionText}>{t('scan.confirm')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBarcodeReview = () => {
    const valid = isValidBarcode(barcodeValue);
    return (
      <View>
        {confirmError && <Text style={styles.errorBanner}>{confirmError}</Text>}
        <Text style={styles.sectionTitle}>
          {barcodeValue ? t('scan.barcodeTitle') : t('scan.barcodeNone')}
        </Text>
        <Text style={styles.label}>{t('product.codigoBarras')}</Text>
        <AppTextInput
          style={styles.input}
          keyboardType="number-pad"
          maxLength={BARCODE_MAX_DIGITS}
          value={barcodeValue}
          onChangeText={(v) => { setBarcodeValue(onlyDigits(v)); setConfirmError(null); }}
          placeholder={t('product.codigoBarras')}
          placeholderTextColor={Colors.placeholder}
          testID="barcode-input"
        />
        {valid && barcodeProducts.length > 0 && (
          <View style={styles.matchesBox}>
            <Text style={styles.sectionTitle}>{t('scan.barcodeProductsTitle')}</Text>
            <ScrollView
              testID="barcode-products-list"
              style={{ maxHeight: BARCODE_LIST_MAX_HEIGHT }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
            {selectedFirst(barcodeProducts, p => p.id === barcodeSelectedId).map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.productRow, barcodeSelectedId === p.id && styles.productRowActive]}
                onPress={() => setBarcodeSelectedId(prev => (prev === p.id ? null : p.id))}
                testID={`barcode-product-${p.id}`}
              >
                <Ionicons
                  name={barcodeSelectedId === p.id ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={Colors.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.matchText} numberOfLines={1}>{p.nombre}{p.marca ? ` · ${p.marca}` : ''}</Text>
                  <Text style={styles.hintText} numberOfLines={1}>
                    {p.vencimiento ? t('scan.productExpires', { date: isoToDisplay(p.vencimiento) }) : t('scan.productNoExpiry')}
                    {' · '}Stock: {p.stock}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            </ScrollView>
          </View>
        )}
        {valid && barcodeProducts.length === 0 && (
          <Text style={styles.hintText}>{t('scan.barcodeNoProducts')}</Text>
        )}
        {renderActions(handleConfirmBarcode, 'barcode')}
      </View>
    );
  };

  const renderExpiryReview = () => {
    if (!scanResult) return null;
    return (
      <View>
        {confirmError && <Text style={styles.errorBanner}>{confirmError}</Text>}
        <Text style={styles.sectionTitle}>
          {expiryRead ? t('scan.expiryTitle', { date: expiryRead }) : t('scan.expiryNoDate')}
        </Text>
        <Text style={styles.label}>{t('product.vencimiento')}</Text>
        <AppTextInput
          style={styles.input}
          keyboardType="number-pad"
          maxLength={10}
          value={expiryText}
          onChangeText={(v) => { setExpiryText(formatDateDigits(v)); setConfirmError(null); }}
          placeholder={t('product.vencimientoPlaceholder')}
          placeholderTextColor={Colors.placeholder}
          testID="expiry-input"
        />
        {renderActions(handleConfirmExpiry, 'expiry')}
      </View>
    );
  };

  const renderReceiptReview = () => {
    if (!scanResult) return null;
    const { comprobante } = scanResult;
    return (
      <View>
        {confirmError && <Text style={styles.errorBanner}>{confirmError}</Text>}
        <Text style={styles.sectionTitle}>{t('scan.receiptHeaderTitle')}</Text>
        {comprobante?.comercio ? <Text style={styles.hintText}>{t('scan.receiptComercio', { value: comprobante.comercio })}</Text> : null}
        {comprobante?.fecha_compra ? <Text style={styles.hintText}>{t('scan.receiptFecha', { value: comprobante.fecha_compra })}</Text> : null}
        {comprobante?.total != null ? <Text style={styles.hintText}>{t('scan.receiptTotal', { value: comprobante.total })}</Text> : null}

        <Text style={styles.sectionTitle}>{t('scan.receiptItemsTitle')}</Text>
        {lines.length === 0 && <Text style={styles.hintText}>{t('scan.receiptNoItems')}</Text>}
        {lines.map((line, index) => (
          <View key={index} style={styles.receiptLine} testID={`receipt-line-${index}`}>
            <Text style={styles.receiptLineName}>{line.draft.nombre ?? line.draft.texto_leido}</Text>
            {line.draft.coincidencias.length === 0 && line.productId == null && (
              <Text style={styles.warningText}>{t('scan.receiptNoMatch')}</Text>
            )}
            <View style={styles.receiptLineRow}>
              <AppTextInput
                style={[styles.input, styles.receiptQuantityInput]}
                keyboardType="numeric"
                value={String(line.quantity)}
                onChangeText={(v) => updateLineQuantity(index, v)}
                testID={`receipt-quantity-${index}`}
              />
              <TouchableOpacity
                style={styles.receiptToggle}
                onPress={() => toggleLineIncluded(index, line.draft.coincidencias[0])}
                testID={`receipt-toggle-${index}`}
              >
                <Text style={styles.receiptToggleText}>
                  {line.productId != null ? t('scan.receiptExclude') : t('scan.receiptInclude')}
                </Text>
              </TouchableOpacity>
            </View>
            {line.draft.coincidencias.length > 0 && (
              <View style={styles.chipsContent}>
                {selectedFirst(line.draft.coincidencias, m => m.id === line.productId).map(match => (
                  <TouchableOpacity
                    key={match.id}
                    style={[styles.chip, line.productId === match.id && styles.chipActive]}
                    onPress={() => setLines(prev => prev.map((l, i) => (i === index ? { ...l, productId: match.id } : l)))}
                  >
                    <Text style={[styles.chipText, line.productId === match.id && styles.chipTextActive]}>
                      {match.nombre} ({Math.round(match.score * 100)}%)
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity onPress={() => openLineSearch(index)} testID={`receipt-search-open-${index}`}>
              <Text style={styles.linkText}>{t('scan.receiptSearchProduct')}</Text>
            </TouchableOpacity>
            {activeSearchIndex === index && (
              <View>
                <AppTextInput
                  style={styles.input}
                  value={lineSearchQuery}
                  onChangeText={setLineSearchQuery}
                  placeholder={t('scan.receiptSearchProduct')}
                  placeholderTextColor={Colors.placeholder}
                  testID={`receipt-search-input-${index}`}
                />
                {lineSearchResults.length > 0 && (
                  <View style={styles.suggestionsBox}>
                    {lineSearchResults.map(s => (
                      <TouchableOpacity key={s.id} style={styles.suggestionItem} onPress={() => pickLineSuggestion(s)}>
                        <Text style={styles.suggestionText}>{s.nombre}{s.marca ? ` · ${s.marca}` : ''}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmReceipt} disabled={confirming} testID="confirm-receipt">
          <Text style={styles.confirmButtonText}>{confirming ? t('scan.confirming') : t('scan.receiptSubmit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={resetAll}>
          <Text style={styles.backLinkText}>{t('scan.scanAnother')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderReview = () => {
    if (docType === 'receipt') return renderReceiptReview();
    if (docType === 'expiry_date') return renderExpiryReview();
    if (docType === 'barcode') return renderBarcodeReview();
    return renderSingleReview();
  };

  const renderReceiptResult = () => (
    <View style={styles.centered}>
      <Ionicons name="checkmark-circle" size={56} color={Colors.primary} />
      <Text style={styles.sectionTitle}>{t('scan.receiptResultTitle')}</Text>
      {receiptResult && (
        <Text style={styles.hintText}>
          {t('scan.receiptResultSummary', { procesados: receiptResult.procesados, fallidos: receiptResult.fallidos })}
        </Text>
      )}
      {receiptResult && receiptResult.errores.length > 0 && (
        <View>
          <Text style={styles.warningText}>{t('scan.receiptResultErrors')}</Text>
          {receiptResult.errores.map((e, i) => (
            <Text key={i} style={styles.warningText}>{e}</Text>
          ))}
        </View>
      )}
      <TouchableOpacity style={styles.confirmButton} onPress={handleReceiptDone} testID="receipt-result-done">
        <Text style={styles.confirmButtonText}>{t('scan.done')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 'source': return renderSourceStep();
      case 'processing': return renderProcessingStep();
      case 'review': return renderReview();
      case 'receipt-result': return renderReceiptResult();
      case 'doc-type':
      default:
        return renderDocTypeStep();
    }
  };

  return (
    // Hoja inferior como el historial de consumo: no ocupa toda la pantalla y tocar afuera la cierra
    <BottomSheetModal
      visible={visible}
      onRequestClose={handleClose}
      sheetStyle={styles.sheet}
      overlayTestID="scan-overlay"
      sheetTestID="scan-sheet"
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{fixedDocType === 'expiry_date' ? t('scan.titleExpiry') : fixedDocType === 'barcode' ? t('scan.titleBarcode') : t('scan.title')}</Text>
        <TouchableOpacity onPress={handleClose} testID="scan-modal-close">
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  // Mismo formato que el título "Flujo de producto", un poco más chico
  headerTitle: { fontSize: 20, lineHeight: 26, fontFamily: 'Roboto_500Medium', color: Colors.textPrimary },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginTop: 12, marginBottom: 8 },
  docTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  docTypeCard: {
    width: '47%',
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fafafa',
  },
  docTypeCardText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
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
  backLink: { alignItems: 'center', marginTop: 16 },
  backLinkText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  centered: { alignItems: 'center', justifyContent: 'center', marginTop: 40, gap: 8 },
  processingText: { fontSize: 15, color: Colors.textPrimary, marginTop: 8 },
  queueText: { fontSize: 13, color: Colors.textSecondary },
  errorBanner: { color: Colors.error, fontSize: 13, marginBottom: 8 },
  warningText: { color: Colors.error, fontSize: 12, marginTop: 4 },
  hintText: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  matchesBox: { marginTop: 8, marginBottom: 8 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: BARCODE_ROW_HEIGHT,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    marginBottom: BARCODE_ROW_GAP,
  },
  productRowActive: { borderColor: Colors.primary, backgroundColor: '#f0f9f6' },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cancelActionText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 16 },
  confirmAction: { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
  confirmActionText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  matchText: { fontSize: 13, color: Colors.textPrimary },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginTop: 12 },
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
  suggestionItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestionText: { fontSize: 14, color: Colors.textPrimary },
  confirmButton: { backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
  confirmButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  receiptLine: { borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 10, padding: 12, marginBottom: 12 },
  receiptLineName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  receiptLineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  receiptQuantityInput: { flex: 1, marginTop: 0 },
  receiptToggle: { paddingHorizontal: 10, paddingVertical: 8 },
  receiptToggleText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  linkText: { fontSize: 12, color: Colors.primary, marginTop: 6, fontWeight: '600' },
  chipsContent: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.inputBorder ?? '#ddd',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 11, color: Colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
});
