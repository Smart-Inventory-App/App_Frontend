import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';

interface Props {
  message: string;
  onDismiss: () => void;
  /** Si se indica, el banner se cierra solo (con animación) pasado este tiempo. */
  autoDismissMs?: number;
}

const WRAPPER_PADDING_TOP = 40;
const EXIT_DISTANCE = 200;
const EXIT_DURATION_MS = 220;
const SWIPE_DISTANCE_TO_DISMISS = 30;
const SWIPE_VELOCITY_TO_DISMISS = 0.5;

const useNativeDriver = Platform.OS !== 'web';

export function shouldDismissOnSwipe(dy: number, vy: number): boolean {
  return dy < -SWIPE_DISTANCE_TO_DISMISS || vy < -SWIPE_VELOCITY_TO_DISMISS;
}

export default function TopBanner({ message, onDismiss, autoDismissMs }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const dismissing = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const dismiss = useRef(() => {
    if (dismissing.current) return;
    dismissing.current = true;
    Animated.timing(translateY, {
      toValue: -EXIT_DISTANCE,
      duration: EXIT_DURATION_MS,
      useNativeDriver,
    }).start(() => onDismissRef.current());
  }).current;

  useEffect(() => {
    if (!autoDismissMs) return;
    const timer = setTimeout(dismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, dismiss]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Solo toma el gesto si el desplazamiento es hacia arriba y más vertical que horizontal.
        onMoveShouldSetPanResponder: (_e, g) => g.dy < -5 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          if (!dismissing.current) translateY.setValue(Math.min(0, g.dy));
        },
        onPanResponderRelease: (_e, g) => {
          if (shouldDismissOnSwipe(g.dy, g.vy)) {
            dismiss();
          } else {
            Animated.spring(translateY, { toValue: 0, useNativeDriver }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, { toValue: 0, useNativeDriver }).start();
        },
      }),
    [dismiss, translateY],
  );

  return (
    <View testID="top-banner" style={[styles.wrapper, { paddingTop: Math.max(WRAPPER_PADDING_TOP, insets.top + 8) }]} pointerEvents="box-none">
      <Animated.View
        style={[styles.animated, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.banner}
          onPress={dismiss}
          activeOpacity={0.9}
          accessibilityRole="alert"
        >
          <Text style={styles.text}>{message}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: WRAPPER_PADDING_TOP,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  animated: { width: '100%', maxWidth: 480 },
  banner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.valid,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  text: { color: Colors.white, fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
