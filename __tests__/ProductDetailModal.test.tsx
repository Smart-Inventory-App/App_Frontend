import React from 'react';
import { Modal } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ProductDetailModal from '../src/components/ProductDetailModal';
import { Product } from '../src/types/product';

const FULL: Product = {
  id: 1,
  user_id: 'u1',
  nombre: 'Leche entera',
  marca: 'La Serenísima',
  categoria: 'Lácteos',
  ubicacion: 'Heladera',
  stock: 12,
  vencimiento: '2027-03-05',
  codigo_barras: '7791234567898',
  descripcion: 'Entera, larga vida',
  imagen_url: 'https://cdn/leche.jpg',
  stock_minimo: 4,
  dias_alerta_vencimiento: 6,
  created_at: '2026-10-01T15:30:00Z',
};

const text = (id: string) => screen.getByTestId(id).props.children;

describe('ProductDetailModal', () => {
  it('shows nothing without a product', () => {
    render(<ProductDetailModal product={null} onClose={jest.fn()} />);
    expect(screen.queryByTestId('product-detail-card')).toBeNull();
  });

  it('shows all the data of the product, as it was loaded', () => {
    render(<ProductDetailModal product={FULL} onClose={jest.fn()} />);
    expect(screen.getByText('Información del Producto')).toBeTruthy();
    expect(text('detail-nombre')).toBe('Leche entera');
    expect(text('detail-marca')).toEqual('La Serenísima');
    expect(text('detail-categoria')).toEqual('Lácteos');
    expect(text('detail-ubicacion')).toEqual('Heladera');
    expect(text('detail-stock')).toEqual('12');
    expect(text('detail-vencimiento')).toEqual('05/03/2027');
    expect(text('detail-codigo-barras')).toEqual('7791234567898');
    expect(text('detail-descripcion')).toEqual('Entera, larga vida');
    expect(text('detail-stock-minimo')).toEqual('4 unidades');
    expect(text('detail-dias-alerta')).toEqual('6 días');
    expect(text('detail-created-at')).toEqual('12:30:00 01/10/2026');
  });

  it('shows the product image, which can be opened full screen', () => {
    render(<ProductDetailModal product={FULL} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('product-image-button'));
    expect(screen.getByTestId('zoom-image').props.source).toEqual({ uri: 'https://cdn/leche.jpg' });
  });

  it('marks what the product does not have, and says it uses the general alert rules when they are unknown', () => {
    render(
      <ProductDetailModal
        product={{ id: 2, user_id: 'u1', nombre: 'Agua', categoria: 'Bebidas', stock: 3 }}
        onClose={jest.fn()}
      />,
    );
    expect(text('detail-marca')).toEqual('—');
    expect(text('detail-ubicacion')).toEqual('—');
    expect(text('detail-codigo-barras')).toEqual('—');
    expect(screen.queryByTestId('detail-descripcion')).toBeNull();
    expect(text('detail-vencimiento')).toEqual('Sin vencimiento');
    expect(text('detail-stock-minimo')).toEqual('Usando tu regla general');
    expect(text('detail-dias-alerta')).toEqual('Usando tu regla general');
    expect(screen.queryByTestId('detail-created-at')).toBeNull();
    expect(screen.queryByTestId('product-image-button')).toBeNull();
  });

  it('only shows information: nothing can be edited', () => {
    render(<ProductDetailModal product={FULL} onClose={jest.fn()} />);
    const { TextInput } = require('react-native');
    expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    expect(screen.queryByText('Guardar')).toBeNull();
    expect(screen.queryByText('Editar')).toBeNull();
  });

  it('shows the zero stock of a product that ran out', () => {
    render(<ProductDetailModal product={{ ...FULL, stock: 0, stock_minimo: 0, dias_alerta_vencimiento: 0 }} onClose={jest.fn()} />);
    expect(text('detail-stock')).toEqual('0');
    expect(text('detail-stock-minimo')).toEqual('0 unidades');
    expect(text('detail-dias-alerta')).toEqual('0 días');
    expect(screen.queryByTestId('detail-stock-minimo-note')).toBeNull();
  });

  it('is a centered window that covers the whole screen, with a scrollable body', () => {
    const { StyleSheet } = require('react-native');
    const { UNSAFE_getByType } = render(<ProductDetailModal product={FULL} onClose={jest.fn()} />);
    const modal = UNSAFE_getByType(Modal);
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.statusBarTranslucent).toBe(true);
    expect(modal.props.navigationBarTranslucent).toBe(true);
    expect(StyleSheet.flatten(screen.getByTestId('product-detail-backdrop').props.style)).toMatchObject({
      justifyContent: 'center',
      alignItems: 'center',
    });
    expect(StyleSheet.flatten(screen.getByTestId('product-detail-card').props.style).maxHeight).toBe('85%');
    expect(screen.getByTestId('product-detail-scroll')).toBeTruthy();
  });

  it('closes with the close button, by tapping outside or with the back button, but not by tapping the card', () => {
    const onClose = jest.fn();
    const { UNSAFE_getByType } = render(<ProductDetailModal product={FULL} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('product-detail-card'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('product-detail-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('product-detail-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
    UNSAFE_getByType(Modal).props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('ProductDetailModal - details', () => {
  const BARE: Product = { id: 3, user_id: 'u1', nombre: 'Agua', categoria: 'Bebidas', stock: 3 };

  it('has no scroll bar on the right', () => {
    render(<ProductDetailModal product={FULL} onClose={jest.fn()} />);
    expect(screen.getByTestId('product-detail-scroll').props.showsVerticalScrollIndicator).toBe(false);
  });

  it('shows the category above the brand, and the brand above the stock', () => {
    render(<ProductDetailModal product={FULL} onClose={jest.fn()} />);
    const tree = JSON.stringify(screen.toJSON());
    const at = (id: string) => tree.indexOf(`"${id}"`);
    expect(at('detail-nombre')).toBeLessThan(at('detail-categoria'));
    expect(at('detail-categoria')).toBeLessThan(at('detail-marca'));
    expect(at('detail-marca')).toBeLessThan(at('detail-stock'));
  });

  it('shows the stock above the description, and the description above the location', () => {
    render(<ProductDetailModal product={FULL} onClose={jest.fn()} />);
    const tree = JSON.stringify(screen.toJSON());
    const at = (id: string) => tree.indexOf(`"${id}"`);
    expect(at('detail-categoria')).toBeLessThan(at('detail-stock'));
    expect(at('detail-stock')).toBeLessThan(at('detail-descripcion'));
    expect(at('detail-descripcion')).toBeLessThan(at('detail-ubicacion'));
  });

  it('without a description, the stock goes right above the location', () => {
    render(<ProductDetailModal product={BARE} onClose={jest.fn()} />);
    const tree = JSON.stringify(screen.toJSON());
    const at = (id: string) => tree.indexOf(`"${id}"`);
    expect(at('detail-categoria')).toBeLessThan(at('detail-stock'));
    expect(at('detail-stock')).toBeLessThan(at('detail-ubicacion'));
  });

  it('highlights the category and the stock, titles and values, with the main color of the app', () => {
    const { StyleSheet } = require('react-native');
    const { Colors } = require('../src/constants/colors');
    render(<ProductDetailModal product={FULL} onClose={jest.fn()} />);
    const color = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).color;
    ['detail-categoria', 'detail-categoria-label', 'detail-stock', 'detail-stock-label'].forEach(id => {
      expect(color(id)).toBe(Colors.primary);
    });
  });

  it('keeps the other fields in the usual colors', () => {
    const { StyleSheet } = require('react-native');
    const { Colors } = require('../src/constants/colors');
    render(<ProductDetailModal product={FULL} onClose={jest.fn()} />);
    const color = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).color;
    ['detail-marca', 'detail-ubicacion', 'detail-descripcion', 'detail-vencimiento'].forEach(id => {
      expect(color(id)).not.toBe(Colors.primary);
    });
    ['detail-marca-label', 'detail-ubicacion-label'].forEach(id => {
      expect(color(id)).not.toBe(Colors.primary);
    });
  });

  it('does not highlight the brand, not even its dash when it is missing', () => {
    const { StyleSheet } = require('react-native');
    const { Colors } = require('../src/constants/colors');
    render(<ProductDetailModal product={BARE} onClose={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId('detail-marca-label').props.style).color).not.toBe(Colors.primary);
    expect(StyleSheet.flatten(screen.getByTestId('detail-marca').props.style).color).toBe(Colors.placeholder);
  });

  it('does not show the description at all when the product has none, or it is only spaces', () => {
    const { rerender } = render(<ProductDetailModal product={BARE} onClose={jest.fn()} />);
    expect(screen.queryByTestId('detail-descripcion')).toBeNull();
    expect(screen.queryByText('Descripción')).toBeNull();
    rerender(<ProductDetailModal product={{ ...BARE, descripcion: '   ' }} onClose={jest.fn()} />);
    expect(screen.queryByTestId('detail-descripcion')).toBeNull();
  });

  it('shows the general rules in use, with a smaller note below saying so', () => {
    render(<ProductDetailModal product={BARE} generalRules={{ coverageDays: 7, expiryDays: 10 }} onClose={jest.fn()} />);
    expect(text('detail-stock-minimo')).toEqual('7 unidades');
    expect(text('detail-stock-minimo-note')).toEqual('Usando tu regla general');
    expect(text('detail-dias-alerta')).toEqual('10 días');
    expect(text('detail-dias-alerta-note')).toEqual('Usando tu regla general');
    const { StyleSheet } = require('react-native');
    const note = StyleSheet.flatten(screen.getByTestId('detail-stock-minimo-note').props.style);
    const value = StyleSheet.flatten(screen.getByTestId('detail-stock-minimo').props.style);
    expect(note.fontSize).toBeLessThan(value.fontSize);
  });

  it('puts the note below the value, and only when the rule is the general one', () => {
    render(
      <ProductDetailModal
        product={{ ...BARE, stock_minimo: 2 }}
        generalRules={{ coverageDays: 7, expiryDays: 10 }}
        onClose={jest.fn()}
      />,
    );
    expect(text('detail-stock-minimo')).toEqual('2 unidades');
    expect(screen.queryByTestId('detail-stock-minimo-note')).toBeNull();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('detail-dias-alerta"')).toBeLessThan(tree.indexOf('detail-dias-alerta-note'));
  });

  it('uses the singular for one unit and one day', () => {
    render(
      <ProductDetailModal
        product={{ ...BARE, stock_minimo: 1 }}
        generalRules={{ coverageDays: 7, expiryDays: 1 }}
        onClose={jest.fn()}
      />,
    );
    expect(text('detail-stock-minimo')).toEqual('1 unidad');
    expect(text('detail-dias-alerta')).toEqual('1 día');
  });

  it('calls the load date "Fecha de carga"', () => {
    render(<ProductDetailModal product={FULL} onClose={jest.fn()} />);
    expect(screen.getByText('Fecha de carga')).toBeTruthy();
    expect(screen.queryByText('Cargado el')).toBeNull();
  });
});

describe('ProductDetailModal - "Stock total" button', () => {
  it('is not shown unless the screen can open the total stock', () => {
    render(<ProductDetailModal product={FULL} onClose={jest.fn()} />);
    expect(screen.queryByTestId('detail-total-button')).toBeNull();
  });

  it('is shown right below the product name when it can', () => {
    render(<ProductDetailModal product={FULL} onClose={jest.fn()} onShowTotal={jest.fn()} />);
    expect(screen.getByText('Stock total')).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('detail-nombre')).toBeLessThan(tree.indexOf('detail-total-button'));
    expect(tree.indexOf('detail-total-button')).toBeLessThan(tree.indexOf('"detail-categoria"'));
  });

  it('hands the product over when it is pressed', () => {
    const onShowTotal = jest.fn();
    render(<ProductDetailModal product={FULL} onClose={jest.fn()} onShowTotal={onShowTotal} />);
    fireEvent.press(screen.getByTestId('detail-total-button'));
    expect(onShowTotal).toHaveBeenCalledWith(FULL);
  });
});
