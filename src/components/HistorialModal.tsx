import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { ConsumptionEvent, Product } from '@/types/product';

interface Props {
  product: Product | null;
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export default function HistorialModal({ product, visible, onClose, onChanged }: Props) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<ConsumptionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editMotivo, setEditMotivo] = useState<'consumed' | 'expired' | 'restocked'>('consumed');
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!product) return;
    setLoading(true);
    productService.getConsumptionHistory(product.id)
      .then(data => setEvents([...data].reverse()))
      .catch(() => Alert.alert('Error', t('product.historialLoadError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (visible && product) {
      load();
      setEditingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, product?.id]);

  const motivoLabel = (type: ConsumptionEvent['event_type']) => {
    if (type === 'restocked') return t('product.historialEntrada');
    if (type === 'expired') return t('product.salidaMotivoVencido');
    return t('product.salidaMotivoConsumido');
  };

  const startEdit = (event: ConsumptionEvent) => {
    setEditingId(event.id);
    setEditQuantity(String(event.quantity));
    setEditMotivo(event.event_type);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (event: ConsumptionEvent) => {
    if (!product) return;
    const n = Number(editQuantity);
    if (!editQuantity || isNaN(n) || n <= 0) return;
    setSaving(true);
    try {
      await productService.updateConsumptionEvent(product.id, event.id, n, editMotivo);
      setEditingId(null);
      load();
      onChanged();
    } catch (err: unknown) {
      const detail = (err as any)?.response?.data?.detail;
      Alert.alert('Error', typeof detail === 'string' ? detail : t('product.historialUpdateError'));
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = (event: ConsumptionEvent) => {
    if (!product) return;
    Alert.alert(
      t('product.historialDeleteTitle'),
      t('product.historialDeleteConfirm'),
      [
        { text: t('product.historialCancelar'), style: 'cancel' },
        {
          text: t('product.historialBorrar'),
          style: 'destructive',
          onPress: async () => {
            try {
              await productService.deleteConsumptionEvent(product.id, event.id);
              load();
              onChanged();
            } catch (err: unknown) {
              const detail = (err as any)?.response?.data?.detail;
              Alert.alert('Error', typeof detail === 'string' ? detail : t('product.historialDeleteError'));
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('product.historial')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          {product ? <Text style={styles.subtitle}>{product.nombre}</Text> : null}

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
          ) : events.length === 0 ? (
            <Text style={styles.emptyText}>{t('product.historialEmpty')}</Text>
          ) : (
            <ScrollView style={{ maxHeight: 420 }}>
              {events.map(event => {
                const isEditing = editingId === event.id;
                return (
                  <View key={event.id} style={styles.row}>
                    {isEditing ? (
                      <View style={styles.editForm}>
                        <TextInput
                          style={styles.editInput}
                          keyboardType="numeric"
                          value={editQuantity}
                          onChangeText={v => setEditQuantity(v.replace(/[^0-9]/g, ''))}
                        />
                        <View style={styles.editMotivoRow}>
                          <TouchableOpacity
                            style={[styles.motivoChip, editMotivo === 'consumed' && styles.motivoChipActive]}
                            onPress={() => setEditMotivo('consumed')}
                          >
                            <Text style={[styles.motivoChipText, editMotivo === 'consumed' && styles.motivoChipTextActive]}>
                              {t('product.salidaMotivoConsumido')}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.motivoChip, editMotivo === 'expired' && styles.motivoChipActive]}
                            onPress={() => setEditMotivo('expired')}
                          >
                            <Text style={[styles.motivoChipText, editMotivo === 'expired' && styles.motivoChipTextActive]}>
                              {t('product.salidaMotivoVencido')}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.motivoChip, editMotivo === 'restocked' && styles.motivoChipActive]}
                            onPress={() => setEditMotivo('restocked')}
                          >
                            <Text style={[styles.motivoChipText, editMotivo === 'restocked' && styles.motivoChipTextActive]}>
                              {t('product.historialEntrada')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.editActions}>
                          <TouchableOpacity onPress={cancelEdit} style={styles.editActionBtn}>
                            <Text style={styles.editCancelText}>{t('product.historialCancelar')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => saveEdit(event)}
                            style={[styles.editActionBtn, styles.editSaveBtn, saving && { opacity: 0.6 }]}
                            disabled={saving}
                          >
                            <Text style={styles.editSaveText}>{t('product.historialGuardar')}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={styles.rowInfo}>
                          <Text style={styles.rowQuantity}>
                            {event.event_type === 'restocked' ? '+' : '-'}{event.quantity}
                          </Text>
                          <View>
                            <Text style={styles.rowMotivo}>{motivoLabel(event.event_type)}</Text>
                            <Text style={styles.rowDate}>
                              {new Date(event.consumed_at).toLocaleString()}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.rowActions}>
                          <TouchableOpacity onPress={() => startEdit(event)} style={styles.actionBtn}>
                            <Ionicons name="pencil" size={16} color={Colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => deleteEvent(event)} style={styles.actionBtn}>
                            <Ionicons name="trash" size={16} color={Colors.error} />
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, marginBottom: 12 },
  emptyText: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginVertical: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rowQuantity: { fontSize: 15, fontWeight: 'bold', color: Colors.textPrimary, minWidth: 40 },
  rowMotivo: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  rowDate: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  rowActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 6 },
  editForm: { flex: 1, gap: 8 },
  editInput: {
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  editMotivoRow: { flexDirection: 'row', gap: 8 },
  motivoChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.inputBorder ?? '#ddd',
  },
  motivoChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  motivoChipText: { fontSize: 12, color: Colors.textSecondary },
  motivoChipTextActive: { color: '#fff', fontWeight: '600' },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  editActionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  editCancelText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  editSaveBtn: { backgroundColor: Colors.primary },
  editSaveText: { fontSize: 13, color: '#fff', fontWeight: '600' },
});
