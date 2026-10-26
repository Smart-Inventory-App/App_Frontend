import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import ProductImage from '@/components/ProductImage';
import { Product } from '@/types/product';
import { isoToDisplay } from '@/utils/dateInput';
import { formatArgentinaDateTime } from '@/utils/datetime';

// Reglas generales del usuario (Perfil): las que rigen cuando el producto no tiene una propia
export interface GeneralAlertRules {
  coverageDays: number;
  expiryDays: number;
}

interface Props {
  product: Product | null;
  onClose: () => void;
  generalRules?: GeneralAlertRules | null;
}

const NO_VALUE = '—';
// La ventana ocupa hasta el 85 % del alto de la pantalla; al cuerpo se le descuenta lo que ocupan el título y los márgenes
const CARD_MAX_HEIGHT_RATIO = 0.85;
const CARD_CHROME_HEIGHT = 90;

interface RowProps {
  testID: string;
  label: string;
  value?: string | number | null;
  /** Aclaración más chica debajo del valor (por ejemplo, que se usa la regla general). */
  note?: string;
  /** Destaca el título y el valor con el color de la app. */
  highlight?: boolean;
  /** Sin la línea gris de abajo: la fila forma una sola sección con la que sigue. */
  noDivider?: boolean;
}

function Row({ testID, label, value, note, highlight, noDivider }: RowProps) {
  const empty = value === undefined || value === null || value === '';
  return (
    <View style={[styles.row, noDivider && styles.rowNoDivider]}>
      <Text testID={`${testID}-label`} style={[styles.rowLabel, highlight && styles.rowHighlight]}>{label}</Text>
      <Text testID={testID} style={[styles.rowValue, highlight && styles.rowHighlight, empty && styles.rowValueEmpty]}>
        {empty ? NO_VALUE : String(value)}
      </Text>
      {note ? <Text testID={`${testID}-note`} style={styles.rowNote}>{note}</Text> : null}
    </View>
  );
}

// Ventana centrada con todos los datos del producto tal como se cargaron. Solo muestra: no se edita nada acá.
export default function ProductDetailModal({ product, onClose, generalRules }: Props) {
  const { t } = useTranslation();

  const units = (n: number) => t(n === 1 ? 'detail.unitOne' : 'detail.unitMany', { count: n });
  const days = (n: number) => t(n === 1 ? 'detail.dayOne' : 'detail.dayMany', { count: n });

  // Con regla propia se muestra su valor; si no, el de la regla general del usuario con la aclaración debajo
  const ruleRow = (
    testID: string,
    label: string,
    own: number | undefined,
    general: number | undefined,
    format: (n: number) => string,
    noDivider = false,
  ) => {
    if (own != null) return <Row testID={testID} label={label} value={format(own)} noDivider={noDivider} />;
    if (general != null) {
      return <Row testID={testID} label={label} value={format(general)} note={t('product.usandoReglaGeneral')} noDivider={noDivider} />;
    }
    return <Row testID={testID} label={label} value={t('product.usandoReglaGeneral')} noDivider={noDivider} />;
  };

  // Alto máximo del cuerpo en números: con un máximo definido, el cuerpo se desplaza cuando la información no entra
  // (confiar en que se achique solo dentro de una ventana con alto máximo no alcanzaba en Android)
  const { height: windowHeight } = useWindowDimensions();
  const bodyMaxHeight = Math.max(120, Math.round(windowHeight * CARD_MAX_HEIGHT_RATIO) - CARD_CHROME_HEIGHT);

  return (
    <Modal
      visible={!!product}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View testID="product-detail-overlay" style={styles.overlay}>
        {/* El fondo es un hermano de la ventana (no su padre): tocar la ventana no lo toca y los gestos de desplazar no
            pasan por un botón que se quede con ellos */}
        <Pressable testID="product-detail-backdrop" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View testID="product-detail-card" style={styles.card}>
          {product && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{t('detail.title')}</Text>
                <TouchableOpacity testID="product-detail-close" accessibilityLabel={t('detail.close')} onPress={onClose}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView
                testID="product-detail-scroll"
                style={{ maxHeight: bodyMaxHeight }}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                bounces
              >
                <View style={styles.imageBox}>
                  <ProductImage uri={product.imagen_url} style={styles.image} resizeMode="cover" />
                </View>
                <Text testID="detail-nombre" style={styles.name}>{product.nombre}</Text>

                <Row testID="detail-categoria" label={t('product.categoria')} value={product.categoria} highlight />
                <Row testID="detail-marca" label={t('product.marca')} value={product.marca} />
                <Row testID="detail-stock" label={t('product.stock')} value={product.stock} highlight />
                {product.descripcion?.trim() ? (
                  <Row testID="detail-descripcion" label={t('product.descripcion')} value={product.descripcion} />
                ) : null}
                <Row testID="detail-ubicacion" label={t('product.ubicacion')} value={product.ubicacion} />
                <Row
                  testID="detail-vencimiento"
                  label={t('product.vencimiento')}
                  value={product.vencimiento ? isoToDisplay(product.vencimiento) : t('scan.productNoExpiry')}
                />
                <Row testID="detail-codigo-barras" label={t('product.codigoBarras')} value={product.codigo_barras} />

                <Text style={styles.sectionTitle}>{t('detail.alertsTitle')}</Text>
                {ruleRow('detail-stock-minimo', t('product.stockMinimo'), product.stock_minimo, generalRules?.coverageDays, units, true)}
                {ruleRow('detail-dias-alerta', t('product.diasAlertaVencimiento'), product.dias_alerta_vencimiento, generalRules?.expiryDays, days)}

                {product.created_at ? (
                  <Row testID="detail-created-at" label={t('detail.createdAt')} value={formatArgentinaDateTime(product.created_at)} />
                ) : null}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: 'bold', color: Colors.textPrimary },
  content: { paddingBottom: 16 },
  imageBox: { alignItems: 'center', marginVertical: 8 },
  image: { width: 140, height: 140, borderRadius: 12 },
  name: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 16,
    marginBottom: 2,
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowNoDivider: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  rowValue: { fontSize: 15, color: Colors.textPrimary, marginTop: 2 },
  rowValueEmpty: { color: Colors.placeholder },
  rowNote: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  // Categoría y stock se destacan con el color principal de la app
  rowHighlight: { color: Colors.primary },
});
