import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

// Si el sistema no avisa que el teclado terminó de cerrarse, la ventana se abre igual pasado este tiempo
const KEYBOARD_CLOSE_FALLBACK_MS = 350;

/**
 * Una ventana que se abre con el teclado levantado se arma sobre un alto de pantalla que cambia mientras el teclado se
 * cierra, y puede quedar con un hueco transparente debajo. Por eso, si el teclado está abierto, se lo cierra y la
 * ventana se abre recién cuando terminó de cerrarse. Devuelve si la ventana ya puede mostrarse.
 */
export function useOpenAfterKeyboardCloses(visible: boolean): boolean {
  const [open, setOpen] = useState(visible);

  useEffect(() => {
    if (!visible) {
      setOpen(false);
      return;
    }
    if (!Keyboard.isVisible?.()) {
      setOpen(true);
      return;
    }
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setOpen(true));
    const fallback = setTimeout(() => setOpen(true), KEYBOARD_CLOSE_FALLBACK_MS);
    Keyboard.dismiss();
    return () => {
      hideSub.remove();
      clearTimeout(fallback);
    };
  }, [visible]);

  return open;
}
