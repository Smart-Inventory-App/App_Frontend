import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import AlertDetailModal from '../src/components/AlertDetailModal';
import { Alert } from '../src/services/alertService';
import { ALERT_TONES, getAlertLines, getAlertType } from '../src/utils/alertInfo';

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const alert = (overrides: Partial<Alert> = {}): Alert => ({
  id: 1,
  userId: 'u1',
  productId: 1,
  type: 'stock_low_coverage',
  level: 'critical',
  product_name: 'Leche',
  product_category: 'Lacteos',
  product_brand: 'Sancor',
  product_stock: 2,
  days_until_stockout: 3,
  ...overrides,
});

describe('AlertDetailModal', () => {
  it('shows nothing without an alert', () => {
    render(<AlertDetailModal alert={null} onClose={jest.fn()} />);
    expect(screen.queryByTestId('alert-detail-card')).toBeNull();
  });

  it('shows the name, category, brand and stock of the product', () => {
    render(<AlertDetailModal alert={alert()} onClose={jest.fn()} />);
    expect(screen.getByTestId('alert-detail-nombre').props.children).toBe('Leche');
    expect(screen.getByTestId('alert-detail-categoria').props.children).toBe('Lacteos');
    expect(screen.getByTestId('alert-detail-marca').props.children).toBe('Sancor');
    expect(screen.getByTestId('alert-detail-stock').props.children).toBe('2');
  });

  it('shows a dash for the data the product does not have, and keeps a stock of zero', () => {
    render(<AlertDetailModal alert={alert({ product_brand: undefined, product_stock: 0 })} onClose={jest.fn()} />);
    expect(screen.getByTestId('alert-detail-marca').props.children).toBe('—');
    expect(screen.getByTestId('alert-detail-stock').props.children).toBe('0');
  });

  it('orders them: image, name, category, the reason of the alert, brand and stock', () => {
    render(<AlertDetailModal alert={alert()} onClose={jest.fn()} />);
    const tree = JSON.stringify(screen.toJSON());
    const at = (id: string) => tree.indexOf(id);
    expect(at('alert-detail-nombre')).toBeLessThan(at('alert-detail-categoria"'));
    expect(at('alert-detail-categoria"')).toBeLessThan(at('alert-detail-reason"'));
    expect(at('alert-detail-reason"')).toBeLessThan(at('alert-detail-marca"'));
    expect(at('alert-detail-marca"')).toBeLessThan(at('alert-detail-stock"'));
  });

  it('describes a low stock alert in the color of its level', () => {
    render(<AlertDetailModal alert={alert()} onClose={jest.fn()} />);
    expect(screen.getByTestId('alert-detail-reason-title').props.children).toBe('Se agota en 3 días');
    expect(screen.getByText('Stock restante: 2 ud.')).toBeTruthy();
    const box = StyleSheet.flatten(screen.getByTestId('alert-detail-reason').props.style);
    expect(box.backgroundColor).toBe(ALERT_TONES.critical.background);
    expect(StyleSheet.flatten(screen.getByTestId('alert-detail-reason-title').props.style).color).toBe(ALERT_TONES.critical.text);
  });

  it('describes an expiry alert with how many days are left', () => {
    render(<AlertDetailModal alert={alert({ type: 'expiry', level: 'warning', product_expiry: inDays(5) })} onClose={jest.fn()} />);
    expect(screen.getByTestId('alert-detail-reason-title').props.children).toBe('Vence en 5 días');
    expect(screen.getByText('Stock restante: 2 ud.')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('alert-detail-reason').props.style).backgroundColor).toBe(ALERT_TONES.warning.background);
  });

  it('describes a slow pace alert with the units in conflict', () => {
    render(<AlertDetailModal alert={alert({ type: 'slow_pace', level: 'info', units_wasted: 4, product_expiry: inDays(10) })} onClose={jest.fn()} />);
    expect(screen.queryByText(/Stock en conflicto/)).toBeNull();
    expect(screen.getByText('Al ritmo actual, 4 unidades se vencerán en 10 días')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('alert-detail-reason').props.style).backgroundColor).toBe(ALERT_TONES.info.background);
  });

  it('closes with the X button and when tapping outside the card, but not when tapping the card', () => {
    const onClose = jest.fn();
    render(<AlertDetailModal alert={alert()} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('alert-detail-card'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('alert-detail-close'));
    fireEvent.press(screen.getByTestId('alert-detail-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('AlertDetailModal - title and expiry date', () => {
  it('is called "Detalle de Alerta"', () => {
    render(<AlertDetailModal alert={alert()} onClose={jest.fn()} />);
    expect(screen.getByText('Detalle de Alerta')).toBeTruthy();
  });

  it('shows the expiry date of the product, below the stock, when it has one', () => {
    render(<AlertDetailModal alert={alert({ type: 'expiry', level: 'warning', product_expiry: '2027-03-05' })} onClose={jest.fn()} />);
    expect(screen.getByTestId('alert-detail-vencimiento').props.children).toBe('05/03/2027');
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('alert-detail-stock"')).toBeLessThan(tree.indexOf('alert-detail-vencimiento"'));
  });

  it('shows the date even when it comes with a time', () => {
    render(<AlertDetailModal alert={alert({ product_expiry: '2027-03-05T00:00:00Z' })} onClose={jest.fn()} />);
    expect(screen.getByTestId('alert-detail-vencimiento').props.children).toBe('05/03/2027');
  });

  it('shows no expiry row when the product has no expiry date', () => {
    render(<AlertDetailModal alert={alert({ product_expiry: undefined })} onClose={jest.fn()} />);
    expect(screen.queryByTestId('alert-detail-vencimiento')).toBeNull();
    expect(screen.queryByText('Vencimiento')).toBeNull();
  });
});

describe('alertInfo', () => {
  it('titles the expiry alerts by how close they are', () => {
    const expiry = (days: number) => alert({ type: 'expiry', product_expiry: inDays(days) });
    expect(getAlertType(expiry(1))).toBe('Vence mañana');
    expect(getAlertType(expiry(-2))).toBe('Venció hace 2 días');
    expect(getAlertType(alert({ type: 'info' }))).toBe('Información');
  });

  it('has no extra lines for an alert of type info', () => {
    expect(getAlertLines(alert({ type: 'info' }))).toEqual([]);
  });
});
