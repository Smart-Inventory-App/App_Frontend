import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import ProductImage from '@/components/ProductImage';
import { Product, StockChange, StockChangeKind } from '@/types/product';
import { formatArgentinaShort } from '@/utils/datetime';
import { formatThousands } from '@/utils/numbers';
import { truncateLabel } from '@/utils/text';

interface Props {
  change: StockChange;
  /** Se llama al tocar la información del producto (la imagen se abre a pantalla completa por su cuenta). */
  onPress: (product: Product) => void;
  /** Alto fijo de la fila: así todas las de un listado miden lo mismo (los textos largos se cortan en un renglón). */
  height?: number;
}

// Alto de cada fila cuando se muestran en un listado: todas miden lo mismo
export const CHANGE_ROW_HEIGHT = 124;

const KIND_STYLE: Record<StockChangeKind, { color: string; icon: keyof typeof Ionicons.glyphMap; labelKey: string }> = {
  entrada: { color: '#1f9d8b', icon: 'arrow-down-circle', labelKey: 'home.kindEntrada' },
  salida: { color: '#e5484d', icon: 'arrow-up-circle', labelKey: 'home.kindSalida' },
  modificacion: { color: '#3b6fd8', icon: 'create', labelKey: 'home.kindModificacion' },
};

// Un cambio de stock de un producto: imagen, datos, el motivo del cambio resaltado y cómo quedó el stock (78 → 82).
// Cuanto más largos los números del cambio, más chicos se escriben para que entren en la fila
export function changeFontSize(before: string, after: string): number {
  const length = Math.max(before.length, after.length);
  if (length <= 5) return 20;
  if (length <= 7) return 16;
  return 13;
}

export default function RecentChangeRow({ change, onPress, height }: Props) {
  const { t } = useTranslation();
  const { producto } = change;
  const kind = KIND_STYLE[change.kind];
  const oneLine = height !== undefined ? 1 : undefined;
  const before = formatThousands(change.stock_before);
  const after = formatThousands(change.stock_after);
  const afterSize = changeFontSize(before, after);

  return (
    <View testID={`change-row-${change.id}`} style={[styles.item, height !== undefined && { height }]}>
      <ProductImage uri={producto.imagen_url} style={styles.image} />
      <TouchableOpacity
        testID={`change-info-${change.id}`}
        style={styles.info}
        activeOpacity={0.7}
        onPress={() => onPress(producto)}
      >
        <Text style={styles.name} numberOfLines={oneLine}>{producto.nombre}</Text>
        {producto.marca ? <Text style={styles.sub} numberOfLines={oneLine}>{truncateLabel(producto.marca)}</Text> : null}
        <Text style={styles.sub} numberOfLines={oneLine}>{t('inventory.filterCategory')}: {truncateLabel(producto.categoria)}</Text>
        <View style={styles.bottomRow}>
          <View testID={`change-kind-${change.id}`} style={[styles.badge, { backgroundColor: `${kind.color}1F` }]}>
            <Ionicons name={kind.icon} size={13} color={kind.color} />
            <Text style={[styles.badgeText, { color: kind.color }]}>{t(kind.labelKey)}</Text>
          </View>
        </View>
        <Text testID={`change-date-${change.id}`} style={styles.date}>{formatArgentinaShort(change.occurred_at)}</Text>
      </TouchableOpacity>
      <View testID={`change-stock-${change.id}`} style={styles.stockBox}>
        <Text style={styles.stockLabel}>{t('home.stockChange')}</Text>
        <View style={styles.stockRow}>
          <Text testID={`change-before-${change.id}`} style={[styles.before, { fontSize: afterSize - 4 }]} numberOfLines={1}>{before}</Text>
          <Ionicons name="arrow-forward" size={14} color={kind.color} />
          <Text testID={`change-after-${change.id}`} style={[styles.after, { color: kind.color, fontSize: afterSize }]} numberOfLines={1}>{after}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#1B3A8F',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  image: { width: 48, height: 48, borderRadius: 10, marginRight: 12 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: 'bold', color: Colors.textPrimary },
  sub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  bottomRow: { flexDirection: 'row', marginTop: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  date: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  stockBox: { alignItems: 'flex-end', marginLeft: 8, maxWidth: 140 },
  stockLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  before: { color: Colors.textSecondary },
  after: { fontWeight: '800' },
});
