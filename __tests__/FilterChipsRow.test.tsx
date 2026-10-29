import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
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

  it('shows the options in a single row that scrolls horizontally, after "Todas"', () => {
    setup();
    const scroll = screen.getByTestId('filter-chips-categoria');
    expect(scroll.props.horizontal).toBe(true);
    expect(scroll.props.showsHorizontalScrollIndicator).toBe(false);
    const content = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(content.flexDirection).toBe('row');
    expect(content.flexWrap).toBeUndefined();
    // «Todas» queda fuera de la fila que se desliza, antes de las opciones
    expect(within(scroll).queryByText('Todas')).toBeNull();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Todas')).toBeLessThan(tree.indexOf('Almacén'));
  });

  it('keeps the options tappable with the keyboard open', () => {
    setup();
    expect(screen.getByTestId('filter-chips-categoria').props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('shows every option, however many there are, since the row scrolls instead of hiding them', () => {
    const many = Array.from({ length: 30 }, (_, i) => `Opcion ${String(i).padStart(2, '0')}`);
    setup({ options: many });
    many.forEach(option => expect(screen.getByText(option)).toBeTruthy());
  });

  it('orders the options alphabetically, ignoring accents and case', () => {
    setup();
    const tree = JSON.stringify(screen.toJSON());
    const order = OPTIONS.slice().sort((a, b) => tree.indexOf(a) - tree.indexOf(b));
    expect(order).toEqual(['Almacén', 'Bebidas', 'Lácteos', 'Limpieza']);
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

  it('moves the selected option to the start, right after "Todas"', () => {
    setup({ selected: 'Limpieza' });
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Todas')).toBeLessThan(tree.indexOf('Limpieza'));
    expect(tree.indexOf('Limpieza')).toBeLessThan(tree.indexOf('Almacén'));
    expect(tree.indexOf('Limpieza')).toBeLessThan(tree.indexOf('Bebidas'));
    expect(tree.indexOf('Limpieza')).toBeLessThan(tree.indexOf('Lácteos'));
  });

  it('goes back to the start of the row when an option is selected', () => {
    const { rerender } = render(
      <FilterChipsRow testKey="categoria" label="Categoría" allLabel="Todas" searchPlaceholder="Buscar categoría" options={OPTIONS} selected={null} onSelect={jest.fn()} />,
    );
    const scrollTo = jest.fn();
    jest.spyOn(require('react-native').ScrollView.prototype, 'scrollTo' as any).mockImplementation(scrollTo);
    rerender(
      <FilterChipsRow testKey="categoria" label="Categoría" allLabel="Todas" searchPlaceholder="Buscar categoría" options={OPTIONS} selected="Limpieza" onSelect={jest.fn()} />,
    );
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, animated: true });
    jest.restoreAllMocks();
  });

  it('sends the option back to its alphabetical place when it is deselected', () => {
    const order = () => {
      const tree = JSON.stringify(screen.toJSON());
      return OPTIONS.slice().sort((a, b) => tree.indexOf(a) - tree.indexOf(b));
    };
    const { rerender } = render(
      <FilterChipsRow testKey="categoria" label="Categoría" allLabel="Todas" searchPlaceholder="Buscar categoría" options={OPTIONS} selected="Bebidas" onSelect={jest.fn()} />,
    );
    expect(order()).toEqual(['Bebidas', 'Almacén', 'Lácteos', 'Limpieza']);
    rerender(
      <FilterChipsRow testKey="categoria" label="Categoría" allLabel="Todas" searchPlaceholder="Buscar categoría" options={OPTIONS} selected={null} onSelect={jest.fn()} />,
    );
    expect(order()).toEqual(['Almacén', 'Bebidas', 'Lácteos', 'Limpieza']);
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

  it('does not cut the typed text: the search field has no fixed height and grows with the system font', () => {
    setup();
    fireEvent.press(screen.getByTestId('filter-search-categoria'));
    const input = StyleSheet.flatten(screen.getByTestId('filter-search-input-categoria').props.style);
    expect(input.height).toBeUndefined();
    expect(input.minHeight).toBe(44);
    expect(input.paddingVertical).toBeGreaterThan(0);
    expect(StyleSheet.flatten(screen.getByTestId('filter-search-close-categoria').props.style)).toMatchObject({ width: 44, height: 44 });
  });

  it('keeps the suggestions short enough to stay above the keyboard, and tappable with it open', () => {
    setup();
    fireEvent.press(screen.getByTestId('filter-search-categoria'));
    fireEvent.changeText(screen.getByTestId('filter-search-input-categoria'), 'l');
    const list = screen.getByTestId('filter-matches-categoria');
    expect(list.props.keyboardShouldPersistTaps).toBe('handled');
    expect(StyleSheet.flatten(list.props.style).maxHeight).toBe(136);
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
