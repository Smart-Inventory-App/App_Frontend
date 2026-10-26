import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, GestureResponderEvent, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  clampScale,
  clampTranslation,
  distanceBetween,
  isResetScale,
  midpoint,
  pinchTranslation,
  TouchPoint,
} from '@/utils/zoom';

interface Props {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

// Un movimiento menor a esto cuenta como toque (no como arrastre)
const TAP_SLOP = 8;
// Lo que tarda la imagen en volver a su tamaño original al soltar los dedos
const RESTORE_MS = 160;
// Con el driver nativo la imagen se mueve y se escala en el hilo de la interfaz: cada cambio de zoom no pasa por el
// renderizado de React, y el pellizco se ve fluido aunque el hilo de JavaScript esté ocupado.
const nativeDriver = () => Platform.OS !== 'web';

// Imagen a pantalla completa con zoom: se acerca y se aleja pellizcando con dos dedos (el zoom se hace desde donde
// están los dedos, con la medida que quiera el usuario) y mientras haya dedos apoyados se arrastra con uno o con dos
// para ver cada parte. Al soltar todos los dedos la imagen vuelve a su tamaño original. No hay zoom con doble toque.
export default function ImageViewerModal({ visible, uri, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const current = useRef({ scale: 1, x: 0, y: 0 });
  const size = useRef({ width: 0, height: 0 });
  const gesture = useRef({
    touches: 0,
    startDistance: 0,
    startMid: { pageX: 0, pageY: 0 } as TouchPoint,
    baseScale: 1,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    moved: false,
  });

  const apply = useCallback((nextScale: number, x: number, y: number) => {
    const s = clampScale(nextScale);
    const cx = clampTranslation(x, size.current.width, s);
    const cy = clampTranslation(y, size.current.height, s);
    current.current = { scale: s, x: cx, y: cy };
    scale.setValue(s);
    translateX.setValue(cx);
    translateY.setValue(cy);
  }, [scale, translateX, translateY]);

  const reset = useCallback(() => apply(1, 0, 0), [apply]);

  // Pasa los tres valores al driver nativo apenas se crea el visor (una animación de duración cero). Desde ahí, cada
  // `setValue` del pellizco se aplica directo en la interfaz, sin volver a renderizar la imagen.
  useEffect(() => {
    if (!nativeDriver()) return;
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]).start();
  }, [scale, translateX, translateY]);

  const restoring = useRef<Animated.CompositeAnimation | null>(null);

  // Vuelve al tamaño original con una animación corta. Si se vuelve a tocar antes de terminar, arranca desde el original.
  const restore = useCallback(() => {
    current.current = { scale: 1, x: 0, y: 0 };
    restoring.current = Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: RESTORE_MS, useNativeDriver: nativeDriver() }),
      Animated.timing(translateX, { toValue: 0, duration: RESTORE_MS, useNativeDriver: nativeDriver() }),
      Animated.timing(translateY, { toValue: 0, duration: RESTORE_MS, useNativeDriver: nativeDriver() }),
    ]);
    restoring.current.start();
  }, [scale, translateX, translateY]);

  const stopRestoring = useCallback(() => {
    if (!restoring.current) return;
    restoring.current.stop();
    restoring.current = null;
    reset();
  }, [reset]);

  // Cada vez que se abre arranca sin zoom
  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  // Toma como punto de partida lo que hay en pantalla (también cuando se suma o se saca un dedo)
  const begin = (touches: TouchPoint[]) => {
    const g = gesture.current;
    g.touches = touches.length;
    g.baseScale = current.current.scale;
    g.baseX = current.current.x;
    g.baseY = current.current.y;
    if (touches.length >= 2) {
      g.startDistance = distanceBetween(touches[0], touches[1]);
      g.startMid = midpoint(touches[0], touches[1]);
    } else if (touches.length === 1) {
      g.startX = touches[0].pageX;
      g.startY = touches[0].pageY;
    }
  };

  // Se usan los eventos de toque directos y no el sistema de «responder» de React Native: en Android ese sistema
  // soltaba el gesto apenas se apoyaba el segundo dedo y nunca llegaba a haber dos dedos en el pellizco.
  const onTouchStart = (e: GestureResponderEvent) => {
    if (gesture.current.touches === 0) {
      stopRestoring();
      gesture.current.moved = false;
    }
    begin(e.nativeEvent.touches as unknown as TouchPoint[]);
  };

  const onTouchEnd = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches as unknown as TouchPoint[];
    // Si queda algún dedo apoyado se sigue desde donde está la imagen; al levantar el último, vuelve al tamaño original
    if (touches.length > 0) begin(touches);
    else onRelease();
  };

  const onTouchMove = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches as unknown as TouchPoint[];
    const g = gesture.current;
    if (touches.length !== g.touches) begin(touches);

    if (touches.length >= 2) {
      g.moved = true;
      const ratio = g.startDistance > 0 ? distanceBetween(touches[0], touches[1]) / g.startDistance : 1;
      const nextScale = clampScale(g.baseScale * ratio);
      // Con los dedos juntos o separados se acerca desde ellos; si además se mueven, la imagen los acompaña
      const center = { pageX: size.current.width / 2, pageY: size.current.height / 2 };
      const next = pinchTranslation({ x: g.baseX, y: g.baseY }, g.baseScale, nextScale, g.startMid, midpoint(touches[0], touches[1]), center);
      apply(nextScale, next.x, next.y);
      return;
    }
    if (touches.length === 1) {
      const dx = touches[0].pageX - g.startX;
      const dy = touches[0].pageY - g.startY;
      if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) g.moved = true;
      // Sin zoom no hay nada que mover
      if (current.current.scale > 1) apply(current.current.scale, g.baseX + dx, g.baseY + dy);
    }
  };

  const onRelease = () => {
    gesture.current.touches = 0;
    // Se soltaron los dedos: la imagen vuelve a su tamaño y lugar originales (un toque suelto no cambia nada)
    const { scale: s, x, y } = current.current;
    if (!isResetScale(s) || x !== 0 || y !== 0) restore();
    else reset();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          testID="zoom-surface"
          style={styles.surface}
          onLayout={e => { size.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }; }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onRelease}
        >
          <Animated.Image
            testID="zoom-image"
            source={{ uri }}
            resizeMode="contain"
            style={[styles.image, { transform: [{ translateX }, { translateY }, { scale }] }]}
          />
        </View>
        <TouchableOpacity
          testID="image-viewer-close"
          accessibilityLabel={t('product.imageClose')}
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          onPress={onClose}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  surface: { flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
