import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Keyboard, LayoutChangeEvent, ScrollView, ScrollViewProps, StyleSheet, TextInput } from 'react-native';

// Cuánto queda visible por encima del campo cuando la pantalla se desplaza para mostrarlo sobre el teclado
const FIELD_TOP_MARGIN = 120;
// Espera a que la pantalla se reacomode al abrirse el teclado antes de desplazarla
const KEYBOARD_SCROLL_DELAY_MS = 100;

// Los campos de texto avisan por acá que fueron tocados (ver AppTextInput).
export const FieldFocusContext = createContext<(() => void) | null>(null);
export const useFieldFocus = () => useContext(FieldFocusContext);

/**
 * ScrollView para pantallas con campos de texto:
 * - El campo que se está completando se desplaza hasta quedar por encima del teclado.
 * - Tocar una sugerencia o un botón con el teclado abierto funciona al primer toque.
 * Quien lo use debe reservar el lugar del teclado con un KeyboardAvoidingView (padding).
 */
export default function KeyboardAwareScrollView({ contentContainerStyle, children, onLayout, ...rest }: ScrollViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Alto visible de la pantalla con el teclado cerrado y ahora: la diferencia es lo que el teclado ya le sacó
  const [viewportHeight, setViewportHeight] = useState(0);
  const closedViewportRef = useRef(0);
  const keyboardOpenRef = useRef(false);
  const pendingScrollRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollFocusedFieldIntoView = useCallback(() => {
    const input = TextInput.State?.currentlyFocusedInput?.() as any;
    const scroll = scrollRef.current as any;
    const inner = scroll?.getInnerViewRef?.() ?? scroll?.getInnerViewNode?.();
    if (!input?.measureLayout || !inner) return;
    input.measureLayout(
      inner,
      (_x: number, y: number) => {
        scrollRef.current?.scrollTo({ y: Math.max(y - FIELD_TOP_MARGIN, 0), animated: true });
      },
      () => {},
    );
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event?: { endCoordinates?: { height?: number } }) => {
      keyboardOpenRef.current = true;
      setKeyboardHeight(event?.endCoordinates?.height ?? 0);
      setKeyboardOpen(true);
      if (!pendingScrollRef.current) return;
      pendingScrollRef.current = false;
      scrollTimerRef.current = setTimeout(scrollFocusedFieldIntoView, KEYBOARD_SCROLL_DELAY_MS);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardOpenRef.current = false;
      pendingScrollRef.current = false;
      setKeyboardOpen(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [scrollFocusedFieldIntoView]);

  // Con el teclado ya abierto se desplaza enseguida; si recién se está abriendo, espera a que aparezca
  const handleFieldFocus = useCallback(() => {
    if (keyboardOpenRef.current) scrollFocusedFieldIntoView();
    else pendingScrollRef.current = true;
  }, [scrollFocusedFieldIntoView]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (!keyboardOpenRef.current) closedViewportRef.current = height;
    setViewportHeight(height);
    onLayout?.(event);
  }, [onLayout]);

  // Lugar extra al final mientras el teclado está abierto, para poder subir hasta los últimos campos. Es solo lo que
  // el teclado cubre y la pantalla no se achicó: ese espacio queda detrás del teclado y nunca se ve en blanco. Si la
  // pantalla ya se achicó sola (KeyboardAvoidingView), no se agrega nada y no se puede bajar a un vacío.
  const covered = keyboardOpen ? Math.max(0, closedViewportRef.current - viewportHeight) : 0;
  const extraBottom = keyboardOpen ? Math.max(0, keyboardHeight - covered) : 0;
  const givenStyle = StyleSheet.flatten(contentContainerStyle) ?? {};
  const givenBottom = Number(givenStyle.paddingBottom ?? givenStyle.padding ?? 0);

  return (
    <FieldFocusContext.Provider value={handleFieldFocus}>
      <ScrollView
        {...rest}
        ref={scrollRef}
        onLayout={handleLayout}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[contentContainerStyle, extraBottom > 0 && { paddingBottom: givenBottom + extraBottom }]}
      >
        {children}
      </ScrollView>
    </FieldFocusContext.Provider>
  );
}
