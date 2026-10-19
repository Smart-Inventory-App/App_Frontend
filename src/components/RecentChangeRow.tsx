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
export const CHANGE_ROW_HEIGHT = 132;

const KIND_STYLE: Record<StockChangeKind, { color: string; icon: keyof typeof Ionicons.glyphMap; labelKey: string }> = {
  entrada: { color: '#1f9d8b', icon: 'arrow-down-circle', labelKey: 'home.kindEntrada' },
  salida: { color: '#e5484d', icon: 'arrow-up-circle', labelKey: 'home.kindSalida' },
  modificacion: { color: '#3b6fd8', icon: 'create', labelKey: 'home.kindModificacion' },
};

// Cuanto más largos los dos números del cambio (con sus puntos), más chicos se escriben, para que entren en su
// lugar sin chocar con la etiqueta del motivo.
export function changeFontSize(before: string, after: string): number {
  const length = before.length + after.length;
  if (length <= 6) return 20;
  if (length <= 9) return 17;
  if (length <= 12) return 14;
  if (length <= 15) return 12;
  return 10;
}

// La diferencia ("+ 2.140.960" o "- 2.140.960"), con el mismo formato de los números del cambio
export function formatChangeDelta(before: number, after: number): string {
  const delta = after - before;
  if (delta > 0) return `+ ${formatThousands(delta)}`;
  if (delta < 0) return `- ${formatThousands(-delta)}`;
  return '0';
}

export function deltaFontSize(text: string): number {
  if (text.length <= 6) return 13;
  if (text.length <= 9) return 12;
  return 11;
}

// Un cambio de stock de un producto: imagen, datos, el motivo del cambio resaltado y cómo quedó el stock (78 → 82),
// con cuánto subió o bajó debajo (+ 4).

export default function RecentChangeRow({ change, onPress, height }: Props) {
  const { t } = useTranslation();
  const { producto } = change;
  const kind = KIND_STYLE[change.kind];
  const oneLine = height !== undefined ? 1 : undefined;
  const before = formatThousands(change.stock_before);
  const after = formatThousands(change.stock_after);
  const size = changeFontSize(before, after);
  const delta = formatChangeDelta(change.stock_before, change.stock_after);
  const deltaColor = change.stock_after > change.stock_before ? KIND_STYLE.entrada.color : change.stock_after < change.stock_before ? KIND_STYLE.salida.color : Colors.textSecondary;

  // El motivo del cambio va arriba de la entrada, en un solo renglón. Debajo, la imagen, los datos del producto y el
  // stock: tocar los datos, el stock o el motivo abre la información del producto, y la imagen se abre por su cuenta.
  return (
    <View testID={`change-row-${change.id}`} style={[styles.item, height !== undefined && { height }]}>
      <TouchableOpacity activeOpacity={0.7} style={styles.badgeRow} onPress={() => onPress(producto)}>
        <View testID={`change-kind-${change.id}`} style={[styles.badge, { backgroundColor: `${kind.color}1F` }]}>
          <Ionicons name={kind.icon} size={13} color={kind.color} />
          <Text style={[styles.badgeText, { color: kind.color }]} numberOfLines={1}>{t(kind.labelKey)}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.mainRow}>
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
          <Text testID={`change-date-${change.id}`} style={styles.date}>{formatArgentinaShort(change.occurred_at)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`change-stock-${change.id}`}
          style={styles.stockBox}
          activeOpacity={0.7}
          onPress={() => onPress(producto)}
        >
          <Text style={styles.stockLabel}>{t('home.stockChange')}</Text>
          <View style={styles.stockRow}>
            <Text testID={`change-before-${change.id}`} style={[styles.before, { fontSize: size }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{before}</Text>
            <Ionicons name="arrow-forward" size={12} color={kind.color} />
            <Text testID={`change-after-${change.id}`} style={[styles.after, { color: kind.color, fontSize: size }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{after}</Text>
          </View>
          <Text
            testID={`change-delta-${change.id}`}
            style={[styles.delta, { color: deltaColor, fontSize: deltaFontSize(delta) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {delta}
          </Text>
        </TouchableOpacity>
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
    elevation: 2,
    shadowColor: '#1B3A8F',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  image: { width: 48, height: 48, borderRadius: 10, marginRight: 12 },
  info: { flex: 1, minWidth: 0 },
  mainRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  badgeRow: { alignSelf: 'flex-start', marginBottom: 8 },
  name: { fontSize: 15, fontWeight: 'bold', color: Colors.textPrimary },
  sub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
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
  // Ancho fijo: lo que sobra es para los datos del producto, y los números se achican para entrar acá
  stockBox: { alignItems: 'flex-end', marginLeft: 8, width: 116 },
  stockLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  stockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2, maxWidth: '100%' },
  before: { color: Colors.textSecondary, flexShrink: 1 },
  after: { fontWeight: '800', flexShrink: 1 },
  delta: { fontWeight: '700', marginTop: 2, maxWidth: '100%' },
});
