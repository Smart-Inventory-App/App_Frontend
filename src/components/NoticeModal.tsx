import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/colors';

interface Props {
  visible: boolean;
  message: string;
  buttonLabel: string;
  onContinue: () => void;
}

// Aviso con un solo botón («Continuar»). Tocar afuera o el botón atrás también lo cierra.
export default function NoticeModal({ visible, message, buttonLabel, onContinue }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" hardwareAccelerated statusBarTranslucent navigationBarTranslucent onRequestClose={onContinue}>
      <Pressable testID="notice-backdrop" style={styles.overlay} onPress={onContinue}>
        {/* Pressable interno: tocar la tarjeta no debe cerrar el aviso */}
        <Pressable testID="notice-card" style={styles.card} onPress={() => {}}>
          <Text testID="notice-message" style={styles.message}>{message}</Text>
          <TouchableOpacity testID="notice-continue" style={styles.button} onPress={onContinue}>
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </TouchableOpacity>
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
    maxWidth: 340,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 22,
  },
  message: { fontSize: 15, color: Colors.textPrimary, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  button: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
