import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { productService } from '@/services/productService';
import { ocrService, getScanErrorMessage } from '@/services/ocrService';
import { ProductCreate, ProductSuggestion } from '@/types/product';
import { ProductMatch, SalidaOCRResult, ScanDocType, ScanState, SCAN_DOC_TYPES } from '@/types/ocr';
import {
  applyMatchToForm,
  buildSalidaItems,
  draftToProductForm,
  formatWaitSeconds,
  initReceiptLines,
  isLowConfidence,
  ReceiptLineState,
  validateProductForm,
} from '@/utils/ocrDraft';
import ProductFormFields from '@/components/ProductFormFields';

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
}: Props) {
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('doc-type');
  const [docType, setDocType] = useState<ScanDocType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueInfo, setQueueInfo] = useState<{ position?: number | null; wait?: number | null }>({});
  const [scanResult, setScanResult] = useState<ScanState['result']>(null);

  const [draftForm, setDraftForm] = useState<Partial<ProductCreate>>({});
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [expiryValue, setExpiryValue] = useState('');
  const [expiryQuery, setExpiryQuery] = useState('');
  const [expirySuggestions, setExpirySuggestions] = useState<ProductSuggestion[]>([]);
  const [expirySelected, setExpirySelected] = useState<ProductSuggestion | null>(null);

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

  useEffect(() => {
    if (expirySelected) return;
    const q = expiryQuery.trim();
    if (q.length < 2) {
      setExpirySuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      productService.suggestProducts(q).then(setExpirySuggestions).catch(() => setExpirySuggestions([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [expiryQuery, expirySelected]);

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
    setStep('doc-type');
    setDocType(null);
    setError(null);
    setQueueInfo({});
    setScanResult(null);
    setDraftForm({});
    setConfirmError(null);
    setConfirming(false);
    setExpiryValue('');
    setExpiryQuery('');
    setExpirySuggestions([]);
    setExpirySelected(null);
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
    try {
      const asset = await ocrService.pickImage(source);
      if (!asset) return;
      await runScan(docType, asset);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('scan.errorUpload');
      setError(message);
      setStep('doc-type');
    }
  };

  const runScan = async (type: ScanDocType, asset: { uri: string; fileName?: string | null; mimeType?: string | null }) => {
    setStep('processing');
    setQueueInfo({});
    try {
      const initial = await ocrService.scan(
        { uri: asset.uri, name: asset.fileName, type: asset.mimeType },
        type,
      );
      const finalState = initial.status === 'done' || initial.status === 'failed'
        ? initial
        : await ocrService.pollJob(initial.job_id as string, {
            onUpdate: (state) => setQueueInfo({ position: state.queue_position, wait: state.estimated_wait_seconds }),
            shouldStop: () => cancelledRef.current,
          });

      if (cancelledRef.current) return;

      if (finalState.status === 'failed' || !finalState.result) {
        setError(t('scan.errorFailed', { reason: finalState.error ?? '' }));
        setStep('doc-type');
        return;
      }

      applyResult(type, finalState.result);
    } catch (err: unknown) {
      if (cancelledRef.current) return;
      const message = err instanceof Error && err.message === 'timeout'
        ? t('scan.errorTimeout')
        : err instanceof Error && err.message === 'cancelado'
          ? null
          : getScanErrorMessage(err, t('scan.errorPoll'));
      if (message) setError(message);
      setStep('doc-type');
    }
  };

  const applyResult = (type: ScanDocType, result: NonNullable<ScanState['result']>) => {
    setScanResult(result);
    if (type === 'receipt') {
      setLines(initReceiptLines(result.items));
    } else if (type === 'expiry_date') {
      setExpiryValue(result.draft?.vencimiento ?? '');
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

  const handleConfirmExpiry = async () => {
    if (!expirySelected) {
      setConfirmError(t('scan.expiryNoProductSelected'));
      return;
    }
    setConfirmError(null);
    setConfirming(true);
    try {
      await productService.updateProduct(expirySelected.id, { vencimiento: expiryValue || undefined });
      onSuccess('updated');
      handleClose();
    } catch (err: unknown) {
      setConfirmError(getScanErrorMessage(err, t('inventory.saveError')));
    } finally {
      setConfirming(false);
    }
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

  const pickExpirySuggestion = (s: ProductSuggestion) => {
    setExpirySelected(s);
    setExpiryQuery(s.nombre + (s.marca ? ` · ${s.marca}` : ''));
    setExpirySuggestions([]);
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
        {SCAN_DOC_TYPES.map(type => (
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
      <Text style={styles.sectionTitle}>{t('scan.sourceTitle')}</Text>
      <TouchableOpacity style={styles.bigButton} onPress={() => handlePickSource('camera')} testID="scan-source-camera">
        <Ionicons name="camera-outline" size={22} color="#fff" />
        <Text style={styles.bigButtonText}>{t('scan.sourceCamera')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.bigButton, styles.bigButtonSecondary]} onPress={() => handlePickSource('gallery')} testID="scan-source-gallery">
        <Ionicons name="images-outline" size={22} color={Colors.primary} />
        <Text style={styles.bigButtonSecondaryText}>{t('scan.sourceGallery')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.backLink} onPress={() => setStep('doc-type')}>
        <Text style={styles.backLinkText}>{t('scan.back')}</Text>
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

  const renderExpiryReview = () => {
    if (!scanResult) return null;
    return (
      <View>
        {confirmError && <Text style={styles.errorBanner}>{confirmError}</Text>}
        <Text style={styles.sectionTitle}>
          {expiryValue ? t('scan.expiryTitle', { date: expiryValue }) : t('scan.expiryNoDate')}
        </Text>
        <Text style={styles.label}>{t('scan.expirySelectProduct')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('scan.expirySearchPlaceholder')}
          placeholderTextColor={Colors.placeholder}
          value={expiryQuery}
          onChangeText={(v) => { setExpiryQuery(v); setExpirySelected(null); }}
          testID="expiry-search-input"
        />
        {!expirySelected && expirySuggestions.length > 0 && (
          <View style={styles.suggestionsBox}>
            {expirySuggestions.map(s => (
              <TouchableOpacity key={s.id} style={styles.suggestionItem} onPress={() => pickExpirySuggestion(s)}>
                <Text style={styles.suggestionText}>{s.nombre}{s.marca ? ` · ${s.marca}` : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmExpiry} disabled={confirming} testID="confirm-expiry">
          <Text style={styles.confirmButtonText}>{confirming ? t('scan.confirming') : t('scan.confirm')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={resetAll}>
          <Text style={styles.backLinkText}>{t('scan.scanAnother')}</Text>
        </TouchableOpacity>
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
              <TextInput
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
                {line.draft.coincidencias.map(match => (
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
                <TextInput
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
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('scan.title')}</Text>
          <TouchableOpacity onPress={handleClose} testID="scan-modal-close">
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {renderStep()}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.textPrimary },
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
