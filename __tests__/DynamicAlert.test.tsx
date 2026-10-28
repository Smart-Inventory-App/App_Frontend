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
  it('shows the product, what happens to it and a description with the numbers', () => {
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
    expect(screen.getByTestId('alert-description-1').props.children).toBe('Quedan 2 ud. restantes que alcanzan para 3 días. Mínimo configurado de 7 días.');
  });

  it('shows an expiry alert with the date, the stock and the limit of the user', () => {
    render(<DynamicAlert alertsData={[baseAlert({
      type: 'expiry', level: 'warning', product_expiry: inDays(5), product_stock: 1, limit_days: 3, rule_scope: 'product',
    })]} />);
    expect(screen.getByTestId('alert-kind-1').props.children).toBe('Vence en 5 días');
    expect(screen.getByTestId('alert-description-1').props.children).toMatch(/^Vence el .+\. Queda 1 ud\. y tu aviso es con menos de 3 días\.$/);
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

  it('describes the slow pace with the sentence about the pace', () => {
    render(<DynamicAlert alertsData={[baseAlert({ type: 'slow_pace', units_wasted: 4, product_expiry: inDays(45) })]} />);
    expect(screen.getByTestId('alert-kind-1').props.children).toBe('Riesgo de vencimiento');
    expect(screen.getByTestId('alert-description-1').props.children).toBe('Al ritmo actual, 4 unidades se vencerán en 45 días.');
    expect(screen.queryByText(/Stock en conflicto/)).toBeNull();
  });

  it('renders a default/info alert without a description', () => {
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

  it('keeps every row the same height, a bit taller than before, so the list looks tidy', () => {
    render(<DynamicAlert alertsData={[baseAlert({ id: 1 }), baseAlert({ id: 2, type: 'stock_low_coverage', days_until_stockout: 2 })]} />);
    const height = (id: number) => StyleSheet.flatten(screen.getByTestId(`alert-row-${id}`).props.style).height;
    expect(height(1)).toBe(height(2));
    expect(height(1)).toBeGreaterThan(104);
  });

  it('always uses two lines for the description, even when it is short', () => {
    render(<DynamicAlert alertsData={[baseAlert({ type: 'slow_pace', units_wasted: 2, product_expiry: inDays(45) })]} />);
    const description = screen.getByTestId('alert-description-1');
    expect(description.props.numberOfLines).toBe(2);
    const style = StyleSheet.flatten(description.props.style);
    expect(style.minHeight).toBe(style.lineHeight * 2);
    expect(screen.getByText('Leche').props.numberOfLines).toBe(1);
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
  it.each(['stock_low_coverage', 'slow_pace'] as const)('marks the %s alerts with a "Predicción" badge', type => {
    render(<DynamicAlert alertsData={[baseAlert({ id: 1, type, level: 'warning', product_expiry: inDays(3), units_wasted: 2 })]} />);
    expect(screen.getByTestId('alert-predictive-1')).toBeTruthy();
    expect(screen.getByText('Predicción')).toBeTruthy();
  });

  it('always puts the badge in the top right corner of the alert, whatever the text', () => {
    render(<DynamicAlert alertsData={[
      baseAlert({ id: 1, type: 'slow_pace', units_wasted: 2, product_expiry: inDays(3), product_name: 'Muy corto' }),
      baseAlert({ id: 2, type: 'stock_low_coverage', days_until_stockout: 2, product_name: 'Un nombre de producto bastante más largo que el otro' }),
    ]} />);
    const badge = (id: number) => StyleSheet.flatten(screen.getByTestId(`alert-predictive-${id}`).props.style);
    expect(badge(1)).toMatchObject({ position: 'absolute', top: 8, right: 10 });
    expect(badge(2)).toMatchObject({ position: 'absolute', top: 8, right: 10 });
    // es hermano del texto, no está dentro de él
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('alert-text-1')).toBeLessThan(tree.indexOf('alert-predictive-1'));
  });

  it('leaves room for the badge so the name never goes under it', () => {
    render(<DynamicAlert alertsData={[
      baseAlert({ id: 1, type: 'slow_pace', units_wasted: 2, product_expiry: inDays(3) }),
      baseAlert({ id: 2, type: 'expiry', product_expiry: inDays(3) }),
    ]} />);
    const names = screen.getAllByText('Leche');
    expect(StyleSheet.flatten(names[0].props.style).paddingRight).toBeGreaterThan(60);
    expect(StyleSheet.flatten(names[1].props.style).paddingRight).toBeUndefined();
  });

  it('does not mark as predictive the alerts that are only a date', () => {
    render(<DynamicAlert alertsData={[baseAlert({ id: 1, type: 'expiry', product_expiry: inDays(3) })]} />);
    expect(screen.queryByTestId('alert-predictive-1')).toBeNull();
    expect(screen.queryByText('Predicción')).toBeNull();
  });
});

describe('DynamicAlert - plain white entries', () => {
  it.each(['expiry', 'stock_low_coverage', 'slow_pace'] as const)('shows the %s alert on a plain white background with no colored outline', type => {
    render(<DynamicAlert alertsData={[baseAlert({ id: 1, type, product_expiry: inDays(3), units_wasted: 2, days_until_stockout: 2 })]} />);
    const row = StyleSheet.flatten(screen.getByTestId('alert-row-1').props.style);
    expect(row.backgroundColor).toBe('#fff');
    expect(row.borderWidth).toBeUndefined();
    expect(row.borderColor).toBeUndefined();
  });
});
