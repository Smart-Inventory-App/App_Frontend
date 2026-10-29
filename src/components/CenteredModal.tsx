import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardEvent, Modal, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
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
  // Cuánto del fondo de la ventana tapa el teclado: la ventana se eleva solo eso, y vuelve a su lugar al cerrarse
  const [lift, setLift] = useState(0);
  const root = useRef<View>(null);
  const keyboardTop = useRef<number | null>(null);

  // Se mide cuánto del fondo de la ventana queda detrás del teclado. Si el sistema ya achicó la ventana para dejarle
  // lugar, no tapa nada y no hay nada que elevar: así no se suma una elevación a la que ya hizo el sistema (eso dejaba
  // un hueco transparente debajo de la ventana).
  const updateLift = useCallback(() => {
    const top = keyboardTop.current;
    if (top == null) {
      setLift(0);
      return;
    }
    root.current?.measureInWindow((_x, y, _width, height) => {
      // El teclado pudo cerrarse mientras se medía
      setLift(keyboardTop.current == null ? 0 : Math.max(0, Math.round(y + height - keyboardTop.current)));
    });
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event?: KeyboardEvent) => {
      keyboardTop.current = event?.endCoordinates?.screenY ?? null;
      setKeyboardOpen(true);
      updateLift();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboardOpen(false);
      setLift(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [updateLift]);

  // El modal ocupa toda la pantalla (también bajo los botones del sistema de Android): si la ventana es larga, sus
  // botones quedan por encima de ellos. Con el teclado abierto esos botones quedan detrás de él y no hace falta dejarles lugar.
  const paddingTop = Math.max(EDGE_MARGIN, insets.top + 12);
  const paddingBottom = (keyboardOpen ? EDGE_MARGIN : Math.max(EDGE_MARGIN, insets.bottom + 12)) + lift;

  return (
    <Modal visible={open} transparent animationType="fade" hardwareAccelerated statusBarTranslucent navigationBarTranslucent onRequestClose={onRequestClose}>
      {/* Con el teclado abierto la ventana se achica (y se eleva lo justo) para que sus campos queden a la vista */}
      <View ref={root} testID="centered-modal-root" collapsable={false} style={styles.container} onLayout={updateLift}>
        <View testID={overlayTestID} style={[StyleSheet.absoluteFill, styles.backdrop]} />
        <View testID="centered-modal-inner" style={[styles.inner, { paddingTop, paddingBottom }]} pointerEvents="box-none">
          <View testID={cardTestID} style={[styles.card, cardStyle]}>
            {children}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  card: { backgroundColor: '#fff', borderRadius: 20, maxHeight: '100%', flexShrink: 1, overflow: 'hidden' },
});
