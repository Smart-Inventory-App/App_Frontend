import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, GestureResponderEvent, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  clampScale,
  clampTranslation,
  distanceBetween,
  isDoubleTap,
  isResetScale,
  nextDoubleTapScale,
  TouchPoint,
} from '@/utils/zoom';

interface Props {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

// Un movimiento menor a esto cuenta como toque (no como arrastre)
const TAP_SLOP = 8;

// Imagen a pantalla completa con zoom: pellizco con dos dedos, arrastre con zoom y doble toque para acercar o volver.
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
    baseScale: 1,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    moved: false,
    lastTap: 0,
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
    if (visible) {
      reset();
      gesture.current.lastTap = 0;
    }
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
      apply(g.baseScale * ratio, g.baseX, g.baseY);
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
    if (g.touches >= 2 || g.moved) {
      // Terminó un pellizco o un arrastre: si quedó casi sin zoom, vuelve al centro
      if (isResetScale(current.current.scale)) reset();
      g.touches = 0;
      return;
    }
    g.touches = 0;
    const now = Date.now();
    if (isDoubleTap(now, g.lastTap)) {
      g.lastTap = 0;
      const next = nextDoubleTapScale(current.current.scale);
      if (next === 1) reset();
      else apply(next, 0, 0);
      return;
    }
    g.lastTap = now;
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
