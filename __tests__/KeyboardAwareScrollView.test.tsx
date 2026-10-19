import React, { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import AppTextInput from '../src/components/AppTextInput';
import KeyboardAwareScrollView from '../src/components/KeyboardAwareScrollView';

const handlers: Record<string, () => void> = {};
const originalState = (TextInput as any).State;

beforeEach(() => {
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
    handlers[event] = cb;
    return { remove: jest.fn() };
  }) as any);
});

afterEach(() => {
  (TextInput as any).State = originalState;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const padding = () => StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle).paddingBottom;

describe('KeyboardAwareScrollView', () => {
  it('lets the first tap reach buttons and suggestions while the keyboard is open', () => {
    render(<KeyboardAwareScrollView><View /></KeyboardAwareScrollView>);
    expect(screen.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('keeps the given content style and adds room at the end only while the keyboard is open', () => {
    render(<KeyboardAwareScrollView contentContainerStyle={{ paddingBottom: 24, padding: 8 }}><View /></KeyboardAwareScrollView>);
    expect(padding()).toBe(24);
    act(() => { handlers.keyboardDidShow(); });
    expect(padding()).toBeGreaterThan(24);
    expect(StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle).padding).toBe(8);
    act(() => { handlers.keyboardDidHide(); });
    expect(padding()).toBe(24);
  });

  it('scrolls the focused field above the keyboard, waiting for the keyboard if it is still opening', () => {
    jest.useFakeTimers();
    render(
      <KeyboardAwareScrollView>
        <AppTextInput testID="campo" />
      </KeyboardAwareScrollView>,
    );
    const scroll = screen.UNSAFE_getByType(ScrollView).instance as any;
    scroll.getInnerViewRef = jest.fn(() => ({}));
    scroll.scrollTo = jest.fn();
    (TextInput as any).State = {
      currentlyFocusedInput: () => ({ measureLayout: (_inner: unknown, ok: (x: number, y: number) => void) => ok(0, 500) }),
    };

    fireEvent(screen.getByTestId('campo'), 'focus');
    expect(scroll.scrollTo).not.toHaveBeenCalled();
    act(() => { handlers.keyboardDidShow(); });
    act(() => { jest.advanceTimersByTime(150); });
    expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 380, animated: true });

    scroll.scrollTo.mockClear();
    fireEvent(screen.getByTestId('campo'), 'focus');
    expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 380, animated: true });
  });

  it('never scrolls above the top and does nothing if the field cannot be measured', () => {
    render(
      <KeyboardAwareScrollView>
        <AppTextInput testID="campo" />
      </KeyboardAwareScrollView>,
    );
    const scroll = screen.UNSAFE_getByType(ScrollView).instance as any;
    scroll.getInnerViewRef = jest.fn(() => ({}));
    scroll.scrollTo = jest.fn();

    (TextInput as any).State = { currentlyFocusedInput: () => null };
    fireEvent(screen.getByTestId('campo'), 'focus');
    act(() => { handlers.keyboardDidShow(); });
    expect(scroll.scrollTo).not.toHaveBeenCalled();

    (TextInput as any).State = {
      currentlyFocusedInput: () => ({ measureLayout: (_inner: unknown, ok: (x: number, y: number) => void) => ok(0, 30) }),
    };
    fireEvent(screen.getByTestId('campo'), 'focus');
    expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
  });

  it('falls back to the web inner node, and ignores a missing inner view', () => {
    render(
      <KeyboardAwareScrollView>
        <AppTextInput testID="campo" />
      </KeyboardAwareScrollView>,
    );
    const scroll = screen.UNSAFE_getByType(ScrollView).instance as any;
    scroll.getInnerViewRef = undefined;
    scroll.getInnerViewNode = jest.fn(() => ({}));
    scroll.scrollTo = jest.fn();
    (TextInput as any).State = {
      currentlyFocusedInput: () => ({ measureLayout: (_inner: unknown, ok: (x: number, y: number) => void) => ok(0, 400) }),
    };
    act(() => { handlers.keyboardDidShow(); });
    fireEvent(screen.getByTestId('campo'), 'focus');
    expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 280, animated: true });

    scroll.scrollTo.mockClear();
    scroll.getInnerViewNode = () => undefined;
    fireEvent(screen.getByTestId('campo'), 'focus');
    expect(scroll.scrollTo).not.toHaveBeenCalled();
  });
});

describe('AppTextInput', () => {
  it('keeps working outside a KeyboardAwareScrollView and still calls the given onFocus', () => {
    const onFocus = jest.fn();
    render(<AppTextInput testID="solo" onFocus={onFocus} />);
    fireEvent(screen.getByTestId('solo'), 'focus');
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('forwards the ref to the underlying TextInput', () => {
    const ref = createRef<TextInput>();
    render(<AppTextInput ref={ref} testID="con-ref" />);
    expect(ref.current).toBeTruthy();
  });
});
