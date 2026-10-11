import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import FilterChipsRow from '../src/components/FilterChipsRow';

const OPTIONS = ['Lácteos', 'Limpieza', 'Almacén', 'Bebidas'];

const setup = (overrides: Partial<React.ComponentProps<typeof FilterChipsRow>> = {}) => {
  const onSelect = jest.fn();
  render(
    <FilterChipsRow
      testKey="categoria"
      label="Categoría"
      allLabel="Todas"
      searchPlaceholder="Buscar categoría"
      options={OPTIONS}
      selected={null}
      onSelect={onSelect}
      {...overrides}
    />,
  );
  return { onSelect };
};

describe('FilterChipsRow', () => {
  it('shows the search button with the same square format as the "+" button, before "Todas"', () => {
    setup();
    const style = StyleSheet.flatten(screen.getByTestId('filter-search-categoria').props.style);
    expect(style).toMatchObject({ width: 36, height: 36, borderRadius: 8, backgroundColor: '#fff' });
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('filter-search-categoria')).toBeLessThan(tree.indexOf('Todas'));
  });

  it('shows the options in a single line that hides what does not fit, with no scrolling', () => {
    setup();
    const style = StyleSheet.flatten(screen.getByTestId('filter-chips-categoria').props.style);
    expect(style.flexWrap).toBe('wrap');
    expect(style.overflow).toBe('hidden');
    expect(style.height).toBe(34);
    expect(screen.UNSAFE_queryAllByType(require('react-native').ScrollView)).toHaveLength(0);
  });

  it('selects and deselects an option, and "Todas" clears the filter', () => {
    const { onSelect } = setup({ selected: 'Bebidas' });
    fireEvent.press(screen.getByText('Bebidas'));
    expect(onSelect).toHaveBeenLastCalledWith(null);
    fireEvent.press(screen.getByText('Lácteos'));
    expect(onSelect).toHaveBeenLastCalledWith('Lácteos');
    fireEvent.press(screen.getByText('Todas'));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('always shows the selected option first so it is never hidden', () => {
    setup({ selected: 'Bebidas' });
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Bebidas')).toBeLessThan(tree.indexOf('Lácteos'));
  });

  it('opens a text field in the same row when the magnifier is pressed, and closes it again', () => {
    setup();
    expect(screen.queryByTestId('filter-search-input-categoria')).toBeNull();
    fireEvent.press(screen.getByTestId('filter-search-categoria'));
    expect(screen.getByTestId('filter-search-input-categoria')).toBeTruthy();
    expect(screen.getByPlaceholderText('Buscar categoría')).toBeTruthy();
    expect(screen.queryByText('Todas')).toBeNull();
    fireEvent.press(screen.getByTestId('filter-search-close-categoria'));
    expect(screen.queryByTestId('filter-search-input-categoria')).toBeNull();
    expect(screen.getByText('Todas')).toBeTruthy();
  });

  it('suggests matching options while typing (ignoring case and accents) and selects the tapped one', () => {
    const { onSelect } = setup();
    fireEvent.press(screen.getByTestId('filter-search-categoria'));
    const input = screen.getByTestId('filter-search-input-categoria');
    expect(input.props.maxLength).toBe(20);
    fireEvent.changeText(input, 'LACTE');
    expect(screen.getByTestId('filter-match-categoria-Lácteos')).toBeTruthy();
    expect(screen.queryByTestId('filter-match-categoria-Limpieza')).toBeNull();
    fireEvent.press(screen.getByTestId('filter-match-categoria-Lácteos'));
    expect(onSelect).toHaveBeenCalledWith('Lácteos');
    expect(screen.queryByTestId('filter-search-input-categoria')).toBeNull();
  });

  it('shows no suggestions when nothing matches or nothing was typed', () => {
    setup();
    fireEvent.press(screen.getByTestId('filter-search-categoria'));
    const input = screen.getByTestId('filter-search-input-categoria');
    expect(screen.queryByTestId('filter-match-categoria-Lácteos')).toBeNull();
    fireEvent.changeText(input, 'zzz');
    expect(screen.queryByTestId('filter-match-categoria-Lácteos')).toBeNull();
    expect(screen.queryByTestId('filter-match-categoria-Bebidas')).toBeNull();
  });

  it('picks the first match when the keyboard submit is pressed, and ignores a submit with no match', () => {
    const { onSelect } = setup();
    fireEvent.press(screen.getByTestId('filter-search-categoria'));
    const input = screen.getByTestId('filter-search-input-categoria');
    fireEvent.changeText(input, 'zzz');
    fireEvent(input, 'submitEditing');
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.changeText(input, 'li');
    fireEvent(input, 'submitEditing');
    expect(onSelect).toHaveBeenCalledWith('Limpieza');
  });

  it('shortens long option names to 20 characters', () => {
    setup({ options: ['Supermercado Mayorista Central'] });
    expect(screen.getByText('Supermercado Mayoris...')).toBeTruthy();
  });
});
