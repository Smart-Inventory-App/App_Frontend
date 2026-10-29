import React from 'react';
import { Keyboard, Modal, Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import BottomSheetModal from '../src/components/BottomSheetModal';
import CenteredModal from '../src/components/CenteredModal';

type Listener = () => void;

// Un teclado que se puede abrir y cerrar a mano
function fakeKeyboard(initiallyVisible: boolean) {
  const listeners: Record<string, Listener[]> = {};
  let visible = initiallyVisible;
  jest.spyOn(Keyboard, 'isVisible').mockImplementation(() => visible);
  const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: Listener) => {
    (listeners[event] ??= []).push(cb);
    return { remove: () => { listeners[event] = (listeners[event] ?? []).filter(l => l !== cb); } };
  }) as any);
  return {
    dismiss,
    hide: () => { visible = false; (listeners.keyboardDidHide ?? []).slice().forEach(l => l()); },
  };
}

const sheet = (visible: boolean) => (
  <BottomSheetModal visible={visible} onRequestClose={jest.fn()} sheetTestID="sheet">
    <Text>contenido</Text>
  </BottomSheetModal>
);

const centered = (visible: boolean) => (
  <CenteredModal visible={visible} onRequestClose={jest.fn()}>
    <Text>contenido</Text>
  </CenteredModal>
);

const modalOpen = () => screen.UNSAFE_queryAllByType(Modal).some(m => m.props.visible);

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe.each([
  ['BottomSheetModal', sheet],
  ['CenteredModal', centered],
])('%s - with the keyboard open', (_name, build) => {
  it('opens right away when the keyboard is closed', () => {
    const keyboard = fakeKeyboard(false);
    const { rerender } = render(build(false));
    rerender(build(true));
    expect(modalOpen()).toBe(true);
    expect(keyboard.dismiss).not.toHaveBeenCalled();
  });

  it('closes the keyboard first and opens the window only once it is closed', () => {
    const keyboard = fakeKeyboard(true);
    const { rerender } = render(build(false));
    rerender(build(true));
    expect(keyboard.dismiss).toHaveBeenCalledTimes(1);
    expect(modalOpen()).toBe(false);
    act(() => { keyboard.hide(); });
    expect(modalOpen()).toBe(true);
    expect(screen.getByText('contenido')).toBeTruthy();
  });

  it('opens anyway after a short wait if the system never says the keyboard closed', () => {
    jest.useFakeTimers();
    fakeKeyboard(true);
    const { rerender } = render(build(false));
    rerender(build(true));
    expect(modalOpen()).toBe(false);
    act(() => { jest.advanceTimersByTime(400); });
    expect(modalOpen()).toBe(true);
  });

  it('does not open if it was closed again while the keyboard was closing', () => {
    const keyboard = fakeKeyboard(true);
    const { rerender } = render(build(false));
    rerender(build(true));
    rerender(build(false));
    act(() => { keyboard.hide(); });
    expect(modalOpen()).toBe(false);
  });
});
