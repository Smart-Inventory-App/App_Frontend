import React from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text } from 'react-native';
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
    // la subida empieza cuando la ventana ya se ve
    act(() => { UNSAFE_getAllByType(Modal)[0].props.onShow(); });
    // un fundido para el fondo y un deslizamiento aparte para la hoja
    expect(timing.mock.calls.filter(([, config]) => config.toValue === 1)).toHaveLength(2);
    timing.mockRestore();
  });

  describe('smooth opening', () => {
    const entering = (timing: jest.SpyInstance) => timing.mock.calls.filter(([, config]) => config.toValue === 1);

    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

    it('does not start sliding up while the window is still opening: it waits until the system says it is shown', () => {
      const timing = jest.spyOn(Animated, 'timing');
      const { UNSAFE_getAllByType, rerender } = render(sheet(false));
      rerender(sheet(true));
      expect(entering(timing)).toHaveLength(0);
      act(() => { UNSAFE_getAllByType(Modal)[0].props.onShow(); });
      expect(entering(timing)).toHaveLength(2);
    });

    it('starts only once per opening, even if the system reports the window twice', () => {
      const timing = jest.spyOn(Animated, 'timing');
      const { UNSAFE_getAllByType, rerender } = render(sheet(false));
      rerender(sheet(true));
      act(() => { UNSAFE_getAllByType(Modal)[0].props.onShow(); });
      act(() => { UNSAFE_getAllByType(Modal)[0].props.onShow(); });
      act(() => { jest.advanceTimersByTime(1000); });
      expect(entering(timing)).toHaveLength(2);
    });

    it('slides up anyway after a short wait if the system never reports the window', () => {
      const timing = jest.spyOn(Animated, 'timing');
      const { rerender } = render(sheet(false));
      rerender(sheet(true));
      expect(entering(timing)).toHaveLength(0);
      act(() => { jest.advanceTimersByTime(300); });
      expect(entering(timing)).toHaveLength(2);
    });

    it('slides up right away when it is reopened while it was still closing', () => {
      const timing = jest.spyOn(Animated, 'timing');
      const { UNSAFE_getAllByType, rerender } = render(sheet(false));
      rerender(sheet(true));
      act(() => { UNSAFE_getAllByType(Modal)[0].props.onShow(); });
      rerender(sheet(false));
      timing.mockClear();
      rerender(sheet(true));
      expect(entering(timing)).toHaveLength(2);
    });

    it('moves on the native driver with an ease-out curve', () => {
      const timing = jest.spyOn(Animated, 'timing');
      const { UNSAFE_getAllByType, rerender } = render(sheet(false));
      rerender(sheet(true));
      act(() => { UNSAFE_getAllByType(Modal)[0].props.onShow(); });
      const configs = entering(timing).map(([, config]) => config);
      expect(configs.every(config => config.useNativeDriver === true)).toBe(true);
      expect(configs.every(config => typeof config.easing === 'function')).toBe(true);
    });

    it('draws the sheet as a single image on Android while it moves, and goes back to normal afterwards', () => {
      const original = Platform.OS;
      (Platform as any).OS = 'android';
      const { UNSAFE_getAllByType, rerender } = render(sheet(false));
      rerender(sheet(true));
      act(() => { UNSAFE_getAllByType(Modal)[0].props.onShow(); });
      expect(screen.getByTestId('sheet').props.renderToHardwareTextureAndroid).toBe(true);
      act(() => { jest.advanceTimersByTime(1000); });
      expect(screen.getByTestId('sheet').props.renderToHardwareTextureAndroid).toBe(false);
      (Platform as any).OS = original;
    });
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
    await act(async () => { await new Promise(r => setTimeout(r, 700)); });
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
    // Todo lo que se escuchó se deja de escuchar al cerrar
    expect(remove).toHaveBeenCalledTimes((Keyboard.addListener as jest.Mock).mock.calls.length);
    jest.restoreAllMocks();
  });

  it('adds it on top of the padding the sheet already has', () => {
    render(withInsets({ padding: 20 }));
    expect(StyleSheet.flatten(screen.getByTestId('sheet').props.style).paddingBottom).toBe(44);
    render(withInsets({ padding: 20, paddingBottom: 10 }));
    expect(StyleSheet.flatten(screen.getByTestId('sheet').props.style).paddingBottom).toBe(34);
  });
});
