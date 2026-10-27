import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import DynamicAlert, { PREDICTIVE_COLOR } from '../src/components/DynamicAlert';
import { Alert } from '../src/services/alertService';
import { FlatList, Image, StyleSheet } from 'react-native';

const baseAlert = (overrides: Partial<Alert> = {}): Alert => ({
  id: 1,
  userId: 'u1',
  productId: 1,
  type: 'info',
  level: 'info',
  product_name: 'Leche',
  ...overrides,
});

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('DynamicAlert', () => {
  it('shows the product, what happens to it, the stock, the rule that applied and how much to restock', () => {
    render(<DynamicAlert alertsData={[baseAlert({
      type: 'stock_low_coverage',
      level: 'critical',
      product_stock: 2,
      days_until_stockout: 3,
      suggested_qty: 12,
      limit_days: 7,
      rule_scope: 'general',
    })]} />);
    expect(screen.getByText('Leche')).toBeTruthy();
    expect(screen.getByTestId('alert-kind-1').props.children).toBe('Se agota en 3 días');
    expect(screen.getByText('Stock restante: 2 ud. · Reponer 12 ud.')).toBeTruthy();
    expect(screen.getByText('Tu mínimo: 7 días · regla general')).toBeTruthy();
  });

  it('shows an expiry alert with how many days are left and the limit of the user', () => {
    render(<DynamicAlert alertsData={[baseAlert({
      type: 'expiry', level: 'warning', product_expiry: inDays(5), product_stock: 1, limit_days: 3, rule_scope: 'product',
    })]} />);
    expect(screen.getByTestId('alert-kind-1').props.children).toBe('Vence en 5 días');
    expect(screen.getByText('Tu límite: 3 días · regla de este producto')).toBeTruthy();
  });

  it.each([
    [1, 'Vence mañana'],
    [0, 'Vence hoy'],
    [-1, 'Venció ayer'],
    [-3, 'Venció hace 3 días'],
  ])('says it clearly when the expiry is %i days away', (days, text) => {
    render(<DynamicAlert alertsData={[baseAlert({ type: 'expiry', product_expiry: inDays(days), product_stock: 1 })]} />);
    expect(screen.getByTestId('alert-kind-1').props.children).toBe(text);
  });

  it('says a stockout today as "hoy", never as zero days', () => {
    render(<DynamicAlert alertsData={[baseAlert({ type: 'stock_low_coverage', level: 'critical', days_until_stockout: 0, product_stock: 1 })]} />);
    expect(screen.getByTestId('alert-kind-1').props.children).toBe('Se agota hoy');
    expect(screen.queryByText(/0 días/)).toBeNull();
  });

  it('renders the slow pace as a single line about the pace, with no redundant "stock en conflicto"', () => {
    render(<DynamicAlert alertsData={[baseAlert({ type: 'slow_pace', units_wasted: 4, product_expiry: inDays(3) })]} />);
    expect(screen.getByTestId('alert-kind-1').props.children).toBe('Riesgo de vencimiento');
    expect(screen.getByText('Al ritmo actual, 4 unidades se vencerán en 3 días')).toBeTruthy();
    expect(screen.queryByText(/Stock en conflicto/)).toBeNull();
  });

  it('renders a default/info alert without extra lines', () => {
    render(<DynamicAlert alertsData={[baseAlert({ type: 'info', level: 'info' })]} />);
    expect(screen.getByTestId('alert-kind-1').props.children).toBe('Información');
  });

  it('colors what happens to the product with the tone of its level', () => {
    render(<DynamicAlert alertsData={[baseAlert({ type: 'expiry', level: 'critical', product_expiry: inDays(1) })]} />);
    expect(StyleSheet.flatten(screen.getByTestId('alert-kind-1').props.style).color).toBe('#671a1c');
  });

  it('renders a placeholder image when no image_url is given', () => {
    const { UNSAFE_getAllByType } = render(<DynamicAlert alertsData={[baseAlert()]} />);
    expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
  });

  it('opens the product image full screen when it is tapped', () => {
    render(<DynamicAlert alertsData={[baseAlert({ image_url: 'https://x/leche.png' })]} />);
    fireEvent.press(screen.getByTestId('product-image-button'));
    expect(screen.getByTestId('zoom-image').props.source).toEqual({ uri: 'https://x/leche.png' });
  });

  it('renders an empty list without crashing', () => {
    render(<DynamicAlert alertsData={[]} />);
    expect(screen.queryByTestId('alert-item-1')).toBeNull();
  });

  it('calls onPressAlert with the alert that was tapped', () => {
    const onPressAlert = jest.fn();
    const alert = baseAlert({ id: 7 });
    render(<DynamicAlert alertsData={[alert]} onPressAlert={onPressAlert} />);
    fireEvent.press(screen.getByTestId('alert-item-7'));
    expect(onPressAlert).toHaveBeenCalledWith(alert);
  });

  it('does not break when an alert is tapped and there is no handler', () => {
    render(<DynamicAlert alertsData={[baseAlert({ id: 8 })]} />);
    fireEvent.press(screen.getByTestId('alert-item-8'));
  });

  it('paints the border of each alert with the color of its level', () => {
    render(<DynamicAlert alertsData={[
      baseAlert({ id: 1, level: 'critical' }), baseAlert({ id: 2, level: 'warning' }), baseAlert({ id: 3, level: 'info' }),
    ]} />);
    const color = (id: number) => StyleSheet.flatten(screen.getByTestId(`alert-item-${id}`).props.style).backgroundColor;
    expect(color(1)).toBe('#e5484d');
    expect(color(2)).toBe('#fbbc05');
    expect(color(3)).toBe('#4285f4');
  });

  it('keeps every row the same height so the list looks tidy', () => {
    render(<DynamicAlert alertsData={[baseAlert({ id: 1 }), baseAlert({ id: 2, type: 'stock_low_coverage', days_until_stockout: 2 })]} />);
    const height = (id: number) => StyleSheet.flatten(screen.getByTestId(`alert-row-${id}`).props.style).height;
    expect(height(1)).toBe(height(2));
  });

  it('keeps the name and the lines on one line each', () => {
    render(<DynamicAlert alertsData={[baseAlert({ type: 'stock_low_coverage', product_stock: 2, days_until_stockout: 3, limit_days: 7 })]} />);
    expect(screen.getByText('Leche').props.numberOfLines).toBe(1);
    expect(screen.getByText('Tu mínimo: 7 días · regla general').props.numberOfLines).toBe(1);
  });
});

describe('DynamicAlert - inside a screen that already scrolls', () => {
  it('is not a FlatList: a virtualized list inside a ScrollView of the same direction makes React Native log an error', () => {
    const { UNSAFE_queryByType } = render(<DynamicAlert alertsData={[baseAlert({ id: 1 }), baseAlert({ id: 2 })]} />);
    expect(UNSAFE_queryByType(FlatList)).toBeNull();
    expect(screen.getByTestId('alert-item-1')).toBeTruthy();
    expect(screen.getByTestId('alert-item-2')).toBeTruthy();
  });

  it('does not log the received data', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    render(<DynamicAlert alertsData={[baseAlert()]} />);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('keeps the order it receives', () => {
    render(<DynamicAlert alertsData={[baseAlert({ id: 7, product_name: 'B' }), baseAlert({ id: 3, product_name: 'A' })]} />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('alert-item-7')).toBeLessThan(tree.indexOf('alert-item-3'));
  });
});

describe('DynamicAlert - alerts of the predictive model', () => {
  it.each(['stock_low_coverage', 'slow_pace'] as const)('highlights the %s alerts with a "Predicción" badge and their own color', type => {
    render(<DynamicAlert alertsData={[baseAlert({ id: 1, type, level: 'warning', product_expiry: inDays(3), units_wasted: 2 })]} origin="rule" />);
    expect(screen.getByTestId('alert-predictive-1')).toBeTruthy();
    expect(screen.getByText('Predicción')).toBeTruthy();
    const row = StyleSheet.flatten(screen.getByTestId('alert-row-1').props.style);
    expect(row.borderColor).toBe(PREDICTIVE_COLOR);
    expect(row.borderWidth).toBeGreaterThan(0);
  });

  it('does not mark as predictive the alerts that are only a date', () => {
    render(<DynamicAlert alertsData={[baseAlert({ id: 1, type: 'expiry', product_expiry: inDays(3) })]} origin="rule" />);
    expect(screen.queryByTestId('alert-predictive-1')).toBeNull();
    expect(screen.queryByText('Predicción')).toBeNull();
  });
});

describe('DynamicAlert - alerts of the rules of the user', () => {
  it('outlines them in the color of the app, on a tinted background, unlike the ones of the system', () => {
    const { rerender } = render(<DynamicAlert alertsData={[baseAlert({ id: 1, type: 'expiry', product_expiry: inDays(2) })]} origin="rule" />);
    const rule = StyleSheet.flatten(screen.getByTestId('alert-row-1').props.style);
    expect(rule.borderColor).toBe('#2CC4B4');
    expect(rule.borderWidth).toBeGreaterThan(0);
    expect(rule.backgroundColor).not.toBe('#fff');

    rerender(<DynamicAlert alertsData={[baseAlert({ id: 1, type: 'expiry', product_expiry: inDays(2) })]} origin="system" />);
    const system = StyleSheet.flatten(screen.getByTestId('alert-row-1').props.style);
    expect(system.borderWidth).toBeUndefined();
    expect(system.backgroundColor).toBe('#fff');
  });

  it('are shown like the ones of the system by default', () => {
    render(<DynamicAlert alertsData={[baseAlert({ id: 1 })]} />);
    expect(StyleSheet.flatten(screen.getByTestId('alert-row-1').props.style).borderWidth).toBeUndefined();
  });
});
