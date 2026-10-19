import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

/**
 * El tilde de la pantalla «¡Listo!»: aparece de la nada, agrandándose desde un punto con un pequeño rebote
 * (como un «pop»), en vez de estar ya dibujado cuando se abre la pantalla.
 */
export default function SuccessCheck({ size = 72 }: { size?: number }) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pop = Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 120,
      useNativeDriver: true,
    });
    pop.start();
    return () => pop.stop();
  }, [scale]);

  return (
    <Animated.View
      testID="success-check"
      style={{ opacity: scale.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }), transform: [{ scale }] }}
    >
      <Ionicons name="checkmark-circle" size={size} color={Colors.primary} />
    </Animated.View>
  );
}
