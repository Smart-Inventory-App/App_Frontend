import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { ExitReason, ProductCreate, ProductSuggestion } from '@/types/product';
import { FixedScanDocType, GENERAL_SCAN_DOC_TYPES, LabelScan, ProductDraft, SalidaOCRItem, SalidaOCRResult, ScanDocType, ScanState } from '@/types/ocr';
import {
  applySuggestionToForm,
  draftToLabelFields,
  EMPTY_LABEL_FIELDS,
  formatWaitSeconds,
  LabelFields,
  labelFieldsToForm,
  validateLabelFields,
} from '@/utils/ocrDraft';
import BottomSheetModal from '@/components/BottomSheetModal';
import CenteredModal from '@/components/CenteredModal';
import ImageViewerModal from '@/components/ImageViewerModal';
import ReceiptItemsReview from '@/components/ReceiptItemsReview';
import { PickedImage, uploadImage } from '@/services/imageService';
import { BARCODE_MAX_DIGITS, isValidBarcode, onlyDigits } from '@/utils/barcode';
import { displayToIso, formatDateDigits, isoToDisplay } from '@/utils/dateInput';
import { selectedFirst } from '@/utils/selectedFirst';

// La lista de productos con el código muestra 3,5 filas: la mitad de la cuarta invita a deslizar
const BARCODE_ROW_HEIGHT = 60;
const BARCODE_ROW_GAP = 8;
const BARCODE_LIST_MAX_HEIGHT = 3.5 * (BARCODE_ROW_HEIGHT + BARCODE_ROW_GAP);

type Step = 'doc-type' | 'source' | 'processing' | 'review' | 'receipt-result';
// Las ventanas iniciales (elegir qué escanear, o cómo cargar la foto de un campo del formulario) suben desde abajo; al
// elegir una opción se cierran y el resto del escaneo ocurre en una ventana en el centro. `hidden`: entre las dos, mientras
// el usuario saca o elige la foto.
type Phase = 'sheet' | 'window' | 'hidden';

// Límites de los campos del formulario de producto
const NOMBRE_MAX = 20;
const OPTION_MAX = 20;
const DESCRIPCION_MAX = 400;

export type ScanSuccessKind = 'created' | 'merged' | 'updated' | 'salida' | 'restocked';

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
   * Si se indica (fecha de vencimiento, código de barras o comprobante), el modal no pregunta qué se va a
   * escanear: arranca directamente en "elegí cómo cargar la foto" con el título de ese tipo.
   */
  fixedDocType?: FixedScanDocType | null;
  /**
   * Qué hace un comprobante escaneado: "entrada" suma el stock de sus renglones a productos ya cargados y
   * "salida" lo descuenta (con el motivo que elija el usuario). Las dos lógicas no se mezclan.
   */
  receiptDirection?: 'entrada' | 'salida';
  /**
   * Una etiqueta ya escaneada (en "Ingresar producto existente", cuando no había ningún producto parecido): el modal
   * arranca directamente en sus datos leídos, para que el usuario los valide.
   */
  initialLabel?: LabelScan | null;
  /** "Cargar como producto existente": lleva el nombre leído al formulario de ingreso de un producto existente. */
  onLoadAsExisting?: (label: LabelScan) => void;
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
  receiptDirection = 'salida',
  initialLabel = null,
  onLoadAsExisting,
}: Props) {
  const { t } = useTranslation();
  // Primer paso del modal: elegir el tipo de documento, o directamente la foto si el tipo ya está definido
  const firstStep: Step = fixedDocType ? 'source' : 'doc-type';
  // Un comprobante elegido en el menú de salida, o una etiqueta ya escaneada, empiezan directamente en la ventana central
  const firstPhase: Phase = initialLabel || fixedDocType === 'receipt' ? 'window' : 'sheet';
  const [phase, setPhase] = useState<Phase>(firstPhase);
  const [step, setStep] = useState<Step>(initialLabel ? 'review' : firstStep);
  const [docType, setDocType] = useState<ScanDocType | null>(initialLabel ? 'product_label' : fixedDocType);
  const [error, setError] = useState<string | null>(null);
  const [queueInfo, setQueueInfo] = useState<{ position?: number | null; wait?: number | null }>({});
  const [scanResult, setScanResult] = useState<ScanState['result']>(null);

  // Etiqueta escaneada: lo leído, la foto (ya recortada) y los campos que el usuario edita antes de pasarlos al formulario
  const [labelDraft, setLabelDraft] = useState<ProductDraft | null>(null);
  const [labelAsset, setLabelAsset] = useState<LabelScan['asset']>(null);
  const [labelFields, setLabelFields] = useState<LabelFields>({ ...EMPTY_LABEL_FIELDS });
  const [confirmError, setConfirmError] = useState<string | null>(null);
  // El error del nombre va debajo de su campo
  const [nameError, setNameError] = useState<string | null>(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Fecha de vencimiento escaneada: lo que se leyó y lo que el usuario deja (DD/MM/AAAA)
  const [expiryRead, setExpiryRead] = useState('');
  const [expiryText, setExpiryText] = useState('');

  // Código de barras escaneado, editable, y los productos del usuario que lo tienen
  const [barcodeValue, setBarcodeValue] = useState('');
  const [barcodeProducts, setBarcodeProducts] = useState<ProductSuggestion[]>([]);
  const [barcodeSelectedId, setBarcodeSelectedId] = useState<number | null>(null);

  const [receiptResult, setReceiptResult] = useState<SalidaOCRResult | null>(null);
  // Salida de un comprobante: el motivo elegido; sin ninguno, el backend usa el consumo
  const [receiptMotivo, setReceiptMotivo] = useState<ExitReason | null>('consumed');

  // El título dice qué se está escaneando; mientras se elige el tipo, es el general
  const scanTitle = (() => {
    switch (fixedDocType ?? (step === 'doc-type' ? null : docType)) {
      case 'expiry_date': return t('scan.titleExpiry');
      case 'barcode': return t('scan.titleBarcode');
      case 'receipt': return t('scan.docType.receipt');
      case 'product_label': return t('scan.docType.product_label');
      default: return t('scan.title');
    }
  })();

  const cancelledRef = useRef(false);
  const sheetBody = useRef<React.ReactNode>(null);
  const windowBody = useRef<React.ReactNode>(null);
  const resultBody = useRef<React.ReactNode>(null);

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

  function resetAll() {
    setPhase(firstPhase);
    setStep(initialLabel ? 'review' : firstStep);
    setDocType(initialLabel ? 'product_label' : fixedDocType);
    setError(null);
    setQueueInfo({});
    setScanResult(null);
    setLabelDraft(initialLabel?.draft ?? null);
    setLabelAsset(initialLabel?.asset ?? null);
    setLabelFields(draftToLabelFields(initialLabel?.draft));
    setConfirmError(null);
    setNameError(null);
    setImageViewerOpen(false);
    setConfirming(false);
    setExpiryRead('');
    setExpiryText('');
    setBarcodeValue('');
    setBarcodeProducts([]);
    setBarcodeSelectedId(null);
    setReceiptResult(null);
    setReceiptMotivo('consumed');
  }

  const handleClose = () => {
    cancelledRef.current = true;
    resetAll();
    onClose();
  };

  // Vuelve a donde empezó el escaneo (la ventana inicial), por ejemplo después de un error
  const returnToStart = () => {
    setPhase(firstPhase);
    setStep(firstStep);
  };

  const handlePickDocType = (type: ScanDocType) => {
    setDocType(type);
    setError(null);
    setStep('source');
    // La ventana de abajo se cierra y se abre la de este tipo de escaneo, en el centro
    setPhase('window');
  };

  const handlePickSource = async (source: 'camera' | 'gallery') => {
    if (!docType) return;
    setError(null);
    const fromSheet = phase === 'sheet';
    // Desde la ventana de abajo, esta se cierra mientras el usuario saca o elige la foto
    if (fromSheet) setPhase('hidden');
    try {
      // Todo se puede recortar antes de procesarlo, también los comprobantes (con la cámara o desde la galería)
      const asset = await ocrService.pickImage(source);
      if (!asset) {
        // Sin foto no hay nada que escanear: desde la ventana de abajo se vuelve al formulario
        if (fromSheet) handleClose();
        return;
      }
      await runScan(docType, asset);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('scan.errorUpload');
      setError(message);
      returnToStart();
    }
  };

  const runScan = async (type: ScanDocType, asset: { uri: string; fileName?: string | null; mimeType?: string | null }) => {
    setPhase('window');
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
        returnToStart();
        return;
      }

      applyResult(type, finalState.result, asset);
    } catch (err: unknown) {
      if (cancelledRef.current) return;
      const message = err instanceof Error && err.message === 'timeout'
        ? t('scan.errorTimeout')
        : err instanceof Error && err.message === 'cancelado'
          ? null
          : getScanErrorMessage(err, stage === 'upload' ? t('scan.errorUpload') : t('scan.errorPoll'));
      if (message) setError(message);
      returnToStart();
    }
  };

  const applyResult = (type: ScanDocType, result: NonNullable<ScanState['result']>, asset?: LabelScan['asset']) => {
    setScanResult(result);
    if (type === 'expiry_date') {
      const read = isoToDisplay(result.draft?.vencimiento ?? '');
      setExpiryRead(read);
      setExpiryText(read);
    } else if (type === 'barcode') {
      setBarcodeValue(onlyDigits(result.draft?.codigo_barras ?? ''));
    } else {
      setLabelDraft(result.draft);
      setLabelAsset(asset ?? null);
      setLabelFields(draftToLabelFields(result.draft));
    }
    setStep('review');
  };

  const setLabelField = (key: keyof LabelFields, value: string) => {
    setLabelFields(prev => ({ ...prev, [key]: value }));
    setConfirmError(null);
    if (key === 'nombre') setNameError(null);
  };

  // Los datos validados por el usuario pasan al formulario de "Flujo de producto" y la foto escaneada, a ser la imagen
  // del producto; si se cancela, no se carga nada
  const handleConfirmLabel = async () => {
    // Solo el nombre se edita (y es obligatorio); al formulario pasan el nombre, la marca, la descripción y la imagen
    if (validateLabelFields(labelFields) === 'nombre') {
      setNameError(t('product.validationNombre'));
      return;
    }
    setNameError(null);
    setConfirmError(null);
    setConfirming(true);
    let imageUrl: string | undefined;
    try {
      if (labelAsset) imageUrl = await uploadImage(labelAsset as PickedImage);
    } catch {
      if (!cancelledRef.current) {
        setConfirmError(t('scan.labelImageError'));
        setConfirming(false);
      }
      return;
    }
    if (cancelledRef.current) return;
    const values = labelFieldsToForm(labelFields, imageUrl);
    onApplyToForm?.(form => ({ ...form, ...values }));
    // Lo que se escribió y todavía no era una opción se suma a las del formulario
    if (values.marca) onAddMarca?.(values.marca);
    setConfirming(false);
    handleClose();
  };

  // El nombre (y lo demás que se corrigió) viaja al formulario de producto existente
  const handleLoadAsExisting = () => {
    if (!labelDraft) return;
    const edited = labelFields;
    onLoadAsExisting?.({
      draft: {
        ...labelDraft,
        nombre: edited.nombre.trim() || labelDraft.nombre,
        marca: edited.marca.trim() || labelDraft.marca,
        descripcion: edited.descripcion.trim() || labelDraft.descripcion,
      },
      asset: labelAsset,
    });
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

  const isEntrada = receiptDirection === 'entrada';

  const handleConfirmReceipt = async (items: SalidaOCRItem[]) => {
    setConfirmError(null);
    setConfirming(true);
    try {
      const comercio = scanResult?.comprobante?.comercio;
      const result = isEntrada
        ? await ocrService.submitEntrada(items, comercio)
        : await ocrService.submitSalida(items, comercio, receiptMotivo ?? undefined);
      setReceiptResult(result);
      setStep('receipt-result');
    } catch (err: unknown) {
      setConfirmError(getScanErrorMessage(err, t('product.saveError')));
    } finally {
      setConfirming(false);
    }
  };

  const handleReceiptDone = () => {
    onSuccess(isEntrada ? 'restocked' : 'salida');
    handleClose();
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

  // Todos los campos de la etiqueta, también los que no se reconocieron (vacíos, para completarlos); no es un formulario
  // nuevo: son los datos que van a autocompletar el formulario de producto
  const renderLabelField = (key: keyof LabelFields, label: string, extra: object = {}) => {
    const recognized = draftToLabelFields(labelDraft)[key] !== '';
    return (
      <View key={key}>
        <Text style={styles.label}>{label}{key === 'nombre' ? ' *' : ''}</Text>
        <AppTextInput
          testID={`label-field-${key}`}
          style={[styles.input, key === 'nombre' && nameError ? styles.inputError : null]}
          value={labelFields[key]}
          onChangeText={v => setLabelField(key, v)}
          placeholderTextColor={Colors.placeholder}
          {...extra}
        />
        {key === 'nombre' && nameError ? <Text testID="label-error" style={styles.fieldError}>{nameError}</Text> : null}
        {!recognized && !labelFields[key] ? (
          <Text testID={`label-field-${key}-missing`} style={styles.missingHint}>{t('scan.labelNotRecognized')}</Text>
        ) : null}
      </View>
    );
  };

  const renderLabelReview = () => (
    <View>
      <Text style={styles.sectionTitle}>{t('scan.labelReviewTitle')}</Text>
      {labelAsset ? (
        // Tocar la foto la muestra a pantalla completa
        <TouchableOpacity activeOpacity={0.85} onPress={() => setImageViewerOpen(true)} testID="label-image-open">
          <Image testID="label-image" source={{ uri: labelAsset.uri }} style={styles.labelImage} resizeMode="cover" />
        </TouchableOpacity>
      ) : null}
      {labelAsset ? <ImageViewerModal visible={imageViewerOpen} uri={labelAsset.uri} onClose={() => setImageViewerOpen(false)} /> : null}
      {labelDraft?.texto_leido ? <Text testID="label-read-text" style={styles.hintText}>{t('scan.readText', { text: labelDraft.texto_leido })}</Text> : null}
      {renderLabelField('nombre', t('product.nombre'), { maxLength: NOMBRE_MAX, placeholder: t('product.nombre') })}
      {onLoadAsExisting && (
        <TouchableOpacity style={styles.existingButton} onPress={handleLoadAsExisting} testID="label-load-existing">
          <Ionicons name="cube-outline" size={18} color={Colors.primary} />
          <Text style={styles.existingButtonText}>{t('scan.loadAsExisting')}</Text>
        </TouchableOpacity>
      )}
      {renderLabelField('marca', t('product.marca'), { maxLength: OPTION_MAX })}
      {renderLabelField('descripcion', t('product.descripcion'), { maxLength: DESCRIPCION_MAX, multiline: true })}
      {confirmError ? <Text testID="label-error" style={styles.fieldError}>{confirmError}</Text> : null}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.cancelAction} onPress={handleClose} testID="label-cancel">
          <Text style={styles.cancelActionText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmAction, confirming && styles.disabled]}
          onPress={handleConfirmLabel}
          disabled={confirming}
          testID="label-confirm"
        >
          <Text style={styles.confirmActionText}>{confirming ? t('scan.confirming') : t('scan.confirm')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
        <Text style={styles.sectionTitle}>
          {barcodeValue ? t('scan.barcodeTitle') : t('scan.barcodeNone')}
        </Text>
        <Text style={styles.label}>{t('product.codigoBarras')}</Text>
        <AppTextInput
          style={[styles.input, confirmError ? styles.inputError : null]}
          keyboardType="number-pad"
          maxLength={BARCODE_MAX_DIGITS}
          value={barcodeValue}
          onChangeText={(v) => { setBarcodeValue(onlyDigits(v)); setConfirmError(null); }}
          placeholder={t('product.codigoBarras')}
          placeholderTextColor={Colors.placeholder}
          testID="barcode-input"
        />
        {confirmError ? <Text testID="scan-error" style={styles.fieldError}>{confirmError}</Text> : null}
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
        <Text style={styles.sectionTitle}>
          {expiryRead ? t('scan.expiryTitle', { date: expiryRead }) : t('scan.expiryNoDate')}
        </Text>
        <Text style={styles.label}>{t('product.vencimiento')}</Text>
        <AppTextInput
          style={[styles.input, confirmError ? styles.inputError : null]}
          keyboardType="number-pad"
          maxLength={10}
          value={expiryText}
          onChangeText={(v) => { setExpiryText(formatDateDigits(v)); setConfirmError(null); }}
          placeholder={t('product.vencimientoPlaceholder')}
          placeholderTextColor={Colors.placeholder}
          testID="expiry-input"
        />
        {confirmError ? <Text testID="scan-error" style={styles.fieldError}>{confirmError}</Text> : null}
        {renderActions(handleConfirmExpiry, 'expiry')}
      </View>
    );
  };

  const renderReceiptReview = () => {
    if (!scanResult) return null;
    return (
      <ReceiptItemsReview
        drafts={scanResult.items}
        comprobante={scanResult.comprobante}
        direction={receiptDirection}
        motivo={receiptMotivo}
        onMotivoChange={setReceiptMotivo}
        confirming={confirming}
        error={confirmError}
        onConfirm={handleConfirmReceipt}
        onScanAnother={resetAll}
      />
    );
  };

  const renderReview = () => {
    if (docType === 'receipt') return renderReceiptReview();
    if (docType === 'expiry_date') return renderExpiryReview();
    if (docType === 'barcode') return renderBarcodeReview();
    return renderLabelReview();
  };

  const renderReceiptResult = () => (
    <View style={styles.resultContent}>
      <Ionicons name="checkmark-circle" size={56} color={Colors.primary} />
      <Text style={[styles.sectionTitle, styles.resultText]}>{t(isEntrada ? 'scan.receiptResultTitleEntrada' : 'scan.receiptResultTitle')}</Text>
      {receiptResult && (
        <Text testID="receipt-result-summary" style={[styles.hintText, styles.resultText]}>
          {t(`scan.receiptResult${isEntrada ? 'Entrada' : 'Salida'}${receiptResult.procesados === 1 ? 'One' : 'Many'}`, { count: receiptResult.procesados })}
        </Text>
      )}
      {receiptResult && receiptResult.fallidos > 0 && (
        <Text style={[styles.warningText, styles.resultText]}>{t('scan.receiptResultFailed', { count: receiptResult.fallidos })}</Text>
      )}
      {receiptResult && receiptResult.errores.length > 0 && (
        <View>
          <Text style={[styles.warningText, styles.resultText]}>{t('scan.receiptResultErrors')}</Text>
          {receiptResult.errores.map((e, i) => (
            <Text key={i} style={[styles.warningText, styles.resultText]}>{e}</Text>
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
      case 'doc-type':
      default:
        return renderDocTypeStep();
    }
  };

  const header = (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{scanTitle}</Text>
      <TouchableOpacity onPress={handleClose} testID="scan-modal-close">
        <Ionicons name="close" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );

  // Mientras la hoja baja (porque se eligió una opción) sigue mostrando lo último que tenía, sin repetir lo de la ventana central
  if (phase === 'sheet') {
    sheetBody.current = (
      <>
        {header}
        <View style={styles.content}>{renderStep()}</View>
      </>
    );
  }

  // Lo mismo con la ventana central: al cerrarla (X, Cancelar, Atrás) los datos se reinician mientras ella todavía se
  // desvanece, y mostraría un instante la ventana inicial (que ahora es la hoja de abajo). Se queda con lo último que tenía.
  // El resultado de un comprobante registrado es una ventana nueva, sin el título ni la X del escaneo
  const showResult = step === 'receipt-result';
  if (visible && phase === 'window' && showResult) {
    resultBody.current = renderReceiptResult();
  }
  if (visible && phase === 'window' && !showResult) {
    windowBody.current = (
      <>
        {header}
        <KeyboardAwareScrollView contentContainerStyle={styles.content} reserveKeyboardSpace={false}>
          {renderStep()}
        </KeyboardAwareScrollView>
      </>
    );
  }

  return (
    <>
      {/* Ventana inicial: sube desde abajo y tocar afuera vuelve al formulario */}
      <BottomSheetModal
        visible={visible && phase === 'sheet'}
        onRequestClose={handleClose}
        sheetStyle={styles.initialSheet}
        overlayTestID="scan-initial-overlay"
        sheetTestID="scan-initial-sheet"
      >
        {sheetBody.current}
      </BottomSheetModal>
      {/* El escaneo en sí, en el centro de la pantalla: solo se cierra con su botón de cerrar o con Cancelar, no al tocar afuera */}
      <CenteredModal
        visible={visible && phase === 'window' && !showResult}
        onRequestClose={handleClose}
        overlayTestID="scan-overlay"
        cardTestID="scan-sheet"
      >
        {windowBody.current}
      </CenteredModal>
      <CenteredModal
        visible={visible && phase === 'window' && showResult}
        onRequestClose={handleReceiptDone}
        overlayTestID="scan-result-overlay"
        cardTestID="scan-result-sheet"
      >
        {resultBody.current}
      </CenteredModal>
    </>
  );
}

const styles = StyleSheet.create({
  initialSheet: {
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
  content: { padding: 16, paddingBottom: 24 },
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
  resultContent: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  resultText: { textAlign: 'center' },
  processingText: { fontSize: 15, color: Colors.textPrimary, marginTop: 8, marginBottom: 20 },
  queueText: { fontSize: 13, color: Colors.textSecondary },
  errorBanner: { color: Colors.error, fontSize: 13, marginBottom: 8 },
  warningText: { color: Colors.error, fontSize: 12, marginTop: 4 },
  // Mensaje de un campo: va debajo de él, separado
  fieldError: { color: Colors.error, fontSize: 12, marginTop: 6 },
  inputError: { borderColor: Colors.inputBorderError },
  hintText: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  matchesBox: { marginTop: 8, marginBottom: 8 },
  labelImage: { width: '100%', height: 140, borderRadius: 10, marginBottom: 8, backgroundColor: '#f0f0f0' },
  missingHint: { color: Colors.textSecondary, fontSize: 11, marginTop: 3, fontStyle: 'italic' },
  existingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    backgroundColor: '#fff',
  },
  existingButtonText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  disabled: { opacity: 0.6 },
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
  confirmButton: { backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
  confirmButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
