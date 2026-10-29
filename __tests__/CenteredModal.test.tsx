import React from 'react';
import { Keyboard, Modal, StyleSheet, Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CenteredModal from '../src/components/CenteredModal';

const centered = (visible: boolean, onRequestClose = jest.fn()) => (
  <CenteredModal visible={visible} onRequestClose={onRequestClose} overlayTestID="overlay" cardTestID="card">
    <Text>contenido</Text>
  </CenteredModal>
);

describe('CenteredModal', () => {
  it('renders nothing while hidden and shows the content when visible', () => {
    const { rerender } = render(centered(false));
    expect(screen.queryByText('contenido')).toBeNull();
    rerender(centered(true));
    expect(screen.getByText('contenido')).toBeTruthy();
  });

  it('is a transparent window that fades in, in the center of the screen', () => {
    render(centered(true));
    const modal = screen.UNSAFE_getByType(Modal);
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.animationType).toBe('fade');
    expect(StyleSheet.flatten(screen.getByTestId('centered-modal-inner').props.style).justifyContent).toBe('center');
    expect(StyleSheet.flatten(screen.getByTestId('card').props.style).borderRadius).toBe(20);
  });

  it('does not close when tapping outside the window or on it', () => {
    const onRequestClose = jest.fn();
    render(centered(true, onRequestClose));
    fireEvent.press(screen.getByTestId('overlay'));
    fireEvent.press(screen.getByTestId('card'));
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('closes only with the system back button', () => {
    const onRequestClose = jest.fn();
    render(centered(true, onRequestClose));
    screen.UNSAFE_getByType(Modal).props.onRequestClose();
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('shrinks to leave room for the keyboard', () => {
    render(centered(true));
    expect(StyleSheet.flatten(screen.getByTestId('card').props.style).flexShrink).toBe(1);
  });

  describe('lifting for the keyboard', () => {
    const handlers: Record<string, (event?: unknown) => void> = {};
    // Dónde queda, en la pantalla, el fondo de la ventana (se mide con measureInWindow)
    let windowBottom = 800;
    const inner = () => StyleSheet.flatten(screen.getByTestId('centered-modal-inner').props.style);

    beforeEach(() => {
      jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
        handlers[event] = cb;
        return { remove: jest.fn() };
      }) as any);
      jest.spyOn(View.prototype as any, 'measureInWindow').mockImplementation(((cb: (x: number, y: number, w: number, h: number) => void) => {
        cb(0, 0, 360, windowBottom);
      }) as any);
    });
    afterEach(() => { jest.restoreAllMocks(); });

    const showKeyboard = (screenY: number) => act(() => { handlers.keyboardDidShow({ endCoordinates: { screenY, height: 800 - screenY } }); });

    it('lifts only as much as the keyboard covers, and goes back to its place when the keyboard closes', () => {
      render(centered(true));
      const resting = inner().paddingBottom;
      windowBottom = 800;
      showKeyboard(500);
      expect(inner().paddingBottom).toBe(24 + 300);
      act(() => { handlers.keyboardDidHide(); });
      expect(inner().paddingBottom).toBe(resting);
    });

    it('does not lift when the system already shrank the window above the keyboard', () => {
      render(centered(true));
      windowBottom = 500;
      showKeyboard(500);
      expect(inner().paddingBottom).toBe(24);
    });

    it('measures again when the window changes size, so the lift never outlasts the keyboard', () => {
      render(centered(true));
      windowBottom = 800;
      showKeyboard(500);
      expect(inner().paddingBottom).toBe(324);
      // el sistema achica la ventana mientras el teclado sigue abierto
      windowBottom = 500;
      act(() => { screen.getByTestId('centered-modal-root').props.onLayout(); });
      expect(inner().paddingBottom).toBe(24);
      // y al cerrarse el teclado, un cambio de tamaño tardío no vuelve a elevarla
      act(() => { handlers.keyboardDidHide(); });
      windowBottom = 800;
      act(() => { screen.getByTestId('centered-modal-root').props.onLayout(); });
      expect(inner().paddingBottom).toBe(24);
    });

    it('does not lift when the keyboard does not say where it is', () => {
      render(centered(true));
      act(() => { handlers.keyboardDidShow(); });
      expect(inner().paddingBottom).toBe(24);
    });
  });

  describe('Android system buttons', () => {
    const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 30, left: 0, right: 0, bottom: 48 } };
    const withInsets = () => (
      <SafeAreaProvider initialMetrics={metrics}>{centered(true)}</SafeAreaProvider>
    );
    const inner = () => StyleSheet.flatten(screen.getByTestId('centered-modal-inner').props.style);

    afterEach(() => { jest.restoreAllMocks(); });

    it('covers the whole screen and keeps the window clear of the status bar and the system buttons', () => {
      render(withInsets());
      const modal = screen.UNSAFE_getByType(Modal);
      expect(modal.props.statusBarTranslucent).toBe(true);
      expect(modal.props.navigationBarTranslucent).toBe(true);
      expect(inner().paddingBottom).toBe(60);
      expect(inner().paddingTop).toBe(42);
    });

    it('does not leave room for the system buttons while the keyboard covers them', () => {
      const handlers: Record<string, () => void> = {};
      jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
        handlers[event] = cb;
        return { remove: jest.fn() };
      }) as any);
      render(withInsets());
      act(() => { handlers.keyboardDidShow(); });
      expect(inner().paddingBottom).toBe(24);
      act(() => { handlers.keyboardDidHide(); });
      expect(inner().paddingBottom).toBe(60);
    });
  });
});
