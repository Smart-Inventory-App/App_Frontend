import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, GestureResponderEvent, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
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

// Imagen a pantalla completa con zoom: se acerca y se aleja pellizcando con dos dedos (el zoom se hace desde donde
// están los dedos) y, ya acercada, se arrastra con uno o con dos dedos para ver cada parte. No hay zoom con doble toque.
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

  const onGrant = (e: GestureResponderEvent) => {
    gesture.current.moved = false;
    begin(e.nativeEvent.touches as unknown as TouchPoint[]);
  };

  const onMove = (e: GestureResponderEvent) => {
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
    const g = gesture.current;
    // Terminó un pellizco o un arrastre: si quedó casi sin zoom, vuelve al centro. Un toque suelto no hace nada.
    if ((g.touches >= 2 || g.moved) && isResetScale(current.current.scale)) reset();
    g.touches = 0;
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
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={onGrant}
          onResponderMove={onMove}
          onResponderRelease={onRelease}
          onResponderTerminate={onRelease}
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
