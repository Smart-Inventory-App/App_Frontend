import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import ScreenHeader, { SCREEN_HEADER_HEIGHT } from '../src/components/ScreenHeader';

describe('ScreenHeader', () => {
  it('shows the title in one line with the shared format', () => {
    render(<ScreenHeader title="Inventario" />);
    const title = screen.getByText('Inventario');
    expect(title.props.numberOfLines).toBe(1);
    const style = StyleSheet.flatten(title.props.style);
    expect(style.fontSize).toBe(22);
  });

  it('writes the title in black, with the same typeface as the name of the home, but less bold', () => {
    render(<ScreenHeader title="Inventario" />);
    const style = StyleSheet.flatten(screen.getByText('Inventario').props.style);
    expect(style.color).toBe(Colors.textPrimary);
    expect(style.fontFamily).toBeUndefined();
    expect(style.fontWeight).toBe('600');
    expect(Number(style.fontWeight)).toBeLessThan(800);
    expect(style.includeFontPadding).toBe(false);
  });

  it('puts content passed as "left" before the title, which then sits on the right', () => {
    render(<ScreenHeader title="Bienvenido" left={<Text>Smart Inventory</Text>} />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Smart Inventory')).toBeLessThan(tree.indexOf('Bienvenido'));
  });

  it('puts content passed as "right" after the title', () => {
    render(<ScreenHeader title="Flujo de producto" right={<Text>Entrada</Text>} />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Flujo de producto')).toBeLessThan(tree.indexOf('Entrada'));
  });

  it('always has the same fixed height, with or without extra content on the right', () => {
    const { rerender } = render(<ScreenHeader title="Inventario" />);
    const height = () => StyleSheet.flatten(screen.getByTestId('screen-header').props.style).height;
    expect(height()).toBe(SCREEN_HEADER_HEIGHT);
    rerender(<ScreenHeader title="Bienvenido, Gian Luca" right={<Text>Smart Inventory</Text>} />);
    expect(height()).toBe(SCREEN_HEADER_HEIGHT);
    expect(screen.getByText('Smart Inventory')).toBeTruthy();
  });
});

describe('ScreenHeader - keepTitleWhole', () => {
  it('stops the title from shrinking when asked to', () => {
    const { rerender } = render(<ScreenHeader title="Flujo de producto" />);
    expect(StyleSheet.flatten(screen.getByText('Flujo de producto').props.style).flexShrink).toBe(1);
    rerender(<ScreenHeader title="Flujo de producto" keepTitleWhole />);
    expect(StyleSheet.flatten(screen.getByText('Flujo de producto').props.style).flexShrink).toBe(0);
  });
});

describe('ScreenHeader - home button', () => {
  it('has no home button unless the screen asks for one', () => {
    render(<ScreenHeader title="Inventario" />);
    expect(screen.queryByTestId('header-home')).toBeNull();
  });

  it('shows a home icon, with no text, in the teal of the app', () => {
    render(<ScreenHeader title="Inventario" onHomePress={jest.fn()} />);
    const icon = screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'home') as any;
    expect(icon.props.color).toBe(Colors.primary);
    expect(screen.getByTestId('header-home').props.accessibilityLabel).toBe('Ir al inicio');
    expect(screen.queryByText('Inicio')).toBeNull();
  });

  it('puts the home icon on the left and the title on the right', () => {
    render(<ScreenHeader title="Inventario" onHomePress={jest.fn()} />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('header-home')).toBeLessThan(tree.indexOf('Inventario'));
    expect(StyleSheet.flatten(screen.getByTestId('screen-header').props.style).justifyContent).toBe('space-between');
  });

  it('calls the given function when the icon is pressed', () => {
    const onHomePress = jest.fn();
    render(<ScreenHeader title="Inventario" onHomePress={onHomePress} />);
    fireEvent.press(screen.getByTestId('header-home'));
    expect(onHomePress).toHaveBeenCalledTimes(1);
  });

  it('keeps what is passed as "left" (like a back arrow) instead of the home icon', () => {
    render(<ScreenHeader title="Stock total" left={<Text>Volver</Text>} onHomePress={jest.fn()} />);
    expect(screen.getByText('Volver')).toBeTruthy();
    expect(screen.queryByTestId('header-home')).toBeNull();
  });

  it('keeps the same fixed height with the home icon', () => {
    render(<ScreenHeader title="Inventario" onHomePress={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId('screen-header').props.style).height).toBe(SCREEN_HEADER_HEIGHT);
  });

  it('keeps the content on the right after the title', () => {
    render(<ScreenHeader title="Flujo de producto" onHomePress={jest.fn()} right={<Text>Entrada</Text>} />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('header-home')).toBeLessThan(tree.indexOf('Flujo de producto'));
    expect(tree.indexOf('Flujo de producto')).toBeLessThan(tree.indexOf('Entrada'));
  });
});
