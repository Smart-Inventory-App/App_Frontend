import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { Keyboard, KeyboardAvoidingView as NativeKeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import KeyboardAvoidingView from '../src/components/KeyboardAvoidingView';

const handlers: Record<string, (event?: any) => void> = {};
const originalOS = Platform.OS;
let measured = { y: 0, height: 800 };

beforeEach(() => {
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
    handlers[event] = cb;
    return { remove: jest.fn() };
  }) as any);
  measured = { y: 0, height: 800 };
  jest.spyOn(View.prototype as any, 'measureInWindow').mockImplementation(((cb: any) => cb(0, measured.y, 360, measured.height)) as any);
});

afterEach(() => {
  (Platform as any).OS = originalOS;
  jest.restoreAllMocks();
});

const outer = () => screen.getByTestId('kav');
const bottom = () => StyleSheet.flatten(outer().props.style).paddingBottom;
const show = (screenY: number, height = 300) => act(() => { handlers.keyboardDidShow({ endCoordinates: { screenY, height } }); });
const hide = () => act(() => { handlers.keyboardDidHide(); });

describe('KeyboardAvoidingView - iOS', () => {
  it('uses the one of React Native with padding', () => {
    (Platform as any).OS = 'ios';
    render(<KeyboardAvoidingView testID="kav" style={{ flex: 1 }}><Text>hola</Text></KeyboardAvoidingView>);
    expect(screen.UNSAFE_getByType(NativeKeyboardAvoidingView).props.behavior).toBe('padding');
    expect(screen.getByText('hola')).toBeTruthy();
  });
});

describe('KeyboardAvoidingView - Android', () => {
  beforeEach(() => { (Platform as any).OS = 'android'; });

  const setup = (style: any = { flex: 1, paddingTop: 20, paddingBottom: 48 }) =>
    render(<KeyboardAvoidingView testID="kav" style={style}><Text>hola</Text></KeyboardAvoidingView>);

  it('does not use the native one that leaves a white strip, and keeps the given style while the keyboard is closed', () => {
    setup();
    expect(screen.UNSAFE_queryByType(NativeKeyboardAvoidingView)).toBeNull();
    expect(bottom()).toBe(48);
    expect(StyleSheet.flatten(outer().props.style).paddingTop).toBe(20);
    expect(screen.getByText('hola')).toBeTruthy();
  });

  it('leaves exactly what the keyboard covers when it opens, replacing the resting space (no extra strip)', () => {
    setup();
    show(500);
    expect(bottom()).toBe(300);
  });

  it('removes the space as soon as the keyboard closes, so no strip is left behind', () => {
    setup();
    show(500);
    hide();
    expect(bottom()).toBe(48);
  });

  it('uses only the part of the keyboard that overlaps the view when the view ends above the screen bottom', () => {
    measured = { y: 100, height: 600 };
    setup();
    show(500);
    expect(bottom()).toBe(200);
  });

  it('adds nothing when the keyboard does not reach the view', () => {
    measured = { y: 0, height: 400 };
    setup();
    show(500);
    expect(bottom()).toBe(0);
  });

  it('falls back to the keyboard height when its position is unknown', () => {
    setup();
    act(() => { handlers.keyboardDidShow({ endCoordinates: { height: 280 } }); });
    expect(bottom()).toBe(280);
    act(() => { handlers.keyboardDidShow(undefined); });
    expect(bottom()).toBe(0);
  });

  it('works without a bottom padding in the style', () => {
    setup({ flex: 1 });
    expect(bottom()).toBeUndefined();
    show(500);
    expect(bottom()).toBe(300);
    hide();
    expect(bottom()).toBeUndefined();
  });

  it('stops listening to the keyboard when it is unmounted', () => {
    const remove = jest.fn();
    (Keyboard.addListener as jest.Mock).mockImplementation(() => ({ remove }));
    setup().unmount();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
