import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import RecentChangeRow, { changeFontSize } from '../src/components/RecentChangeRow';
import { StockChange } from '../src/types/product';

const change = (overrides: Partial<StockChange> = {}): StockChange => ({
  id: 'event-9',
  kind: 'entrada',
  stock_before: 78,
  stock_after: 82,
  quantity: 4,
  occurred_at: '2026-10-10T12:00:00Z',
  producto: {
    id: 3, user_id: 'u1', nombre: 'Leche', marca: 'Ser', categoria: 'Lacteos', stock: 82, imagen_url: 'https://cdn/leche.jpg',
  },
  ...overrides,
});

describe('RecentChangeRow', () => {
  it('shows the name, brand and category of the product', () => {
    render(<RecentChangeRow change={change()} onPress={jest.fn()} />);
    expect(screen.getByText('Leche')).toBeTruthy();
    expect(screen.getByText('Ser')).toBeTruthy();
    expect(screen.getByText('Categoría: Lacteos')).toBeTruthy();
  });

  it('leaves out the brand when the product has none', () => {
    const base = change();
    render(<RecentChangeRow change={change({ producto: { ...base.producto, marca: undefined } })} onPress={jest.fn()} />);
    expect(screen.queryByText('Ser')).toBeNull();
  });

  it.each([
    ['entrada', 'Entrada de producto'],
    ['salida', 'Salida de producto'],
    ['modificacion', 'Modificación del producto'],
  ] as const)('labels a %s as "%s"', (kind, label) => {
    render(<RecentChangeRow change={change({ kind })} onPress={jest.fn()} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('colors each kind of change differently', () => {
    const colorOf = (kind: 'entrada' | 'salida' | 'modificacion') => {
      const { unmount } = render(<RecentChangeRow change={change({ kind })} onPress={jest.fn()} />);
      const color = StyleSheet.flatten(screen.getByTestId('change-after-event-9').props.style).color;
      unmount();
      return color;
    };
    const colors = [colorOf('entrada'), colorOf('salida'), colorOf('modificacion')];
    expect(new Set(colors).size).toBe(3);
  });

  it('highlights the reason with a badge in the color of the change', () => {
    render(<RecentChangeRow change={change({ kind: 'salida' })} onPress={jest.fn()} />);
    const badge = StyleSheet.flatten(screen.getByTestId('change-kind-event-9').props.style);
    expect(badge.borderRadius).toBeGreaterThan(0);
    expect(badge.backgroundColor).toBeTruthy();
  });

  it('shows how the stock changed, from the old to the new value', () => {
    render(<RecentChangeRow change={change({ stock_before: 78, stock_after: 82 })} onPress={jest.fn()} />);
    expect(screen.getByTestId('change-before-event-9').props.children).toBe('78');
    expect(screen.getByTestId('change-after-event-9').props.children).toBe('82');
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('change-before-event-9')).toBeLessThan(tree.indexOf('change-after-event-9'));
  });

  it('shows a change that starts from zero, and one that ends at zero', () => {
    const { rerender } = render(<RecentChangeRow change={change({ stock_before: 0, stock_after: 8 })} onPress={jest.fn()} />);
    expect(screen.getByTestId('change-before-event-9').props.children).toBe('0');
    expect(screen.getByTestId('change-after-event-9').props.children).toBe('8');
    rerender(<RecentChangeRow change={change({ stock_before: 8, stock_after: 0 })} onPress={jest.fn()} />);
    expect(screen.getByTestId('change-after-event-9').props.children).toBe('0');
  });

  it('opens the image full screen without opening the information', () => {
    const onPress = jest.fn();
    render(<RecentChangeRow change={change()} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('product-image-button'));
    expect(screen.getByTestId('zoom-image').props.source).toEqual({ uri: 'https://cdn/leche.jpg' });
    expect(onPress).not.toHaveBeenCalled();
  });

  it('hands the product over when its information is tapped', () => {
    const onPress = jest.fn();
    const item = change();
    render(<RecentChangeRow change={item} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('change-info-event-9'));
    expect(onPress).toHaveBeenCalledWith(item.producto);
  });

  it('shows the date and time of the change below the reason, in Argentine time', () => {
    render(<RecentChangeRow change={change({ occurred_at: '2026-10-10T20:43:23Z' })} onPress={jest.fn()} />);
    expect(screen.getByTestId('change-date-event-9').props.children).toBe('10/10/2026 17:43');
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('change-kind-event-9')).toBeLessThan(tree.indexOf('change-date-event-9'));
  });

  it('writes the numbers of the change with a dot every three digits', () => {
    render(<RecentChangeRow change={change({ stock_before: 1255, stock_after: 3141912 })} onPress={jest.fn()} />);
    expect(screen.getByTestId('change-before-event-9').props.children).toBe('1.255');
    expect(screen.getByTestId('change-after-event-9').props.children).toBe('3.141.912');
  });

  it('writes big numbers smaller so they fit in the row', () => {
    expect(changeFontSize('78', '82')).toBe(20);
    expect(changeFontSize('1.255', '3.141')).toBe(20);
    expect(changeFontSize('12.345', '9')).toBe(16);
    expect(changeFontSize('1.255', '3.141.912')).toBe(13);
    render(<RecentChangeRow change={change({ stock_before: 1255, stock_after: 3141912 })} onPress={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId('change-after-event-9').props.style).fontSize).toBe(13);
    expect(screen.getByTestId('change-after-event-9').props.numberOfLines).toBe(1);
  });

  it('has the height it is given, so every row of a list is the same size', () => {
    render(<RecentChangeRow change={change()} onPress={jest.fn()} height={124} />);
    expect(StyleSheet.flatten(screen.getByTestId('change-row-event-9').props.style).height).toBe(124);
    expect(screen.getByText('Leche').props.numberOfLines).toBe(1);
  });

  it('adapts to its content when no height is given', () => {
    render(<RecentChangeRow change={change()} onPress={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId('change-row-event-9').props.style).height).toBeUndefined();
  });
});
