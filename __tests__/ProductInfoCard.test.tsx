import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ProductInfoCard from '../src/components/ProductInfoCard';

const product = { categoria: 'Lacteos', marca: 'Ser', stock: 4, vencimiento: '2027-03-05' };

describe('ProductInfoCard', () => {
  it('shows the category, brand, current stock and expiry date, in that order', () => {
    render(<ProductInfoCard product={product} testIDPrefix="p" />);
    const tree = JSON.stringify(screen.toJSON());
    const at = (id: string) => tree.indexOf(`"${id}"`);
    expect(at('p-categoria')).toBeLessThan(at('p-marca'));
    expect(at('p-marca')).toBeLessThan(at('p-stock'));
    expect(at('p-stock')).toBeLessThan(at('p-vencimiento'));
    expect(screen.getByTestId('p-vencimiento').props.children).toBe('05/03/2027');
  });

  it('leaves out the brand when there is none', () => {
    render(<ProductInfoCard product={{ ...product, marca: null }} testIDPrefix="p" />);
    expect(screen.queryByTestId('p-marca')).toBeNull();
  });

  it('leaves the expiry out, with no "Sin vencimiento" message, when the product does not expire', () => {
    render(<ProductInfoCard product={{ ...product, vencimiento: undefined }} testIDPrefix="p" />);
    expect(screen.queryByTestId('p-vencimiento')).toBeNull();
    expect(screen.queryByText('Sin vencimiento')).toBeNull();
    expect(screen.queryByText('Vencimiento')).toBeNull();
  });

  it('leaves the expiry out in the same way when it comes empty or null', () => {
    const { rerender } = render(<ProductInfoCard product={{ ...product, vencimiento: null }} testIDPrefix="p" />);
    expect(screen.queryByTestId('p-vencimiento')).toBeNull();
    rerender(<ProductInfoCard product={{ ...product, vencimiento: '' }} testIDPrefix="p" />);
    expect(screen.queryByTestId('p-vencimiento')).toBeNull();
  });

  it('keeps the other three data when the product does not expire', () => {
    render(<ProductInfoCard product={{ ...product, vencimiento: undefined }} testIDPrefix="p" />);
    ['p-categoria', 'p-marca', 'p-stock'].forEach(id => expect(screen.getByTestId(id)).toBeTruthy());
  });
});
