import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import StatCard, { valueFontSize } from '../src/components/StatCard';

describe('StatCard', () => {
  it('renders title, value and label', () => {
    render(<StatCard title="Productos" value="12" label="En inventario" labelColor="green" />);
    expect(screen.getByText('Productos')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('En inventario')).toBeTruthy();
  });

  it('renders with a yellow label', () => {
    render(<StatCard title="Stock bajo" value="3" label="Próximos 7 días" labelColor="yellow" />);
    expect(screen.getByText('Próximos 7 días')).toBeTruthy();
  });

  it('renders with a red label', () => {
    render(<StatCard title="Por vencer" value="1" label="Próximos 3 días" labelColor="red" />);
    expect(screen.getByText('Próximos 3 días')).toBeTruthy();
  });

  it('falls back to the green style for an unrecognized color', () => {
    render(<StatCard title="X" value="1" label="Y" labelColor={'purple' as any} />);
    expect(screen.getByText('Y')).toBeTruthy();
  });

  it('is not touchable unless it has an action, and then shows no arrow', () => {
    render(<StatCard testID="card" title="Productos" value="12" label="En inventario" labelColor="green" />);
    expect(screen.getByTestId('card').props.onPress).toBeUndefined();
    expect(screen.UNSAFE_queryAllByType(require('@expo/vector-icons').Ionicons)).toHaveLength(0);
  });

  it('can be pressed when it has an action, showing an arrow', () => {
    const onPress = jest.fn();
    render(<StatCard testID="card" title="Productos" value="12" label="En inventario" labelColor="green" icon="cube" onPress={onPress} />);
    fireEvent.press(screen.getByTestId('card'));
    expect(onPress).toHaveBeenCalledTimes(1);
    const names = screen.UNSAFE_getAllByType(require('@expo/vector-icons').Ionicons).map((n: any) => n.props.name);
    expect(names).toEqual(['cube', 'chevron-forward']);
  });

  it('paints the number and the icon with its accent color', () => {
    render(<StatCard testID="card" title="Productos" value="12" label="x" labelColor="green" icon="cube" accent="#1B3A8F" />);
    expect(StyleSheet.flatten(screen.getByTestId('card-value').props.style).color).toBe('#1B3A8F');
    expect(StyleSheet.flatten(screen.getByTestId('card-icon').props.style).backgroundColor).toBe('#1B3A8F22');
  });

  it('uses the color of its label as the accent when none is given', () => {
    render(<StatCard testID="card" title="Stock bajo" value="3" label="x" labelColor="red" icon="trending-down" />);
    expect(StyleSheet.flatten(screen.getByTestId('card-value').props.style).color).toBe('#e5484d');
  });

  it('shows no icon circle when it has no icon', () => {
    render(<StatCard testID="card" title="Productos" value="12" label="x" labelColor="green" />);
    expect(screen.queryByTestId('card-icon')).toBeNull();
  });

  it('writes the number smaller the longer it is, so it fits in its square', () => {
    expect(valueFontSize('7')).toBe(30);
    expect(valueFontSize('1.255')).toBe(30);
    expect(valueFontSize('12.345')).toBe(25);
    expect(valueFontSize('123.456')).toBe(25);
    expect(valueFontSize('3.141.912')).toBe(21);
    expect(valueFontSize('1.234.567.890')).toBe(17);
    const sizes = ['1', '12.345', '3.141.912', '1.234.567.890'].map(valueFontSize);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
  });

  it('applies that size and keeps the number in one line that can still shrink', () => {
    render(<StatCard testID="card" title="Productos" value="3.141.912" label="x" labelColor="green" />);
    const value = screen.getByTestId('card-value');
    expect(StyleSheet.flatten(value.props.style).fontSize).toBe(21);
    expect(value.props.numberOfLines).toBe(1);
    expect(value.props.adjustsFontSizeToFit).toBe(true);
  });
});
