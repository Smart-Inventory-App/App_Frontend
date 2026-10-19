import React from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Modal, StyleSheet, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BottomSheetModal from '../src/components/BottomSheetModal';

const sheet = (visible: boolean, onRequestClose = jest.fn()) => (
  <BottomSheetModal visible={visible} onRequestClose={onRequestClose} overlayTestID="overlay" sheetTestID="sheet">
    <Text>contenido</Text>
  </BottomSheetModal>
);

describe('BottomSheetModal', () => {
  it('renders nothing while hidden and shows the content when visible', () => {
    const { rerender } = render(sheet(false));
    expect(screen.queryByText('contenido')).toBeNull();
    rerender(sheet(true));
    expect(screen.getByText('contenido')).toBeTruthy();
  });

  it('does not use the native slide animation: the backdrop only fades and the sheet moves on its own', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const { UNSAFE_getAllByType, rerender } = render(sheet(false));
    rerender(sheet(true));
    expect(UNSAFE_getAllByType(Modal)[0].props.animationType).toBe('none');
    // un fundido para el fondo y un deslizamiento aparte para la hoja
    expect(timing.mock.calls.filter(([, config]) => config.toValue === 1)).toHaveLength(2);
    timing.mockRestore();
  });

  it('lifts the sheet above the keyboard so its fields stay visible', () => {
    const { UNSAFE_getByType } = render(sheet(true));
    expect(UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
  });

  it('calls onRequestClose when tapping the backdrop or pressing back, but not when tapping the sheet', () => {
    const onRequestClose = jest.fn();
    const { UNSAFE_getAllByType } = render(sheet(true, onRequestClose));
    fireEvent.press(screen.getByTestId('sheet'));
    expect(onRequestClose).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('overlay'));
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    UNSAFE_getAllByType(Modal)[0].props.onRequestClose();
    expect(onRequestClose).toHaveBeenCalledTimes(2);
  });

  it('keeps the content until the closing animation ends, then unmounts it', async () => {
    const { rerender } = render(sheet(true));
    rerender(sheet(false));
    expect(screen.getByText('contenido')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('contenido')).toBeNull(), { timeout: 3000 });
  });

  it('can be reopened right after closing', async () => {
    const { rerender } = render(sheet(true));
    rerender(sheet(false));
    rerender(sheet(true));
    await act(async () => { await new Promise(r => setTimeout(r, 400)); });
    expect(screen.getByText('contenido')).toBeTruthy();
  });
});

describe('BottomSheetModal - botones del sistema de Android', () => {
  const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 30, left: 0, right: 0, bottom: 24 } };
  const withInsets = (sheetStyle?: object) => (
    <SafeAreaProvider initialMetrics={metrics}>
      <BottomSheetModal visible onRequestClose={jest.fn()} sheetStyle={sheetStyle} sheetTestID="sheet">
        <Text>contenido</Text>
      </BottomSheetModal>
    </SafeAreaProvider>
  );

  it('covers the whole screen, also under the status bar and the system buttons', () => {
    const { UNSAFE_getByType } = render(withInsets());
    expect(UNSAFE_getByType(Modal).props.statusBarTranslucent).toBe(true);
    expect(UNSAFE_getByType(Modal).props.navigationBarTranslucent).toBe(true);
  });

  it('adds the height of the system buttons below the sheet content', () => {
    render(withInsets());
    expect(StyleSheet.flatten(screen.getByTestId('sheet').props.style).paddingBottom).toBe(24);
  });

  it('does not leave room for the system buttons while the keyboard covers them', () => {
    const handlers: Record<string, () => void> = {};
    const remove = jest.fn();
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
      handlers[event] = cb;
      return { remove };
    }) as any);
    const { unmount } = render(withInsets());
    const padding = () => StyleSheet.flatten(screen.getByTestId('sheet').props.style).paddingBottom;
    expect(padding()).toBe(24);
    act(() => { handlers.keyboardDidShow(); });
    expect(padding()).toBe(0);
    act(() => { handlers.keyboardDidHide(); });
    expect(padding()).toBe(24);
    unmount();
    expect(remove).toHaveBeenCalledTimes(2);
    jest.restoreAllMocks();
  });

  it('adds it on top of the padding the sheet already has', () => {
    render(withInsets({ padding: 20 }));
    expect(StyleSheet.flatten(screen.getByTestId('sheet').props.style).paddingBottom).toBe(44);
    render(withInsets({ padding: 20, paddingBottom: 10 }));
    expect(StyleSheet.flatten(screen.getAllByTestId('sheet')[1].props.style).paddingBottom).toBe(34);
  });
});
