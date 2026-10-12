import React from 'react';
import { render, screen } from '@testing-library/react-native';
import StatCard from '../src/components/StatCard';

describe('StatCard', () => {
  it('renders title, value and label', () => {
    render(<StatCard title="Productos" value="12" label="En inventario" labelColor="green" />);
    expect(screen.getByText('Productos')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('En inventario')).toBeTruthy();
  });

  it('renders with a yellow label', () => {
    render(<StatCard title="Stock bajo" value="3" label="Próximos 7 días" labelColor="yellow" />);
    expect(screen.getByText('Próximos 7 días')).toBeTruthy();
  });

  it('renders with a red label', () => {
    render(<StatCard title="Por vencer" value="1" label="Próximos 3 días" labelColor="red" />);
    expect(screen.getByText('Próximos 3 días')).toBeTruthy();
  });

  it('falls back to the green style for an unrecognized color', () => {
    render(<StatCard title="X" value="1" label="Y" labelColor={'purple' as any} />);
    expect(screen.getByText('Y')).toBeTruthy();
  });
});
