import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ImageViewerModal from '../src/components/ImageViewerModal';
import ProductImage from '../src/components/ProductImage';

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
  fireEvent(surface(), 'responderGrant', event(touch(200 - from / 2, 400), touch(200 + from / 2, 400)));
  fireEvent(surface(), 'responderMove', event(touch(200 - to / 2, 400), touch(200 + to / 2, 400)));
};
const tap = () => {
  fireEvent(surface(), 'responderGrant', event(touch(50, 50)));
  fireEvent(surface(), 'responderRelease', event());
};

afterEach(() => {
  jest.restoreAllMocks();
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

  it('never zooms beyond the maximum or below the original size', () => {
    open();
    pinch(100, 1000);
    expect(transform().scale).toBe(5);
    fireEvent(surface(), 'responderRelease', event());
    pinch(100, 10);
    fireEvent(surface(), 'responderRelease', event());
    expect(transform()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('keeps going from the current zoom when a second pinch starts', () => {
    open();
    pinch(100, 200);
    fireEvent(surface(), 'responderRelease', event());
    pinch(100, 150);
    expect(transform().scale).toBe(3);
  });

  it('moves the image with one finger once it is zoomed, without leaving the screen', () => {
    open();
    pinch(100, 200);
    fireEvent(surface(), 'responderRelease', event());
    fireEvent(surface(), 'responderGrant', event(touch(200, 300)));
    fireEvent(surface(), 'responderMove', event(touch(250, 280)));
    expect(transform()).toMatchObject({ scale: 2, x: 50, y: -20 });
    fireEvent(surface(), 'responderMove', event(touch(900, 300)));
    expect(transform().x).toBe(200);
    expect(transform().y).toBe(0);
  });

  it('does not move the image with one finger when it is not zoomed', () => {
    open();
    fireEvent(surface(), 'responderGrant', event(touch(200, 300)));
    fireEvent(surface(), 'responderMove', event(touch(300, 400)));
    fireEvent(surface(), 'responderRelease', event());
    expect(transform()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('keeps the zoom if a finger is lifted in the middle of a pinch', () => {
    open();
    pinch(100, 200);
    fireEvent(surface(), 'responderMove', event(touch(100)));
    expect(transform().scale).toBe(2);
    fireEvent(surface(), 'responderMove', event(touch(130)));
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

  it('does not take away the zoom of a pinch when the fingers are lifted with a tap-like release', () => {
    open();
    pinch(100, 200);
    fireEvent(surface(), 'responderRelease', event());
    tap();
    tap();
    expect(transform().scale).toBe(2);
  });

  it('zooms in from the point between the fingers, which stays under them', () => {
    open();
    // Los dedos están a la derecha del centro: (300, 400) y (340, 400); se separan al doble sin moverse
    fireEvent(surface(), 'responderGrant', event(touch(300, 400), touch(340, 400)));
    fireEvent(surface(), 'responderMove', event(touch(280, 400), touch(360, 400)));
    expect(transform().scale).toBe(2);
    // El punto medio estaba 120 a la derecha del centro: para que siga bajo los dedos la imagen se corre 120 a la izquierda
    expect(transform().x).toBe(-120);
    expect(transform().y).toBe(0);
  });

  it('drags the image along with two fingers that move together', () => {
    open();
    pinch(100, 200);
    fireEvent(surface(), 'responderRelease', event());
    fireEvent(surface(), 'responderGrant', event(touch(150, 400), touch(250, 400)));
    fireEvent(surface(), 'responderMove', event(touch(180, 380), touch(280, 380)));
    expect(transform()).toMatchObject({ scale: 2, x: 30, y: -20 });
  });

  it('does not let two fingers drag the image out of the screen', () => {
    open();
    pinch(100, 200);
    fireEvent(surface(), 'responderRelease', event());
    fireEvent(surface(), 'responderGrant', event(touch(150, 400), touch(250, 400)));
    fireEvent(surface(), 'responderMove', event(touch(950, 400), touch(1050, 400)));
    expect(transform().x).toBe(200);
  });

  it('does not count a drag as anything but a drag', () => {
    open();
    tap();
    fireEvent(surface(), 'responderGrant', event(touch(50, 50)));
    fireEvent(surface(), 'responderMove', event(touch(150, 50)));
    fireEvent(surface(), 'responderRelease', event());
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

  it('handles a pinch that starts with both fingers on the same point', () => {
    open();
    fireEvent(surface(), 'responderGrant', event(touch(100), touch(100)));
    fireEvent(surface(), 'responderMove', event(touch(100), touch(180)));
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
