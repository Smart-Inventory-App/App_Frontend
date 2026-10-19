import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import ProductImage from '@/components/ProductImage';
import { Product } from '@/types/product';
import { formatArgentinaShort } from '@/utils/datetime';
import { truncateLabel } from '@/utils/text';

interface Props {
  product: Product;
  /** Se llama al tocar la información del producto (la imagen se abre a pantalla completa por su cuenta). */
  onPress: (product: Product) => void;
  /** Si se indica `onToggle`, aparece a la derecha una casilla para incluir o sacar el producto de una suma. */
  selected?: boolean;
  onToggle?: (product: Product) => void;
  /** Si se indica, muestra arriba de la fila, pegada a la esquina superior izquierda, la fecha de carga del producto, resaltada. */
  showLoadDate?: boolean;
  /** Alto fijo de la fila: así todas las de un listado miden lo mismo (los textos largos se cortan en un renglón). */
  height?: number;
}

// Alto de las filas del listado de "Stock total de producto": todas miden lo mismo
export const LOT_ROW_HEIGHT = 124;

// Color del punto según lo cerca que está el vencimiento (el mismo criterio que el listado de Inventario)
const statusColor = (product: Product): 'green' | 'yellow' | 'red' => {
  if (!product.vencimiento) return 'green';
  const daysLeft = Math.ceil((new Date(product.vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 3) return 'red';
  if (daysLeft <= 7) return 'yellow';
  return 'green';
};

// Fila de un producto como en el listado de Inventario, sin acciones de edición: imagen, datos principales y estado.
export default function ProductLotRow({ product, onPress, selected = false, onToggle, showLoadDate = false, height }: Props) {
  const { t } = useTranslation();
  const color = statusColor(product);
  const oneLine = height !== undefined ? 1 : undefined;
  const dotStyle = [
    styles.dot,
    color === 'green' && styles.dotGreen,
    color === 'yellow' && styles.dotYellow,
    color === 'red' && styles.dotRed,
  ];

  return (
    <View testID={`lot-row-${product.id}`} style={[styles.item, height !== undefined && { height }]}>
      {showLoadDate && product.created_at ? (
        <View testID={`lot-loaded-${product.id}`} style={styles.loadDate}>
          <Ionicons name="time-outline" size={12} color={Colors.primary} />
          <Text style={styles.loadDateText}>
            {t('home.loadDate')}: {formatArgentinaShort(product.created_at)}
          </Text>
        </View>
      ) : null}
      <View style={styles.mainRow}>
      <ProductImage uri={product.imagen_url} style={styles.image} />
      <TouchableOpacity
        testID={`lot-info-${product.id}`}
        style={styles.info}
        activeOpacity={0.7}
        onPress={() => onPress(product)}
      >
        <Text style={styles.name} numberOfLines={oneLine}>{product.nombre}</Text>
        {product.marca ? <Text style={styles.sub} numberOfLines={oneLine}>{truncateLabel(product.marca)}</Text> : null}
        <Text style={styles.sub} numberOfLines={oneLine}>{t('inventory.filterCategory')}: {truncateLabel(product.categoria)}</Text>
        {product.ubicacion ? (
          <Text style={styles.sub} numberOfLines={oneLine}>
            <Ionicons name="location-outline" size={11} /> {truncateLabel(product.ubicacion)}
          </Text>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.detail}>Stock: {product.stock}</Text>
          {product.vencimiento ? <Text style={styles.detail}>Vence: {product.vencimiento}</Text> : null}
          <View testID={`lot-status-${product.id}`} style={dotStyle} />
        </View>
      </TouchableOpacity>
      {onToggle && (
        <TouchableOpacity
          testID={`lot-check-${product.id}`}
          accessibilityRole="checkbox"
          accessibilityLabel={t('stockTotal.includeInTotal')}
          accessibilityState={{ checked: selected }}
          style={styles.check}
          hitSlop={8}
          onPress={() => onToggle(product)}
        >
          <Ionicons
            testID={`lot-check-icon-${product.id}`}
            name={selected ? 'checkbox' : 'square-outline'}
            size={24}
            color={selected ? Colors.primary : Colors.placeholder}
          />
        </TouchableOpacity>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
  },
  mainRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  image: { width: 44, height: 44, borderRadius: 8, marginRight: 12 },
  info: { flex: 1 },
  check: { marginLeft: 8 },
  name: { fontSize: 15, fontWeight: 'bold', color: Colors.textPrimary },
  sub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 12 },
  detail: { fontSize: 12, color: Colors.textSecondary },
  loadDate: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#2CC4B426',
  },
  loadDateText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotGreen: { backgroundColor: '#2db7a3' },
  dotYellow: { backgroundColor: '#fbbc05' },
  dotRed: { backgroundColor: '#e5484d' },
});
