import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView as NativeKeyboardAvoidingView, Platform, View, ViewProps } from 'react-native';

/**
 * Reserva el lugar del teclado en una pantalla (la sube para que los campos queden a la vista).
 *
 * - iOS: el KeyboardAvoidingView de React Native en modo `padding`.
 * - Android: el de React Native deja un espacio en blanco del alto de los botones del sistema sobre el teclado, que
 *   además queda cuando el teclado se cierra (hasta cambiar de pantalla). Acá el espacio se calcula con lo que el
 *   teclado realmente tapa de ESTA vista (medida en la ventana) y se quita apenas el teclado se cierra.
 *
 * El `paddingBottom` del `style` es el espacio con el teclado cerrado (por ejemplo, el de los botones del sistema); con el
 * teclado abierto lo reemplaza lo que el teclado tapa.
 */
export default function KeyboardAvoidingView({ style, children, ...rest }: ViewProps) {
  if (Platform.OS !== 'android') {
    return <NativeKeyboardAvoidingView behavior="padding" style={style} {...rest}>{children}</NativeKeyboardAvoidingView>;
  }
  return <AndroidKeyboardAvoidingView style={style} {...rest}>{children}</AndroidKeyboardAvoidingView>;
}

function AndroidKeyboardAvoidingView({ style, children, ...rest }: ViewProps) {
  const ref = useRef<View>(null);
  const [covered, setCovered] = useState<number | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event?: { endCoordinates?: { screenY?: number; height?: number } }) => {
      const keyboardTop = event?.endCoordinates?.screenY;
      ref.current?.measureInWindow((_x: number, y: number, _width: number, height: number) => {
        // Lo que el teclado tapa de la vista: desde su borde superior hasta el borde inferior de la vista
        const overlap = keyboardTop == null ? event?.endCoordinates?.height ?? 0 : y + height - keyboardTop;
        setCovered(Math.max(0, overlap));
      });
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setCovered(null));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <View ref={ref} {...rest} style={[style, covered !== null && { paddingBottom: covered }]}>
      {children}
    </View>
  );
}
