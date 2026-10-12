import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Platform, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

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

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onRequestClose}>
      <View style={styles.container}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fade }]} />
        <Pressable testID={overlayTestID} style={StyleSheet.absoluteFill} onPress={onRequestClose} />
        <Animated.View testID={sheetTestID} style={[sheetStyle, { transform: [{ translateY }] }]}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
});
