import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useOpenAfterKeyboardCloses } from '@/hooks/useOpenAfterKeyboardCloses';

interface Props {
  visible: boolean;
  /** Solo con el botón atrás del sistema: tocar fuera de la ventana no la cierra. */
  onRequestClose: () => void;
  children: ReactNode;
  cardStyle?: StyleProp<ViewStyle>;
  overlayTestID?: string;
  cardTestID?: string;
}

// Ventana en el centro de la pantalla. Se cierra únicamente cuando el usuario sale de ella a propósito (sus botones o
// el botón atrás), nunca por tocar el fondo: así un toque de más no hace perder lo que se estaba completando.
export default function CenteredModal({ visible, onRequestClose, children, cardStyle, overlayTestID, cardTestID }: Props) {
  const open = useOpenAfterKeyboardCloses(visible);

  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onRequestClose}>
      {/* Con el teclado abierto la ventana se achica para que sus campos queden a la vista */}
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <View testID={overlayTestID} style={[StyleSheet.absoluteFill, styles.backdrop]} />
        <View testID={cardTestID} style={[styles.card, cardStyle]}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  card: { backgroundColor: '#fff', borderRadius: 20, maxHeight: '100%', flexShrink: 1, overflow: 'hidden' },
});
