import React from 'react';
import { render, screen } from '@testing-library/react-native';
import DynamicAlert from '../src/components/DynamicAlert';
import { Alert } from '../src/services/alertService';
import { Image } from 'react-native';

const baseAlert = (overrides: Partial<Alert> = {}): Alert => ({
  id: 1,
  userId: 'u1',
  productId: 1,
  type: 'info',
  level: 'info',
  product_name: 'Leche',
  ...overrides,
});

describe('DynamicAlert', () => {
  it('renders a critical stock_low_coverage alert', () => {
    render(<DynamicAlert alertsData={[baseAlert({
      type: 'stock_low_coverage',
      level: 'critical',
      product_stock: 2,
      days_until_stockout: 3,
    })]} />);
    expect(screen.getByText('Leche - Stock crítico')).toBeTruthy();
    expect(screen.getByText('Stock Restante: 2 ud.')).toBeTruthy();
    expect(screen.getByText('El stock actual alcanza para 3 días')).toBeTruthy();
  });

  it('renders an expiry alert expiring in several days', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    render(<DynamicAlert alertsData={[baseAlert({
      type: 'expiry',
      level: 'warning',
      product_expiry: future,
      product_stock: 1,
    })]} />);
    expect(screen.getByText(/Vence en \d+ días/)).toBeTruthy();
  });

  it('renders an expiry alert expiring tomorrow', () => {
    const tomorrow = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();
    render(<DynamicAlert alertsData={[baseAlert({ type: 'expiry', product_expiry: tomorrow, product_stock: 1 })]} />);
    expect(screen.getByText('Leche - Vence mañana')).toBeTruthy();
  });

  it('renders an expiry alert that already expired', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    render(<DynamicAlert alertsData={[baseAlert({ type: 'expiry', product_expiry: past, product_stock: 1 })]} />);
    expect(screen.getByText('Leche - Vencido')).toBeTruthy();
  });

  it('renders a slow_pace alert', () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    render(<DynamicAlert alertsData={[baseAlert({
      type: 'slow_pace',
      units_wasted: 4,
      product_expiry: future,
    })]} />);
    expect(screen.getByText('Leche - Información')).toBeTruthy();
    expect(screen.getByText(/Stock en conflicto: 4 ud\./)).toBeTruthy();
  });

  it('renders a default/info alert without extra description', () => {
    render(<DynamicAlert alertsData={[baseAlert({ type: 'info', level: 'info' })]} />);
    expect(screen.getByText('Leche - Información')).toBeTruthy();
  });

  it('renders a placeholder image when no image_url is given', () => {
    const { UNSAFE_getAllByType } = render(<DynamicAlert alertsData={[baseAlert()]} />);
    expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
  });

  it('renders an empty list without crashing', () => {
    render(<DynamicAlert alertsData={[]} />);
  });
});
