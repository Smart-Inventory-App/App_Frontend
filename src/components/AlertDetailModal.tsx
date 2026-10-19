import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import ProductImage from '@/components/ProductImage';
import { Alert } from '@/services/alertService';
import { isoToDisplay } from '@/utils/dateInput';
import { alertTone, getAlertLines, getAlertType } from '@/utils/alertInfo';

interface Props {
  alert: Alert | null;
  onClose: () => void;
}

const NO_VALUE = '—';

interface RowProps {
  testID: string;
  label: string;
  value?: string | number | null;
  highlight?: boolean;
}

function Row({ testID, label, value, highlight }: RowProps) {
  const empty = value === undefined || value === null || value === '';
  return (
    <View style={styles.row}>
      <Text testID={`${testID}-label`} style={[styles.rowLabel, highlight && styles.rowHighlight]}>{label}</Text>
      <Text testID={testID} style={[styles.rowValue, highlight && styles.rowHighlight, empty && styles.rowValueEmpty]}>
        {empty ? NO_VALUE : String(value)}
      </Text>
    </View>
  );
}

// Ventana centrada con lo que le sirve a la alerta: imagen, nombre, categoría, el motivo de la alerta, marca y stock.
export default function AlertDetailModal({ alert, onClose }: Props) {
  const tone = alert ? alertTone(alert) : null;

  return (
    <Modal
      visible={!!alert}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable testID="alert-detail-backdrop" style={styles.overlay} onPress={onClose}>
        {/* Pressable interno: tocar la tarjeta no debe cerrar la ventana */}
        <Pressable testID="alert-detail-card" style={styles.card} onPress={() => {}}>
          {alert && tone && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Detalle de Alerta</Text>
                <TouchableOpacity testID="alert-detail-close" accessibilityLabel="Cerrar" onPress={onClose}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.imageBox}>
                  <ProductImage uri={alert.image_url} style={styles.image} resizeMode="cover" />
                </View>
                <Text testID="alert-detail-nombre" style={styles.name}>{alert.product_name}</Text>

                <Row testID="alert-detail-categoria" label="Categoría" value={alert.product_category} highlight />

                <View testID="alert-detail-reason" style={[styles.reason, { backgroundColor: tone.background }]}>
                  <Text testID="alert-detail-reason-title" style={[styles.reasonTitle, { color: tone.text }]}>
                    {getAlertType(alert)}
                  </Text>
                  {getAlertLines(alert).map(line => (
                    <Text key={line} style={[styles.reasonLine, { color: tone.text }]}>{line}</Text>
                  ))}
                </View>

                <Row testID="alert-detail-marca" label="Marca" value={alert.product_brand} />
                <Row testID="alert-detail-stock" label="Stock" value={alert.product_stock} highlight />
                {alert.product_expiry ? (
                  <Row testID="alert-detail-vencimiento" label="Vencimiento" value={isoToDisplay(alert.product_expiry.slice(0, 10))} />
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
  reason: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginVertical: 8 },
  reasonTitle: { fontSize: 16, fontWeight: 'bold' },
  reasonLine: { fontSize: 14, marginTop: 3 },
  row: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  rowValue: { fontSize: 15, color: Colors.textPrimary, marginTop: 2 },
  rowValueEmpty: { color: Colors.placeholder },
  // Categoría y stock se destacan con el color principal de la app
  rowHighlight: { color: Colors.primary },
});
