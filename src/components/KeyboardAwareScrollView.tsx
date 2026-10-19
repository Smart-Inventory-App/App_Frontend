import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, ScrollView, ScrollViewProps, TextInput } from 'react-native';

// Cuánto queda visible por encima del campo cuando la pantalla se desplaza para mostrarlo sobre el teclado
const FIELD_TOP_MARGIN = 120;
// Espera a que la pantalla se reacomode al abrirse el teclado antes de desplazarla
const KEYBOARD_SCROLL_DELAY_MS = 100;
// Espacio extra al final mientras el teclado está abierto, para poder subir hasta los últimos campos
const KEYBOARD_PADDING_RATIO = 0.45;

// Los campos de texto avisan por acá que fueron tocados (ver AppTextInput).
export const FieldFocusContext = createContext<(() => void) | null>(null);
export const useFieldFocus = () => useContext(FieldFocusContext);

/**
 * ScrollView para pantallas con campos de texto:
 * - El campo que se está completando se desplaza hasta quedar por encima del teclado.
 * - Tocar una sugerencia o un botón con el teclado abierto funciona al primer toque.
 * Quien lo use debe reservar el lugar del teclado con un KeyboardAvoidingView (padding).
 */
export default function KeyboardAwareScrollView({ contentContainerStyle, children, ...rest }: ScrollViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
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
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      keyboardOpenRef.current = true;
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

  return (
    <FieldFocusContext.Provider value={handleFieldFocus}>
      <ScrollView
        {...rest}
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          contentContainerStyle,
          keyboardOpen && { paddingBottom: Math.round(Dimensions.get('window').height * KEYBOARD_PADDING_RATIO) },
        ]}
      >
        {children}
      </ScrollView>
    </FieldFocusContext.Provider>
  );
}
