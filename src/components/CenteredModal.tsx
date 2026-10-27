import { ReactNode, useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

// Margen mínimo entre la ventana y los bordes de la pantalla
const EDGE_MARGIN = 24;

// Ventana en el centro de la pantalla. Se cierra únicamente cuando el usuario sale de ella a propósito (sus botones o
// el botón atrás), nunca por tocar el fondo: así un toque de más no hace perder lo que se estaba completando.
export default function CenteredModal({ visible, onRequestClose, children, cardStyle, overlayTestID, cardTestID }: Props) {
  const open = useOpenAfterKeyboardCloses(visible);
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // El modal ocupa toda la pantalla (también bajo los botones del sistema de Android): si la ventana es larga, sus
  // botones quedan por encima de ellos. Con el teclado abierto esos botones quedan detrás de él y no hace falta dejarles lugar.
  const paddingTop = Math.max(EDGE_MARGIN, insets.top + 12);
  const paddingBottom = keyboardOpen ? EDGE_MARGIN : Math.max(EDGE_MARGIN, insets.bottom + 12);

  return (
    <Modal visible={open} transparent animationType="fade" hardwareAccelerated statusBarTranslucent navigationBarTranslucent onRequestClose={onRequestClose}>
      {/* Con el teclado abierto la ventana se achica para que sus campos queden a la vista. El margen va en un View
          aparte porque KeyboardAvoidingView pisa el padding inferior de su propio estilo. */}
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <View testID={overlayTestID} style={[StyleSheet.absoluteFill, styles.backdrop]} />
        <View testID="centered-modal-inner" style={[styles.inner, { paddingTop, paddingBottom }]} pointerEvents="box-none">
          <View testID={cardTestID} style={[styles.card, cardStyle]}>
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  card: { backgroundColor: '#fff', borderRadius: 20, maxHeight: '100%', flexShrink: 1, overflow: 'hidden' },
});
