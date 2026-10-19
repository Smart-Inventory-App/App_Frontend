import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  /** Si se indica, aparece el botón "Stock total" debajo del nombre (solo cuando se llega desde Inventario). */
  onShowTotal?: (product: Product) => void;
}

const NO_VALUE = '—';

interface RowProps {
  testID: string;
  label: string;
  value?: string | number | null;
  /** Aclaración más chica debajo del valor (por ejemplo, que se usa la regla general). */
  note?: string;
  /** Destaca el título y el valor con el color de la app. */
  highlight?: boolean;
}

function Row({ testID, label, value, note, highlight }: RowProps) {
  const empty = value === undefined || value === null || value === '';
  return (
    <View style={styles.row}>
      <Text testID={`${testID}-label`} style={[styles.rowLabel, highlight && styles.rowHighlight]}>{label}</Text>
      <Text testID={testID} style={[styles.rowValue, highlight && styles.rowHighlight, empty && styles.rowValueEmpty]}>
        {empty ? NO_VALUE : String(value)}
      </Text>
      {note ? <Text testID={`${testID}-note`} style={styles.rowNote}>{note}</Text> : null}
    </View>
  );
}

// Ventana centrada con todos los datos del producto tal como se cargaron. Solo muestra: no se edita nada acá.
export default function ProductDetailModal({ product, onClose, generalRules, onShowTotal }: Props) {
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
  ) => {
    if (own != null) return <Row testID={testID} label={label} value={format(own)} />;
    if (general != null) {
      return <Row testID={testID} label={label} value={format(general)} note={t('product.usandoReglaGeneral')} />;
    }
    return <Row testID={testID} label={label} value={t('product.usandoReglaGeneral')} />;
  };

  return (
    <Modal
      visible={!!product}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable testID="product-detail-backdrop" style={styles.overlay} onPress={onClose}>
        {/* Pressable interno: tocar la tarjeta no debe cerrar la ventana */}
        <Pressable testID="product-detail-card" style={styles.card} onPress={() => {}}>
          {product && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{t('detail.title')}</Text>
                <TouchableOpacity testID="product-detail-close" accessibilityLabel={t('detail.close')} onPress={onClose}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView testID="product-detail-scroll" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.imageBox}>
                  <ProductImage uri={product.imagen_url} style={styles.image} resizeMode="cover" />
                </View>
                <Text testID="detail-nombre" style={styles.name}>{product.nombre}</Text>
                {onShowTotal && (
                  <TouchableOpacity testID="detail-total-button" style={styles.totalBtn} onPress={() => onShowTotal(product)}>
                    <Ionicons name="layers-outline" size={16} color={Colors.primary} />
                    <Text style={styles.totalBtnText}>{t('detail.totalButton')}</Text>
                  </TouchableOpacity>
                )}

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
                {ruleRow('detail-stock-minimo', t('product.stockMinimo'), product.stock_minimo, generalRules?.coverageDays, units)}
                {ruleRow('detail-dias-alerta', t('product.diasAlertaVencimiento'), product.dias_alerta_vencimiento, generalRules?.expiryDays, days)}

                {product.created_at ? (
                  <Row testID="detail-created-at" label={t('detail.createdAt')} value={formatArgentinaDateTime(product.created_at)} />
                ) : null}
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
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
  totalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  totalBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 2,
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  rowValue: { fontSize: 15, color: Colors.textPrimary, marginTop: 2 },
  rowValueEmpty: { color: Colors.placeholder },
  rowNote: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  // Categoría y stock se destacan con el color principal de la app
  rowHighlight: { color: Colors.primary },
});
