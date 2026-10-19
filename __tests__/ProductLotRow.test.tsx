import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Ionicons } from '@expo/vector-icons';
import ProductLotRow from '../src/components/ProductLotRow';
import { Product } from '../src/types/product';

const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const lot = (overrides: Partial<Product> = {}): Product => ({
  id: 4,
  user_id: 'u1',
  nombre: 'Leche',
  marca: 'Ser',
  categoria: 'Lacteos',
  ubicacion: 'Heladera',
  stock: 6,
  vencimiento: inDays(30),
  imagen_url: 'https://cdn/leche.jpg',
  ...overrides,
});

const dot = () => StyleSheet.flatten(screen.getByTestId('lot-status-4').props.style).backgroundColor;

describe('ProductLotRow', () => {
  it('shows name, brand, category, location, stock and expiry', () => {
    const expiry = inDays(30);
    render(<ProductLotRow product={lot({ vencimiento: expiry })} onPress={jest.fn()} />);
    expect(screen.getByText('Leche')).toBeTruthy();
    expect(screen.getByText('Ser')).toBeTruthy();
    expect(screen.getByText('Categoría: Lacteos')).toBeTruthy();
    expect(screen.getByText(/Heladera/)).toBeTruthy();
    expect(screen.getByText('Stock: 6')).toBeTruthy();
    expect(screen.getByText(`Vence: ${expiry}`)).toBeTruthy();
  });

  it('leaves out what the product does not have', () => {
    render(<ProductLotRow product={lot({ marca: undefined, ubicacion: undefined, vencimiento: undefined })} onPress={jest.fn()} />);
    expect(screen.queryByText('Ser')).toBeNull();
    expect(screen.queryByText(/Heladera/)).toBeNull();
    expect(screen.queryByText(/Vence/)).toBeNull();
  });

  it('opens the image full screen from the picture, without opening the information', () => {
    const onPress = jest.fn();
    render(<ProductLotRow product={lot()} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('product-image-button'));
    expect(screen.getByTestId('zoom-image').props.source).toEqual({ uri: 'https://cdn/leche.jpg' });
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows the app icon, with nothing to open, when the product has no image', () => {
    render(<ProductLotRow product={lot({ imagen_url: undefined })} onPress={jest.fn()} />);
    expect(screen.queryByTestId('product-image-button')).toBeNull();
  });

  it('hands the product over when its information is tapped', () => {
    const onPress = jest.fn();
    const product = lot();
    render(<ProductLotRow product={product} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('lot-info-4'));
    expect(onPress).toHaveBeenCalledWith(product);
  });

  it('colors the status dot by how close the expiry is', () => {
    const { rerender } = render(<ProductLotRow product={lot({ vencimiento: inDays(30) })} onPress={jest.fn()} />);
    expect(dot()).toBe('#2db7a3');
    rerender(<ProductLotRow product={lot({ vencimiento: inDays(5) })} onPress={jest.fn()} />);
    expect(dot()).toBe('#fbbc05');
    rerender(<ProductLotRow product={lot({ vencimiento: inDays(1) })} onPress={jest.fn()} />);
    expect(dot()).toBe('#e5484d');
    rerender(<ProductLotRow product={lot({ vencimiento: undefined })} onPress={jest.fn()} />);
    expect(dot()).toBe('#2db7a3');
  });

  it('has no checkbox unless the screen asks for one', () => {
    render(<ProductLotRow product={lot()} onPress={jest.fn()} />);
    expect(screen.queryByTestId('lot-check-4')).toBeNull();
  });

  it('shows a checked or unchecked checkbox on the right, and reports the toggle', () => {
    const onToggle = jest.fn();
    const product = lot();
    const { rerender } = render(<ProductLotRow product={product} onPress={jest.fn()} selected onToggle={onToggle} />);
    const iconNames = () => screen.UNSAFE_getAllByType(Ionicons).map((n: any) => n.props.name);
    expect(iconNames()).toContain('checkbox');
    expect(iconNames()).not.toContain('square-outline');
    expect(screen.getByTestId('lot-check-4').props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByTestId('lot-check-4').props.accessibilityRole).toBe('checkbox');
    fireEvent.press(screen.getByTestId('lot-check-4'));
    expect(onToggle).toHaveBeenCalledWith(product);
    rerender(<ProductLotRow product={product} onPress={jest.fn()} selected={false} onToggle={onToggle} />);
    expect(iconNames()).toContain('square-outline');
    expect(iconNames()).not.toContain('checkbox');
    expect(screen.getByTestId('lot-check-4').props.accessibilityState).toEqual({ checked: false });
  });

  it('does not open the information when the checkbox is pressed', () => {
    const onPress = jest.fn();
    render(<ProductLotRow product={lot()} onPress={onPress} selected onToggle={jest.fn()} />);
    fireEvent.press(screen.getByTestId('lot-check-4'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not show the load date unless asked to', () => {
    render(<ProductLotRow product={lot({ created_at: '2026-10-05T15:30:00Z' })} onPress={jest.fn()} />);
    expect(screen.queryByTestId('lot-loaded-4')).toBeNull();
  });

  it('shows the load date in the top left corner of the row, highlighted, in Argentine time', () => {
    const { Colors } = require('../src/constants/colors');
    render(<ProductLotRow product={lot({ created_at: '2026-10-05T15:30:00Z' })} onPress={jest.fn()} showLoadDate />);
    expect(screen.getByText('Fecha de carga: 05/10/2026 12:30')).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('lot-loaded-4')).toBeLessThan(tree.indexOf('Leche'));
    expect(tree.indexOf('lot-loaded-4')).toBeLessThan(tree.indexOf('Stock: '));
    const pill = StyleSheet.flatten(screen.getByTestId('lot-loaded-4').props.style);
    expect(pill.borderRadius).toBeGreaterThan(0);
    const text = StyleSheet.flatten(screen.getByText('Fecha de carga: 05/10/2026 12:30').props.style);
    expect(text.color).toBe(Colors.primary);
  });

  it('keeps the load date in its own row, stuck to the top left like the reason of a change', () => {
    render(<ProductLotRow product={lot({ created_at: '2026-10-05T15:30:00Z' })} onPress={jest.fn()} showLoadDate />);
    const pill = StyleSheet.flatten(screen.getByTestId('lot-loaded-4').props.style);
    expect(pill.alignSelf).toBe('flex-start');
    expect(pill.marginBottom).toBeGreaterThan(0);
    expect(StyleSheet.flatten(screen.getByTestId('lot-row-4').props.style).flexDirection).toBeUndefined();
  });

  it('shows nothing when the product has no load date', () => {
    render(<ProductLotRow product={lot({ created_at: undefined })} onPress={jest.fn()} showLoadDate />);
    expect(screen.queryByTestId('lot-loaded-4')).toBeNull();
  });

  it('has the height it is given, so every row of a list is the same size', () => {
    render(<ProductLotRow product={lot()} onPress={jest.fn()} height={150} />);
    expect(StyleSheet.flatten(screen.getByTestId('lot-row-4').props.style).height).toBe(150);
  });

  it('adapts to its content when no height is given', () => {
    render(<ProductLotRow product={lot()} onPress={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId('lot-row-4').props.style).height).toBeUndefined();
  });

  it('cuts long texts in one line only when it has a fixed height', () => {
    const { rerender } = render(<ProductLotRow product={lot({ nombre: 'Nombre muy largo' })} onPress={jest.fn()} height={150} />);
    expect(screen.getByText('Nombre muy largo').props.numberOfLines).toBe(1);
    rerender(<ProductLotRow product={lot({ nombre: 'Nombre muy largo' })} onPress={jest.fn()} />);
    expect(screen.getByText('Nombre muy largo').props.numberOfLines).toBeUndefined();
  });
});
