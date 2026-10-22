import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';

interface Props {
  visible: boolean;
  /** La imagen que el usuario eligió y todavía no se cargó. */
  uri: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// Confirmación antes de cargar una imagen: se ve cómo quedó la foto o la imagen elegida y recién al confirmar se sube.
// No hay recorte: la imagen se carga tal cual.
export default function ImageConfirmModal({ visible, uri, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onCancel}>
      <Pressable testID="image-confirm-backdrop" style={styles.overlay} onPress={onCancel}>
        {/* Pressable interno: tocar la tarjeta no debe cerrar la ventana */}
        <Pressable testID="image-confirm-card" style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{t('product.imagenConfirmarTitulo')}</Text>
          {uri ? <Image testID="image-confirm-preview" source={{ uri }} resizeMode="contain" style={styles.preview} /> : null}
          <View style={styles.actions}>
            <TouchableOpacity testID="image-confirm-cancel" style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="image-confirm-accept" style={[styles.button, styles.confirmButton]} onPress={onConfirm}>
              <Text style={styles.confirmText}>{t('product.imagenConfirmar')}</Text>
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
    maxWidth: 380,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 20,
  },
  title: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center', marginBottom: 14 },
  preview: { width: '100%', height: 260, borderRadius: 10, backgroundColor: '#f2f3f6' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  cancelButton: { borderWidth: 1, borderColor: Colors.inputBorder },
  cancelText: { color: Colors.textSecondary, fontSize: 15 },
  confirmButton: { backgroundColor: Colors.primary },
  confirmText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
