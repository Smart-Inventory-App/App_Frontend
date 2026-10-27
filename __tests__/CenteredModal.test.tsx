import React from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, StyleSheet, Text } from 'react-native';
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
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
    expect(StyleSheet.flatten(screen.getByTestId('card').props.style).flexShrink).toBe(1);
  });

  describe('Android system buttons', () => {
    const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 30, left: 0, right: 0, bottom: 48 } };
    const withInsets = () => (
      <SafeAreaProvider initialMetrics={metrics}>{centered(true)}</SafeAreaProvider>
    );
    // El margen va en un View aparte: KeyboardAvoidingView pisa el padding inferior de su propio estilo
    const inner = () => StyleSheet.flatten(screen.getByTestId('centered-modal-inner').props.style);

    afterEach(() => { jest.restoreAllMocks(); });

    it('covers the whole screen and keeps the window clear of the status bar and the system buttons', () => {
      render(withInsets());
      const modal = screen.UNSAFE_getByType(Modal);
      expect(modal.props.statusBarTranslucent).toBe(true);
      expect(modal.props.navigationBarTranslucent).toBe(true);
      expect(inner().paddingBottom).toBe(60);
      expect(inner().paddingTop).toBe(42);
      expect(StyleSheet.flatten(screen.UNSAFE_getByType(KeyboardAvoidingView).props.style).paddingBottom).toBeUndefined();
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
