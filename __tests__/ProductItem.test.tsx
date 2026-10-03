import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ProductItem from '../src/components/ProductItem';
import { Image } from 'react-native';

describe('ProductItem', () => {
  it('renders name, expiry and stock', () => {
    render(<ProductItem name="Leche" expiry="2026-01-01" stock="3" />);
    expect(screen.getByText('Leche')).toBeTruthy();
    expect(screen.getByText('Vence: 2026-01-01')).toBeTruthy();
    expect(screen.getByText('Stock: 3')).toBeTruthy();
  });

  it('shows OK by default when no status is given', () => {
    render(<ProductItem name="Leche" expiry="-" stock="3" />);
    expect(screen.getByText('OK')).toBeTruthy();
  });

  it('renders a custom status label', () => {
    render(<ProductItem name="Leche" expiry="-" stock="3" status="Bajo" statusColor="red" />);
    expect(screen.getByText('Bajo')).toBeTruthy();
  });

  it('renders with the yellow status color', () => {
    render(<ProductItem name="Leche" expiry="-" stock="3" status="Por vencer" statusColor="yellow" />);
    expect(screen.getByText('Por vencer')).toBeTruthy();
  });

  it('falls back to the green style for an unknown color', () => {
    render(<ProductItem name="Leche" expiry="-" stock="3" status="Info" statusColor={'purple' as any} />);
    expect(screen.getByText('Info')).toBeTruthy();
  });

  it('renders a remote image when imageUrl is provided', () => {
    const { UNSAFE_getByType } = render(<ProductItem name="Leche" expiry="-" stock="3" imageUrl="https://x/y.png" />);
    const image = UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({ uri: 'https://x/y.png' });
  });
});
