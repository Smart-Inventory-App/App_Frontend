import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppTextInput from '@/components/AppTextInput';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import BottomSheetModal from '@/components/BottomSheetModal';
import ConfirmModal from '@/components/ConfirmModal';
import { Colors } from '@/constants/colors';
import { productService } from '@/services/productService';
import { ConsumptionEvent, Product } from '@/types/product';
import { formatArgentinaDateTime, humanizeEventNote } from '@/utils/datetime';

const NOTE_MAX = 50;
const STOCK_MAX_DIGITS = 6;

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
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<ConsumptionEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setErrorMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, product?.id]);

  const motivoLabel = (type: ConsumptionEvent['event_type']) => {
    if (type === 'restocked') return t('product.historialEntrada');
    if (type === 'expired') return t('product.salidaMotivoVencido');
    return t('product.salidaMotivoConsumido');
  };

  const startEdit = (event: ConsumptionEvent) => {
    setErrorMessage(null);
    setEditingId(event.id);
    setEditQuantity(String(event.quantity));
    setEditMotivo(event.event_type);
    setEditNote('');
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (event: ConsumptionEvent) => {
    if (!product) return;
    const n = Number(editQuantity);
    if (!editQuantity || isNaN(n) || n <= 0) return;
    setSaving(true);
    try {
      await productService.updateConsumptionEvent(product.id, event.id, n, editMotivo, editNote);
      setEditingId(null);
      setErrorMessage(null);
      load();
      onChanged();
    } catch {
      // Stock insuficiente u otro motivo: siempre el mismo aviso
      setErrorMessage(t('product.historialEditBlocked'));
    } finally {
      setSaving(false);
    }
  };

  // La confirmación es un modal propio: Alert.alert con botones no funciona en la web.
  const deleteEvent = (event: ConsumptionEvent) => {
    if (!product) return;
    setErrorMessage(null);
    setEventToDelete(event);
  };

  const confirmDeleteEvent = async () => {
    const event = eventToDelete;
    setEventToDelete(null);
    if (!product || !event) return;
    try {
      await productService.deleteConsumptionEvent(product.id, event.id);
      setErrorMessage(null);
      load();
      onChanged();
    } catch {
      setErrorMessage(t('product.historialEditBlocked'));
    }
  };

  return (
    // Tocar afuera de la hoja cierra el historial
    <BottomSheetModal
      visible={visible}
      onRequestClose={onClose}
      sheetStyle={styles.sheet}
      overlayTestID="historial-overlay"
      sheetTestID="historial-sheet"
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('product.historial')}</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      {product ? <Text style={styles.subtitle}>{product.nombre}</Text> : null}

      {errorMessage ? (
        <View testID="historial-error" style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
      ) : events.length === 0 ? (
        <Text style={styles.emptyText}>{t('product.historialEmpty')}</Text>
      ) : (
        <KeyboardAwareScrollView style={{ maxHeight: 420 }}>
          {events.map(event => {
            const isEditing = editingId === event.id;
            return (
              <View key={event.id} style={[styles.row, !isEditing && styles.rowFixed]}>
                {isEditing ? (
                  <View style={styles.editForm}>
                    <Text style={styles.editLabel}>{t('product.historialUnidades')}</Text>
                    <AppTextInput
                      style={styles.editInput}
                      keyboardType="numeric"
                      value={editQuantity}
                      maxLength={STOCK_MAX_DIGITS}
                      onChangeText={v => setEditQuantity(v.replace(/[^0-9]/g, ''))}
                    />
                    {/* Una entrada solo cambia unidades y motivo; una salida también puede pasar de consumido a vencido */}
                    {event.event_type !== 'restocked' && (
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
                    </View>
                    )}
                    <View style={styles.editLabelRow}>
                      <Text style={styles.editLabel}>{t('product.historialMotivo')}</Text>
                      <Text testID="historial-note-counter" style={styles.editCounter}>{editNote.length}/{NOTE_MAX}</Text>
                    </View>
                    <AppTextInput
                      style={styles.editInput}
                      placeholder={t('product.historialNotaPlaceholder')}
                      placeholderTextColor={Colors.placeholder}
                      value={editNote}
                      maxLength={NOTE_MAX}
                      onChangeText={setEditNote}
                    />
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
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {event.reverses_event_id != null && (
                            <Ionicons name="arrow-undo" size={12} color={Colors.textSecondary} />
                          )}
                          <Text style={styles.rowMotivo}>{motivoLabel(event.event_type)}</Text>
                          {event.reversed && (
                            <View style={styles.badge}>
                              <Text style={styles.badgeText}>{t('product.historialCorregido')}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.rowDate} numberOfLines={1}>
                          {formatArgentinaDateTime(event.consumed_at)}
                          {event.actor_email ? ` · ${event.actor_email}` : ''}
                        </Text>
                        {event.note ? <Text style={styles.rowNote} numberOfLines={1} ellipsizeMode="tail">{humanizeEventNote(event.note, events)}</Text> : null}
                      </View>
                    </View>
                    {event.reverses_event_id == null && !event.reversed && (
                      <View style={styles.rowActions}>
                        <TouchableOpacity onPress={() => startEdit(event)} style={styles.actionBtn}>
                          <Ionicons name="pencil" size={16} color={Colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteEvent(event)} style={styles.actionBtn}>
                          <Ionicons name="trash" size={16} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </KeyboardAwareScrollView>
      )}
      <ConfirmModal
        visible={!!eventToDelete}
        message={t('product.historialDeleteConfirm')}
        confirmLabel={t('product.historialBorrar')}
        cancelLabel={t('product.historialCancelar')}
        onConfirm={confirmDeleteEvent}
        onCancel={() => setEventToDelete(null)}
      />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
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
  rowNote: { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 1 },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: '#f0f0f0',
  },
  badgeText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  rowActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 6 },
  rowFixed: { height: 66 },
  errorBox: { backgroundColor: '#fdecea', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10 },
  errorText: { color: Colors.error, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  editLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  editLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: -4 },
  editCounter: { fontSize: 12, color: Colors.textSecondary },
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
