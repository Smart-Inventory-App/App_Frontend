import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  /** Se llama al tocar fuera de la hoja o con el botón atrás del sistema. */
  onRequestClose: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  overlayTestID?: string;
  sheetTestID?: string;
}

const FADE_MS = 200;
const SLIDE_MS = 260;
const useNativeDriver = Platform.OS !== 'web';

// Hoja inferior en la que el fondo oscuro aparece solo con un fundido (sin moverse)
// y únicamente la hoja sube desde abajo. Con animationType="slide" se movían las dos juntas.
export default function BottomSheetModal({
  visible, onRequestClose, children, sheetStyle, overlayTestID, sheetTestID,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const fade = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const slide = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver }),
        Animated.timing(slide, { toValue: 1, duration: SLIDE_MS, useNativeDriver }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver }),
        Animated.timing(slide, { toValue: 0, duration: SLIDE_MS, useNativeDriver }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, fade, slide]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get('window').height, 0],
  });

  // La hoja llega hasta el borde inferior: se le suma el alto de los botones del sistema para que no tapen su contenido
  const flatSheet = StyleSheet.flatten(sheetStyle) ?? {};
  const basePaddingBottom = Number(flatSheet.paddingBottom ?? flatSheet.padding ?? 0);

  return (
    // El modal ocupa toda la pantalla (también bajo la barra de estado y los botones del sistema)
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onRequestClose}>
      {/* Con el teclado abierto la hoja sube y se achica para que sus campos queden a la vista */}
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fade }]} />
        <Pressable testID={overlayTestID} style={StyleSheet.absoluteFill} onPress={onRequestClose} />
        <Animated.View testID={sheetTestID} style={[sheetStyle, { paddingBottom: basePaddingBottom + insets.bottom, transform: [{ translateY }] }]}>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
});
