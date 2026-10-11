import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import ScreenHeader, { SCREEN_HEADER_HEIGHT } from '../src/components/ScreenHeader';

describe('ScreenHeader', () => {
  it('shows the title in one line with the shared format', () => {
    render(<ScreenHeader title="Inventario" />);
    const title = screen.getByText('Inventario');
    expect(title.props.numberOfLines).toBe(1);
    const style = StyleSheet.flatten(title.props.style);
    expect(style.fontSize).toBe(22);
    expect(style.fontFamily).toBe('Roboto_500Medium');
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
