import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';

interface Props {
  visible: boolean;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Color del botón de confirmar: rojo para lo que borra o cierra algo (por defecto) o el de la app para el resto. */
  confirmTone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ visible, message, confirmLabel, cancelLabel, confirmTone = 'danger', onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onCancel}>
      <Pressable testID="confirm-backdrop" style={styles.overlay} onPress={onCancel}>
        {/* Pressable interno: tocar la tarjeta no debe cerrar el modal */}
        <Pressable testID="confirm-card" style={styles.card} onPress={() => {}}>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity testID="confirm-cancel" style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="confirm-accept"
              style={[styles.button, confirmTone === 'primary' ? styles.confirmButtonPrimary : styles.confirmButton]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
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
    maxWidth: 400,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 22,
  },
  message: { fontSize: 16, color: Colors.textPrimary, textAlign: 'center', lineHeight: 22, marginBottom: 22 },
  actions: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, height: 46, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  cancelButton: { borderWidth: 1, borderColor: Colors.inputBorder, backgroundColor: Colors.white },
  cancelText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  confirmButton: { backgroundColor: Colors.error },
  confirmButtonPrimary: { backgroundColor: Colors.primary },
  confirmText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
});
