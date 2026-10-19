import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { isoToDisplay } from '@/utils/dateInput';

interface Props {
  product: { categoria: string; marca?: string | null; stock: number; vencimiento?: string | null };
  /** Prefijo de los testID: `<prefijo>-info`, `-categoria`, `-marca`, `-stock` y `-vencimiento`. */
  testIDPrefix: string;
}

// Datos del producto elegido: una tarjeta breve con la categoría, la marca (si tiene), el stock actual y el
// vencimiento (si vence; si no, el dato no aparece, igual que la marca). Se usa al elegir un producto en una salida y al ingresar stock a un producto existente.
export default function ProductInfoCard({ product, testIDPrefix }: Props) {
  const { t } = useTranslation();

  return (
    <View testID={`${testIDPrefix}-info`} style={styles.card}>
      <View style={styles.cell}>
        <Text style={styles.label}>{t('product.categoria')}</Text>
        <Text testID={`${testIDPrefix}-categoria`} style={styles.value}>{product.categoria}</Text>
      </View>
      {product.marca ? (
        <View style={styles.cell}>
          <Text style={styles.label}>{t('product.marca')}</Text>
          <Text testID={`${testIDPrefix}-marca`} style={styles.value}>{product.marca}</Text>
        </View>
      ) : null}
      <View style={styles.cell}>
        <Text style={styles.label}>{t('product.salidaStockActual')}</Text>
        <Text testID={`${testIDPrefix}-stock`} style={[styles.value, styles.valueStrong]}>{String(product.stock)}</Text>
      </View>
      {product.vencimiento ? (
        <View style={styles.cell}>
          <Text style={styles.label}>{t('product.vencimiento')}</Text>
          <Text testID={`${testIDPrefix}-vencimiento`} style={styles.value}>{isoToDisplay(product.vencimiento)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
  cell: { width: '50%', paddingVertical: 4 },
  label: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 14, color: Colors.textPrimary, marginTop: 1 },
  valueStrong: { fontWeight: '700', color: Colors.primary },
});
