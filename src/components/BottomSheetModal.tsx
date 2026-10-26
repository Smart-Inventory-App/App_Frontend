import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
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
// Si el sistema no avisa que la ventana ya se ve (onShow), la hoja empieza a subir igual pasado este tiempo
const ENTER_FALLBACK_MS = 250;

// Hoja inferior en la que el fondo oscuro aparece solo con un fundido (sin moverse)
// y únicamente la hoja sube desde abajo. Con animationType="slide" se movían las dos juntas.
export default function BottomSheetModal({
  visible, onRequestClose, children, sheetStyle, overlayTestID, sheetTestID,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // Mientras sube, la hoja se dibuja una sola vez como imagen (en Android) y esa imagen es la que se mueve: así el
  // contenido pesado no se vuelve a pintar en cada cuadro de la animación
  const [animating, setAnimating] = useState(false);
  const fade = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const slide = useRef(new Animated.Value(visible ? 1 : 0)).current;
  // La ventana ya está en pantalla / la subida de esta apertura ya empezó
  const shown = useRef(visible);
  const entered = useRef(visible);

  const enter = useCallback(() => {
    entered.current = true;
    if (Platform.OS === 'android') setAnimating(true);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver }),
      Animated.timing(slide, { toValue: 1, duration: SLIDE_MS, easing: Easing.out(Easing.cubic), useNativeDriver }),
    ]).start(({ finished }) => {
      if (finished && Platform.OS === 'android') setAnimating(false);
    });
  }, [fade, slide]);

  useEffect(() => {
    if (visible) {
      entered.current = false;
      setMounted(true);
      // Si la ventana todavía se está abriendo, la subida espera a que se vea (onShow): antes la animación arrancaba
      // mientras se armaba el contenido y la hoja aparecía ya a mitad de camino o de golpe. Si ya estaba abierta
      // (se reabre mientras se cierra), sube enseguida.
      if (shown.current) {
        enter();
        return;
      }
      const fallback = setTimeout(() => { if (!entered.current) enter(); }, ENTER_FALLBACK_MS);
      return () => clearTimeout(fallback);
    }
    if (Platform.OS === 'android') setAnimating(true);
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: FADE_MS, easing: Easing.in(Easing.quad), useNativeDriver }),
      Animated.timing(slide, { toValue: 0, duration: SLIDE_MS, easing: Easing.in(Easing.cubic), useNativeDriver }),
    ]).start(({ finished }) => {
      if (finished) {
        shown.current = false;
        if (Platform.OS === 'android') setAnimating(false);
        setMounted(false);
      }
    });
  }, [visible, fade, slide, enter]);

  // El sistema avisa que la ventana ya se ve: recién ahí empieza a subir la hoja
  const handleShow = () => {
    shown.current = true;
    if (visible && !entered.current) enter();
  };

  // Con el teclado abierto los botones del sistema quedan detrás de él: no hace falta dejarles lugar
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get('window').height, 0],
  });

  // La hoja llega hasta el borde inferior: se le suma el alto de los botones del sistema para que no tapen su contenido
  const flatSheet = StyleSheet.flatten(sheetStyle) ?? {};
  const basePaddingBottom = Number(flatSheet.paddingBottom ?? flatSheet.padding ?? 0);

  return (
    // El modal ocupa toda la pantalla (también bajo la barra de estado y los botones del sistema)
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onShow={handleShow} onRequestClose={onRequestClose}>
      {/* Con el teclado abierto la hoja sube y se achica para que sus campos queden a la vista */}
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fade }]} />
        <Pressable testID={overlayTestID} style={StyleSheet.absoluteFill} onPress={onRequestClose} />
        <Animated.View testID={sheetTestID} renderToHardwareTextureAndroid={animating} style={[sheetStyle, { paddingBottom: basePaddingBottom + (keyboardOpen ? 0 : insets.bottom), transform: [{ translateY }] }]}>
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
