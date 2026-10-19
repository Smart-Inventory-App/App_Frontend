import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import RecentChangeRow, { changeFontSize, deltaFontSize, formatChangeDelta } from '../src/components/RecentChangeRow';
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

  it('writes big numbers smaller and smaller so they fit in their place', () => {
    expect(changeFontSize('78', '82')).toBe(20);
    expect(changeFontSize('1.255', '9')).toBe(20);
    expect(changeFontSize('1.255', '12')).toBe(17);
    expect(changeFontSize('3.125', '4.000')).toBe(14);
    expect(changeFontSize('3.125', '2.144.085')).toBe(12);
    expect(changeFontSize('12.345.678', '2.144.085')).toBe(10);
    const sizes = ['1', '1.255', '12.345', '3.125 ', '12.345.678'].map(v => changeFontSize(v, '2.144.085'));
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
  });

  it('writes both numbers of the change at the same size, small when they are big', () => {
    render(<RecentChangeRow change={change({ stock_before: 3125, stock_after: 2144085 })} onPress={jest.fn()} />);
    const before = StyleSheet.flatten(screen.getByTestId('change-before-event-9').props.style);
    const after = StyleSheet.flatten(screen.getByTestId('change-after-event-9').props.style);
    expect(screen.getByTestId('change-before-event-9').props.children).toBe('3.125');
    expect(screen.getByTestId('change-after-event-9').props.children).toBe('2.144.085');
    expect(before.fontSize).toBe(12);
    expect(after.fontSize).toBe(12);
    expect(screen.getByTestId('change-after-event-9').props.numberOfLines).toBe(1);
    expect(screen.getByTestId('change-after-event-9').props.adjustsFontSizeToFit).toBe(true);
  });

  it('keeps the numbers in a fixed place on the right, beside the data of the product', () => {
    render(<RecentChangeRow change={change({ stock_before: 3125, stock_after: 2144085, kind: 'modificacion' })} onPress={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId('change-stock-event-9').props.style).width).toBe(116);
    expect(StyleSheet.flatten(screen.getByTestId('change-info-event-9').props.style).minWidth).toBe(0);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Leche')).toBeLessThan(tree.indexOf('change-stock-event-9'));
    // la imagen, los datos y el stock van en un mismo renglón, como antes
    expect(tree.indexOf('product-image-button')).toBeLessThan(tree.indexOf('change-info-event-9'));
    expect(tree.indexOf('change-info-event-9')).toBeLessThan(tree.indexOf('change-stock-event-9'));
  });

  it('writes the reason in a single line, at its normal size, whichever the kind of change', () => {
    (['entrada', 'salida', 'modificacion'] as const).forEach(kind => {
      const label = { entrada: 'Entrada de producto', salida: 'Salida de producto', modificacion: 'Modificación del producto' }[kind];
      const { unmount } = render(<RecentChangeRow change={change({ kind, stock_before: 3125, stock_after: 2144085 })} onPress={jest.fn()} />);
      const text = screen.getByText(label);
      expect(text.props.numberOfLines).toBe(1);
      expect(text.props.adjustsFontSizeToFit).toBeUndefined();
      const style = StyleSheet.flatten(text.props.style);
      expect(style.fontSize).toBe(11);
      expect(style.flexShrink).toBeUndefined();
      unmount();
    });
  });

  it('puts the reason on top of the entry, above the image, the data and the numbers', () => {
    render(<RecentChangeRow change={change({ kind: 'modificacion', stock_before: 3125, stock_after: 2144085 })} onPress={jest.fn()} />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('change-kind-event-9')).toBeLessThan(tree.indexOf('product-image-button'));
    expect(tree.indexOf('change-kind-event-9')).toBeLessThan(tree.indexOf('Leche'));
    expect(tree.indexOf('change-kind-event-9')).toBeLessThan(tree.indexOf('change-stock-event-9'));
    expect(tree.indexOf('change-kind-event-9')).toBeLessThan(tree.indexOf('change-date-event-9'));
  });

  it('keeps the date below the data of the product, as it was', () => {
    render(<RecentChangeRow change={change()} onPress={jest.fn()} />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Categoría: Lacteos')).toBeLessThan(tree.indexOf('change-date-event-9'));
    expect(tree.indexOf('change-date-event-9')).toBeLessThan(tree.indexOf('change-stock-event-9'));
  });

  it('gives the reason its own row, so nothing competes with it for room', () => {
    render(<RecentChangeRow change={change({ kind: 'modificacion', stock_before: 3125, stock_after: 2144085 })} onPress={jest.fn()} />);
    const badge = StyleSheet.flatten(screen.getByTestId('change-kind-event-9').props.style);
    expect(badge.flexShrink).toBeUndefined();
    expect(screen.getByText('Modificación del producto').props.numberOfLines).toBe(1);
  });

  it('opens the product information when the stock part is tapped, as well as the rest of the entry', () => {
    const onPress = jest.fn();
    const item = change();
    render(<RecentChangeRow change={item} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('change-stock-event-9'));
    fireEvent.press(screen.getByTestId('change-after-event-9'));
    fireEvent.press(screen.getByTestId('change-delta-event-9'));
    fireEvent.press(screen.getByTestId('change-kind-event-9'));
    fireEvent.press(screen.getByTestId('change-date-event-9'));
    expect(onPress).toHaveBeenCalledTimes(5);
    expect(onPress).toHaveBeenLastCalledWith(item.producto);
  });

  it('keeps the image apart: it opens full screen and not the information', () => {
    const onPress = jest.fn();
    render(<RecentChangeRow change={change()} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('product-image-button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows how much the stock went up below the numbers, with a plus sign and the same dots', () => {
    render(<RecentChangeRow change={change({ stock_before: 3125, stock_after: 2144085 })} onPress={jest.fn()} />);
    expect(screen.getByTestId('change-delta-event-9').props.children).toBe('+ 2.140.960');
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('change-after-event-9')).toBeLessThan(tree.indexOf('change-delta-event-9'));
  });

  it('shows how much the stock went down, with a minus sign', () => {
    render(<RecentChangeRow change={change({ kind: 'salida', stock_before: 2144085, stock_after: 3125 })} onPress={jest.fn()} />);
    expect(screen.getByTestId('change-delta-event-9').props.children).toBe('- 2.140.960');
  });

  it('colors the difference green when it goes up and red when it goes down', () => {
    const colorOf = (before: number, after: number) => {
      const { unmount } = render(<RecentChangeRow change={change({ stock_before: before, stock_after: after })} onPress={jest.fn()} />);
      const color = StyleSheet.flatten(screen.getByTestId('change-delta-event-9').props.style).color;
      unmount();
      return color;
    };
    const up = colorOf(1, 5);
    const down = colorOf(5, 1);
    const same = colorOf(5, 5);
    expect(new Set([up, down, same]).size).toBe(3);
  });

  it('shows plain numbers in the difference when the change is small', () => {
    render(<RecentChangeRow change={change({ stock_before: 78, stock_after: 82 })} onPress={jest.fn()} />);
    expect(screen.getByTestId('change-delta-event-9').props.children).toBe('+ 4');
  });

  it('formats the difference like the numbers of the change', () => {
    expect(formatChangeDelta(0, 8)).toBe('+ 8');
    expect(formatChangeDelta(8, 0)).toBe('- 8');
    expect(formatChangeDelta(1255, 3141912)).toBe('+ 3.140.657');
    expect(formatChangeDelta(3141912, 1255)).toBe('- 3.140.657');
    expect(formatChangeDelta(7, 7)).toBe('0');
  });

  it('writes a long difference smaller, and keeps it in one line that can still shrink', () => {
    expect(deltaFontSize('+ 4')).toBe(13);
    expect(deltaFontSize('+ 4.000')).toBe(12);
    expect(deltaFontSize('+ 2.140.960')).toBe(11);
    render(<RecentChangeRow change={change({ stock_before: 3125, stock_after: 2144085 })} onPress={jest.fn()} />);
    const delta = screen.getByTestId('change-delta-event-9');
    expect(StyleSheet.flatten(delta.props.style).fontSize).toBe(11);
    expect(delta.props.numberOfLines).toBe(1);
    expect(delta.props.adjustsFontSizeToFit).toBe(true);
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
