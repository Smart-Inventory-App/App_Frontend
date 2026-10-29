import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOpenAfterKeyboardCloses } from '@/hooks/useOpenAfterKeyboardCloses';

interface Props {
  visible: boolean;
  /** Se llama al tocar fuera de la hoja o con el botón atrás del sistema. */
  onRequestClose: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  overlayTestID?: string;
  sheetTestID?: string;
}

const FADE_MS = 220;
const SLIDE_MS = 300;
// Al cerrar la hoja se va un poco más rápido de lo que llegó
const EXIT_FADE_MS = 180;
const EXIT_SLIDE_MS = 240;
// Curvas de Material: la hoja llega frenando suave y se va acelerando, sin el tirón al principio o al final de las
// curvas cúbicas simples
const ENTER_EASING = Easing.bezier(0.2, 0, 0, 1);
const EXIT_EASING = Easing.bezier(0.3, 0, 0.8, 0.15);
const useNativeDriver = Platform.OS !== 'web';
// Si el sistema no avisa que la ventana ya se ve (onShow), la hoja empieza a subir igual pasado este tiempo
const ENTER_FALLBACK_MS = 250;

// Hoja inferior en la que el fondo oscuro aparece solo con un fundido (sin moverse)
// y únicamente la hoja sube desde abajo. Con animationType="slide" se movían las dos juntas.
export default function BottomSheetModal({
  visible: requestedVisible, onRequestClose, children, sheetStyle, overlayTestID, sheetTestID,
}: Props) {
  const insets = useSafeAreaInsets();
  // Con el teclado levantado, primero se lo cierra y recién después se abre la hoja: si no, queda un hueco transparente debajo
  const visible = useOpenAfterKeyboardCloses(requestedVisible);
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
  // Si la hoja se desmontó, lo que termine de animarse después no tiene que tocar el estado ni nada más
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      fade.stopAnimation();
      slide.stopAnimation();
    };
  }, [fade, slide]);

  const enter = useCallback(() => {
    entered.current = true;
    // La plataforma se consulta acá y no en el callback: ese corre cuando termina la animación, que puede ser tarde
    const android = Platform.OS === 'android';
    if (android) setAnimating(true);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver }),
      Animated.timing(slide, { toValue: 1, duration: SLIDE_MS, easing: ENTER_EASING, useNativeDriver }),
    ]).start(({ finished }) => {
      if (alive.current && finished && android) setAnimating(false);
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
    const android = Platform.OS === 'android';
    if (android) setAnimating(true);
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: EXIT_FADE_MS, easing: Easing.in(Easing.quad), useNativeDriver }),
      Animated.timing(slide, { toValue: 0, duration: EXIT_SLIDE_MS, easing: EXIT_EASING, useNativeDriver }),
    ]).start(({ finished }) => {
      if (alive.current && finished) {
        shown.current = false;
        if (android) setAnimating(false);
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

  // La hoja recorre solo su propio alto (lo justo para salir de la pantalla): si recorriera el de toda la pantalla, buena
  // parte de la duración se iría moviéndola fuera de la vista y el movimiento visible se sentiría brusco
  const [sheetHeight, setSheetHeight] = useState(0);
  const travel = sheetHeight > 0 ? sheetHeight : Dimensions.get('window').height;
  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [travel, 0],
  });

  // La hoja llega hasta el borde inferior: se le suma el alto de los botones del sistema para que no tapen su contenido
  const flatSheet = StyleSheet.flatten(sheetStyle) ?? {};
  const basePaddingBottom = Number(flatSheet.paddingBottom ?? flatSheet.padding ?? 0);

  return (
    // El modal ocupa toda la pantalla (también bajo la barra de estado y los botones del sistema)
    <Modal visible={mounted} transparent animationType="none" hardwareAccelerated statusBarTranslucent navigationBarTranslucent onShow={handleShow} onRequestClose={onRequestClose}>
      {/* Con el teclado abierto la hoja sube y se achica para que sus campos queden a la vista */}
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fade }]} />
        <Pressable testID={overlayTestID} style={StyleSheet.absoluteFill} onPress={onRequestClose} />
        <Animated.View testID={sheetTestID} renderToHardwareTextureAndroid={animating} onLayout={e => setSheetHeight(e.nativeEvent.layout.height)} style={[sheetStyle, { paddingBottom: basePaddingBottom + (keyboardOpen ? 0 : insets.bottom), transform: [{ translateY }] }]}>
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
