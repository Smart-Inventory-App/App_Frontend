import React from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ImageViewerModal from '../src/components/ImageViewerModal';
import ProductImage from '../src/components/ProductImage';

// El ícono carga su fuente de forma asíncrona y eso genera avisos de «act» que no tienen que ver con lo que se prueba
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const touch = (x: number, y = 0) => ({ pageX: x, pageY: y });
const event = (...touches: { pageX: number; pageY: number }[]) => ({ nativeEvent: { touches } });

const transform = () => {
  const list = StyleSheet.flatten(screen.getByTestId('zoom-image').props.style).transform as Record<string, number>[];
  return {
    scale: list.find(t => 'scale' in t)!.scale,
    x: list.find(t => 'translateX' in t)!.translateX,
    y: list.find(t => 'translateY' in t)!.translateY,
  };
};

const surface = () => screen.getByTestId('zoom-surface');
const open = (onClose = jest.fn()) => {
  const utils = render(<ImageViewerModal visible uri="https://cdn/a.jpg" onClose={onClose} />);
  fireEvent(surface(), 'layout', { nativeEvent: { layout: { width: 400, height: 800 } } });
  return { ...utils, onClose };
};
// La pantalla de las pruebas mide 400 x 800: su centro es (200, 400). El pellizco se hace alrededor del centro
const pinch = (from: number, to: number) => {
  fireEvent(surface(), 'touchStart', event(touch(200 - from / 2, 400), touch(200 + from / 2, 400)));
  fireEvent(surface(), 'touchMove', event(touch(200 - to / 2, 400), touch(200 + to / 2, 400)));
};
const tap = () => {
  fireEvent(surface(), 'touchStart', event(touch(50, 50)));
  fireEvent(surface(), 'touchEnd', event());
};

const originalOS = Platform.OS;

// En las pruebas el driver nativo no existe y lo que anima no se puede leer desde las props: se prueba la lógica del
// gesto con el driver de JavaScript (como en la web). Que en el celular se use el nativo se prueba aparte.
beforeEach(() => {
  jest.useFakeTimers();
  (Platform as any).OS = 'web';
});

afterEach(() => {
  (Platform as any).OS = originalOS;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('ImageViewerModal', () => {
  it('shows nothing while hidden and the image when visible', () => {
    const { rerender } = render(<ImageViewerModal visible={false} uri="https://cdn/a.jpg" onClose={jest.fn()} />);
    expect(screen.queryByTestId('zoom-image')).toBeNull();
    rerender(<ImageViewerModal visible uri="https://cdn/a.jpg" onClose={jest.fn()} />);
    expect(screen.getByTestId('zoom-image').props.source).toEqual({ uri: 'https://cdn/a.jpg' });
    expect(transform()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('closes with the close button and with the system back button', () => {
    const { onClose, UNSAFE_getByType } = open();
    fireEvent.press(screen.getByTestId('image-viewer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    const { Modal } = require('react-native');
    UNSAFE_getByType(Modal).props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('zooms in with two fingers, proportionally to how far they spread', () => {
    open();
    pinch(100, 200);
    expect(transform().scale).toBe(2);
  });

  it('never zooms beyond the maximum while the fingers are down', () => {
    open();
    pinch(100, 1000);
    expect(transform().scale).toBe(5);
  });

  it('lets the user zoom as much as they want between the original size and the maximum', () => {
    open();
    pinch(100, 150);
    expect(transform().scale).toBe(1.5);
    fireEvent(surface(), 'touchMove', event(touch(200 - 175, 400), touch(200 + 175, 400)));
    expect(transform().scale).toBe(3.5);
  });

  it('never goes below the original size', () => {
    open();
    pinch(100, 10);
    expect(transform()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('goes back to the original size and place when the fingers are lifted', () => {
    open();
    pinch(100, 300);
    expect(transform().scale).toBe(3);
    fireEvent(surface(), 'touchEnd', event());
    act(() => { jest.advanceTimersByTime(500); });
    expect(transform()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('also goes back when the system takes the gesture away', () => {
    open();
    pinch(100, 300);
    fireEvent(surface(), 'touchCancel', event());
    act(() => { jest.advanceTimersByTime(500); });
    expect(transform()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('goes back even if the image was moved away from the center while zoomed', () => {
    open();
    fireEvent(surface(), 'touchStart', event(touch(150, 400), touch(250, 400)));
    fireEvent(surface(), 'touchMove', event(touch(130, 380), touch(330, 380)));
    expect(transform().scale).toBe(2);
    expect(transform().x).not.toBe(0);
    fireEvent(surface(), 'touchEnd', event());
    act(() => { jest.advanceTimersByTime(500); });
    expect(transform()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('restores smoothly: it is not at the original size in the middle of the animation', () => {
    open();
    pinch(100, 300);
    fireEvent(surface(), 'touchEnd', event());
    act(() => { jest.advanceTimersByTime(60); });
    expect(transform().scale).toBeGreaterThan(1);
    expect(transform().scale).toBeLessThan(3);
    act(() => { jest.advanceTimersByTime(500); });
    expect(transform().scale).toBe(1);
  });

  it('starts a new pinch from the original size, even if the previous one was still going back', () => {
    open();
    pinch(100, 300);
    fireEvent(surface(), 'touchEnd', event());
    act(() => { jest.advanceTimersByTime(60); });
    pinch(100, 200);
    expect(transform().scale).toBe(2);
    act(() => { jest.advanceTimersByTime(500); });
    expect(transform().scale).toBe(2);
  });

  it('moves the image with one finger while it is zoomed and still pressed, without leaving the screen', () => {
    open();
    pinch(100, 200);
    // se levanta un dedo y el otro sigue apoyado
    fireEvent(surface(), 'touchMove', event(touch(200, 400)));
    fireEvent(surface(), 'touchMove', event(touch(250, 380)));
    expect(transform()).toMatchObject({ scale: 2, x: 50, y: -20 });
    fireEvent(surface(), 'touchMove', event(touch(900, 380)));
    expect(transform().x).toBe(200);
  });

  it('does not move the image with one finger when it is not zoomed', () => {
    open();
    fireEvent(surface(), 'touchStart', event(touch(200, 300)));
    fireEvent(surface(), 'touchMove', event(touch(300, 400)));
    fireEvent(surface(), 'touchEnd', event());
    expect(transform()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('keeps the zoom if a finger is lifted in the middle of a pinch, until the last finger is lifted', () => {
    open();
    pinch(100, 200);
    fireEvent(surface(), 'touchMove', event(touch(100)));
    expect(transform().scale).toBe(2);
    fireEvent(surface(), 'touchMove', event(touch(130)));
    expect(transform()).toMatchObject({ scale: 2, x: 30 });
  });

  it('does not zoom with a double tap, quick or slow', () => {
    let now = 10_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    open();
    tap();
    now += 100;
    tap();
    expect(transform()).toEqual({ scale: 1, x: 0, y: 0 });
    now += 5000;
    tap();
    now += 100;
    tap();
    expect(transform()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('zooms in from the point between the fingers, which stays under them', () => {
    open();
    // Los dedos están a la derecha del centro: (300, 400) y (340, 400); se separan al doble sin moverse
    fireEvent(surface(), 'touchStart', event(touch(300, 400), touch(340, 400)));
    fireEvent(surface(), 'touchMove', event(touch(280, 400), touch(360, 400)));
    expect(transform().scale).toBe(2);
    // El punto medio estaba 120 a la derecha del centro: para que siga bajo los dedos la imagen se corre 120 a la izquierda
    expect(transform().x).toBe(-120);
    expect(transform().y).toBe(0);
  });

  it('drags the image along with two fingers that move together', () => {
    open();
    fireEvent(surface(), 'touchStart', event(touch(150, 400), touch(250, 400)));
    fireEvent(surface(), 'touchMove', event(touch(100, 400), touch(300, 400)));
    fireEvent(surface(), 'touchMove', event(touch(130, 380), touch(330, 380)));
    expect(transform()).toMatchObject({ scale: 2, x: 30, y: -20 });
  });

  it('does not let two fingers drag the image out of the screen', () => {
    open();
    fireEvent(surface(), 'touchStart', event(touch(150, 400), touch(250, 400)));
    fireEvent(surface(), 'touchMove', event(touch(100, 400), touch(300, 400)));
    fireEvent(surface(), 'touchMove', event(touch(950, 400), touch(1150, 400)));
    expect(transform().x).toBe(200);
  });

  it('does not count a drag with one finger as anything', () => {
    open();
    tap();
    fireEvent(surface(), 'touchStart', event(touch(50, 50)));
    fireEvent(surface(), 'touchMove', event(touch(150, 50)));
    fireEvent(surface(), 'touchEnd', event());
    expect(transform().scale).toBe(1);
  });

  it('starts again without zoom every time it is opened', () => {
    const { rerender } = open();
    pinch(100, 300);
    expect(transform().scale).toBe(3);
    rerender(<ImageViewerModal visible={false} uri="https://cdn/a.jpg" onClose={jest.fn()} />);
    rerender(<ImageViewerModal visible uri="https://cdn/a.jpg" onClose={jest.fn()} />);
    expect(transform().scale).toBe(1);
  });

  it('runs the zoom on the native driver on the phone, so it does not depend on the JavaScript thread', () => {
    (Platform as any).OS = 'android';
    const timing = jest.spyOn(Animated, 'timing');
    open();
    // al abrirse pasa los tres valores al driver nativo...
    expect(timing).toHaveBeenCalledTimes(3);
    expect(timing.mock.calls.every(([, config]) => config.useNativeDriver === true && config.duration === 0)).toBe(true);
    // ...y al soltar los dedos vuelve al tamaño original también con el driver nativo
    timing.mockClear();
    pinch(100, 300);
    fireEvent(surface(), 'touchEnd', event());
    expect(timing).toHaveBeenCalledTimes(3);
    expect(timing.mock.calls.every(([, config]) => config.useNativeDriver === true)).toBe(true);
  });

  it('does not ask for the native driver on the web', () => {
    const timing = jest.spyOn(Animated, 'timing');
    open();
    expect(timing).not.toHaveBeenCalled();
  });

  it('pinches the way the phone reports it: first one finger, then a second one lands', () => {
    open();
    fireEvent(surface(), 'touchStart', event(touch(150, 400)));
    fireEvent(surface(), 'touchStart', event(touch(150, 400), touch(250, 400)));
    fireEvent(surface(), 'touchMove', event(touch(100, 400), touch(300, 400)));
    expect(transform().scale).toBe(2);
  });

  it('keeps the zoom while a finger is still pressed after lifting the other, and goes back with the last one', () => {
    open();
    pinch(100, 200);
    fireEvent(surface(), 'touchEnd', event(touch(300, 400)));
    expect(transform().scale).toBe(2);
    fireEvent(surface(), 'touchEnd', event());
    act(() => { jest.advanceTimersByTime(500); });
    expect(transform()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('does not use the responder system, which dropped the gesture when the second finger landed', () => {
    open();
    expect(surface().props.onStartShouldSetResponder).toBeUndefined();
    expect(surface().props.onResponderGrant).toBeUndefined();
  });

  it('handles a pinch that starts with both fingers on the same point', () => {
    open();
    fireEvent(surface(), 'touchStart', event(touch(100), touch(100)));
    fireEvent(surface(), 'touchMove', event(touch(100), touch(180)));
    expect(transform().scale).toBe(1);
  });
});

describe('ProductImage', () => {
  it('shows the app icon without opening anything when the product has no image', () => {
    render(<ProductImage uri={null} />);
    expect(screen.queryByTestId('product-image-button')).toBeNull();
  });

  it('opens the image full screen when tapped and closes it again', () => {
    render(<ProductImage uri="https://cdn/a.jpg" />);
    expect(screen.queryByTestId('zoom-image')).toBeNull();
    fireEvent.press(screen.getByTestId('product-image-button'));
    expect(screen.getByTestId('zoom-image').props.source).toEqual({ uri: 'https://cdn/a.jpg' });
    fireEvent.press(screen.getByTestId('image-viewer-close'));
    act(() => {});
    expect(screen.queryByTestId('zoom-image')).toBeNull();
  });
});
