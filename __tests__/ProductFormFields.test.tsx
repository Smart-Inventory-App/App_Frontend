import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Image, Alert, StyleSheet } from 'react-native';
import ProductFormFields from '../src/components/ProductFormFields';
import { FieldFocusContext } from '../src/components/KeyboardAwareScrollView';
import { pickFromCamera, pickFromGallery, uploadImage } from '@/services/imageService';
import { ProductCreate, ProductSuggestion } from '@/types/product';

jest.mock('@/services/imageService', () => ({
  pickFromGallery: jest.fn(),
  pickFromCamera: jest.fn(),
  uploadImage: jest.fn(),
}));

function Wrapper({ form: initialForm, ...rest }: Partial<React.ComponentProps<typeof ProductFormFields>> = {}) {
  const [form, setForm] = useState<Partial<ProductCreate>>(initialForm ?? {});
  return (
    <ProductFormFields
      categoriaOptions={['Lacteos']}
      onAddCategoria={jest.fn()}
      ubicacionOptions={['Heladera']}
      onAddUbicacion={jest.fn()}
      marcaOptions={['LaSerenisima']}
      onAddMarca={jest.fn()}
      {...rest}
      form={form}
      onChange={setForm}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ProductFormFields - basic inputs', () => {
  it('types into nombre, descripcion and vencimiento', () => {
    render(<Wrapper />);
    fireEvent.changeText(screen.getByPlaceholderText('ej. Leche entera 1L'), 'Leche');
    expect(screen.getByDisplayValue('Leche')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('input-descripcion'), 'Entera');
    expect(screen.getByDisplayValue('Entera')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('input-vencimiento'), '01052026');
    expect(screen.getByDisplayValue('01/05/2026')).toBeTruthy();
  });

  it('clears vencimiento when emptied', () => {
    render(<Wrapper form={{ vencimiento: '2026-05-01' }} />);
    expect(screen.getByTestId('input-vencimiento').props.value).toBe('01/05/2026');
    fireEvent.changeText(screen.getByTestId('input-vencimiento'), '');
    expect(screen.getByTestId('input-vencimiento').props.value).toBe('');
  });

  it('only accepts digits for stock', () => {
    render(<Wrapper />);
    const input = screen.getByPlaceholderText('0');
    fireEvent.changeText(input, '12a3');
    expect(screen.getByDisplayValue('123')).toBeTruthy();
  });

  it('clears stock when the field is emptied', () => {
    render(<Wrapper form={{ stock: 5 }} />);
    const input = screen.getByPlaceholderText('0');
    fireEvent.changeText(input, '');
    expect(input.props.value).toBe('');
  });
});

describe('ProductFormFields - categoria chips', () => {
  it('selects and deselects a category chip', () => {
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Lacteos'));
    expect(screen.getByText('Lacteos')).toBeTruthy();
    fireEvent.press(screen.getByText('Lacteos'));
  });

  it('adds a new category', () => {
    const onAddCategoria = jest.fn();
    render(<Wrapper onAddCategoria={onAddCategoria} />);
    fireEvent.press(screen.getByTestId('add-categoria'));
    fireEvent.changeText(screen.getByTestId('input-categoria'), 'Bebidas');
    fireEvent.press(screen.getByTestId('confirm-categoria'));
    expect(onAddCategoria).toHaveBeenCalledWith('Bebidas');
  });

  it('cancels adding a new category without an existing one selected', () => {
    render(<Wrapper />);
    fireEvent.press(screen.getByTestId('add-categoria'));
    fireEvent.press(screen.UNSAFE_getAllByProps({ name: 'close' })[0]);
  });

  it('normalizes a new category to an existing option with different casing', () => {
    const onAddCategoria = jest.fn();
    render(<Wrapper onAddCategoria={onAddCategoria} />);
    fireEvent.press(screen.getByTestId('add-categoria'));
    fireEvent.changeText(screen.getByTestId('input-categoria'), 'lacteos');
    fireEvent.press(screen.getByTestId('confirm-categoria'));
    expect(onAddCategoria).toHaveBeenCalledWith('Lacteos');
  });

  it('confirming an empty new category just closes the input', () => {
    render(<Wrapper />);
    fireEvent.press(screen.getByTestId('add-categoria'));
    fireEvent.press(screen.getByTestId('confirm-categoria'));
  });

  it('shows a selected category not in the options list', () => {
    render(<Wrapper form={{ categoria: 'Custom' }} />);
    expect(screen.getByText('Custom')).toBeTruthy();
  });
});

describe('ProductFormFields - ubicacion chips', () => {
  it('selects a location chip', () => {
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Heladera'));
  });

  it('adds a new location', () => {
    const onAddUbicacion = jest.fn();
    render(<Wrapper onAddUbicacion={onAddUbicacion} />);
    fireEvent.press(screen.getByTestId('add-ubicacion'));
    fireEvent.changeText(screen.getByTestId('input-ubicacion'), 'Freezer');
    fireEvent.press(screen.getByTestId('confirm-ubicacion'));
    expect(onAddUbicacion).toHaveBeenCalledWith('Freezer');
  });

  it('shows a selected location not in the options list with the location icon', () => {
    render(<Wrapper form={{ ubicacion: 'Otro lugar' }} />);
    expect(screen.getByText(/Otro lugar/)).toBeTruthy();
  });
});

describe('ProductFormFields - marca chips', () => {
  it('selects a marca chip', () => {
    render(<Wrapper />);
    fireEvent.press(screen.getByText('LaSerenisima'));
  });

  it('adds a new marca', () => {
    const onAddMarca = jest.fn();
    render(<Wrapper onAddMarca={onAddMarca} />);
    fireEvent.press(screen.getByTestId('add-marca'));
    fireEvent.changeText(screen.getByTestId('input-marca'), 'Sancor');
    fireEvent.press(screen.getByTestId('confirm-marca'));
    expect(onAddMarca).toHaveBeenCalledWith('Sancor');
  });

  it('shows a selected marca not in the options list', () => {
    render(<Wrapper form={{ marca: 'OtraMarca' }} />);
    expect(screen.getByText('OtraMarca')).toBeTruthy();
  });
});

describe('ProductFormFields - nombre suggestions', () => {
  const suggestions: ProductSuggestion[] = [
    { id: 1, nombre: 'Yogur Ser', marca: 'Ser', categoria: 'Lacteos', stock: 2, vencimiento: '2026-01-01' },
    { id: 2, nombre: 'Yogur Descremado', categoria: 'Lacteos', stock: 1 },
  ];

  it('shows suggestions while focused and typing, and applies one on tap', async () => {
    jest.useFakeTimers();
    const suggestNombre = jest.fn().mockResolvedValue(suggestions);
    render(<Wrapper suggestNombre={suggestNombre} />);

    const input = screen.getByPlaceholderText('ej. Leche entera 1L');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, 'yog');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    jest.useRealTimers();

    await waitFor(() => expect(screen.getByText('Yogur Ser · Ser')).toBeTruthy());
    fireEvent.press(screen.getByText('Yogur Ser · Ser'));
    expect(screen.getByDisplayValue('Yogur Ser')).toBeTruthy();
  });

  it('clears suggestions when the query is too short', async () => {
    const suggestNombre = jest.fn().mockResolvedValue(suggestions);
    render(<Wrapper suggestNombre={suggestNombre} />);
    const input = screen.getByPlaceholderText('ej. Leche entera 1L');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, 'y');
    expect(suggestNombre).not.toHaveBeenCalled();
  });

  it('silently ignores a suggestion lookup failure', async () => {
    jest.useFakeTimers();
    const suggestNombre = jest.fn().mockRejectedValue(new Error('network'));
    render(<Wrapper suggestNombre={suggestNombre} />);
    const input = screen.getByPlaceholderText('ej. Leche entera 1L');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, 'yog');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    jest.useRealTimers();
    expect(screen.queryByText('Yogur Ser · Ser')).toBeNull();
  });

  it('hides the suggestions box after blur', async () => {
    jest.useFakeTimers();
    const suggestNombre = jest.fn().mockResolvedValue(suggestions);
    render(<Wrapper suggestNombre={suggestNombre} />);
    const input = screen.getByPlaceholderText('ej. Leche entera 1L');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, 'yog');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    fireEvent(input, 'blur');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });
    jest.useRealTimers();
    expect(screen.queryByText('Yogur Ser · Ser')).toBeNull();
  });
});

describe('ProductFormFields - image picker', () => {
  const PICKED = { uri: 'file://a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg' };

  it('asks for confirmation after taking a photo, and uploads it only when confirmed', async () => {
    (pickFromCamera as jest.Mock).mockResolvedValue(PICKED);
    (uploadImage as jest.Mock).mockResolvedValue('https://cdn/a.jpg');
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    await act(async () => {
      fireEvent.press(screen.getByText('Tomar foto'));
    });
    expect(screen.getByText('¿Querés cargar esta imagen?')).toBeTruthy();
    expect(screen.getByTestId('image-confirm-preview').props.source).toEqual({ uri: 'file://a.jpg' });
    expect(uploadImage).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByTestId('image-confirm-accept'));
    });
    expect(uploadImage).toHaveBeenCalledWith(PICKED);
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://cdn/a.jpg' });
    expect(screen.queryByText('¿Querés cargar esta imagen?')).toBeNull();
  });

  it('asks for confirmation after choosing from the gallery, and uploads it only when confirmed', async () => {
    (pickFromGallery as jest.Mock).mockResolvedValue(PICKED);
    (uploadImage as jest.Mock).mockResolvedValue('https://cdn/b.jpg');
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    await act(async () => {
      fireEvent.press(screen.getByText('Elegir de la galería'));
    });
    expect(screen.getByText('¿Querés cargar esta imagen?')).toBeTruthy();
    expect(uploadImage).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByTestId('image-confirm-accept'));
    });
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://cdn/b.jpg' });
  });

  it('does not upload nor set the image when the user cancels the confirmation', async () => {
    (pickFromGallery as jest.Mock).mockResolvedValue(PICKED);
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    await act(async () => {
      fireEvent.press(screen.getByText('Elegir de la galería'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('image-confirm-cancel'));
    });
    expect(uploadImage).not.toHaveBeenCalled();
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(screen.queryByText('¿Querés cargar esta imagen?')).toBeNull();
  });

  it('keeps the current image when the user cancels the confirmation of a new one', async () => {
    (pickFromGallery as jest.Mock).mockResolvedValue(PICKED);
    render(<Wrapper form={{ imagen_url: 'https://cdn/existing.jpg' }} />);
    fireEvent.press(screen.getByText('Cambiar imagen'));
    await act(async () => {
      fireEvent.press(screen.getByText('Elegir de la galería'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('image-confirm-cancel'));
    });
    expect(uploadImage).not.toHaveBeenCalled();
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://cdn/existing.jpg' });
  });

  it('shows an alert when the upload fails after confirming', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (pickFromCamera as jest.Mock).mockResolvedValue(PICKED);
    (uploadImage as jest.Mock).mockRejectedValue(new Error('sin conexión'));
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    await act(async () => {
      fireEvent.press(screen.getByText('Tomar foto'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('image-confirm-accept'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'sin conexión');
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    (Alert.alert as jest.Mock).mockRestore();
  });

  it('shows a generic alert message when the upload fails with something that is not an Error', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (pickFromCamera as jest.Mock).mockResolvedValue(PICKED);
    (uploadImage as jest.Mock).mockRejectedValue('boom');
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    await act(async () => {
      fireEvent.press(screen.getByText('Tomar foto'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('image-confirm-accept'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Error al subir la imagen.');
    (Alert.alert as jest.Mock).mockRestore();
  });

  it('keeps no image when the user cancels the picker', async () => {
    (pickFromCamera as jest.Mock).mockResolvedValue(null);
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    await act(async () => {
      fireEvent.press(screen.getByText('Tomar foto'));
    });
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    await waitFor(() => expect(screen.getAllByText('Seleccionar imagen')).toHaveLength(1), { timeout: 3000 });
  });

  it('shows an alert when the picker throws', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (pickFromCamera as jest.Mock).mockRejectedValue(new Error('Se necesita permiso para usar la cámara.'));
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    await act(async () => {
      fireEvent.press(screen.getByText('Tomar foto'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Se necesita permiso para usar la cámara.');
    (Alert.alert as jest.Mock).mockRestore();
  });

  it('shows a generic alert message when picking fails with something that is not an Error', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (pickFromCamera as jest.Mock).mockRejectedValue('boom');
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    await act(async () => {
      fireEvent.press(screen.getByText('Tomar foto'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Error al elegir la imagen.');
    (Alert.alert as jest.Mock).mockRestore();
  });

  it('closes the picker sheet via cancel and can change an existing image', async () => {
    render(<Wrapper form={{ imagen_url: 'https://cdn/existing.jpg' }} />);
    expect(screen.getByText('Cambiar imagen')).toBeTruthy();
    fireEvent.press(screen.getByText('Cambiar imagen'));
    fireEvent.press(screen.getByText('Cancelar'));
  });

  it('closes the picker sheet by pressing the overlay', () => {
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    // Overlay press dismisses the modal (top-level Pressable's onPress).
  });
});

function Harness({ initial = {}, ...rest }: { initial?: Partial<ProductCreate> } & Partial<React.ComponentProps<typeof ProductFormFields>>) {
  const [form, setForm] = useState<Partial<ProductCreate>>(initial);
  latestForm = form;
  return (
    <ProductFormFields
      categoriaOptions={['Lácteos', 'Limpieza']}
      marcaOptions={['Sancor']}
      ubicacionOptions={['Heladera']}
      {...rest}
      form={form}
      onChange={setForm}
    />
  );
}

let latestForm: Partial<ProductCreate> = {};

describe('ProductFormFields - vencimiento (DD/MM/AAAA)', () => {
  const dateInput = () => screen.getByTestId('input-vencimiento');

  it('puts the slashes in automatically while only digits are typed', () => {
    render(<Harness />);
    fireEvent.changeText(dateInput(), '3');
    expect(dateInput().props.value).toBe('3');
    fireEvent.changeText(dateInput(), '311');
    expect(dateInput().props.value).toBe('31/1');
    fireEvent.changeText(dateInput(), '31122026');
    expect(dateInput().props.value).toBe('31/12/2026');
  });

  it('stores the ISO date once the date is complete and real', () => {
    render(<Harness />);
    fireEvent.changeText(dateInput(), '31122026');
    expect(latestForm.vencimiento).toBe('2026-12-31');
  });

  it('keeps the partial text in the form (so validation rejects it) until the date is complete', () => {
    render(<Harness />);
    fireEvent.changeText(dateInput(), '3112');
    expect(latestForm.vencimiento).toBe('31/12');
  });

  it('keeps an impossible date as typed and marks the field as invalid', () => {
    render(<Harness />);
    fireEvent.changeText(dateInput(), '31022026');
    expect(latestForm.vencimiento).toBe('31/02/2026');
    expect(StyleSheet.flatten(dateInput().props.style).borderColor).toBe('#FF3B30');
  });

  it('does not mark the field as invalid for a valid or still-incomplete date', () => {
    render(<Harness />);
    fireEvent.changeText(dateInput(), '3112');
    expect(StyleSheet.flatten(dateInput().props.style).borderColor).not.toBe('#FF3B30');
    fireEvent.changeText(dateInput(), '31122026');
    expect(StyleSheet.flatten(dateInput().props.style).borderColor).not.toBe('#FF3B30');
  });

  it('shows an existing ISO value as DD/MM/AAAA', () => {
    render(<Harness initial={{ vencimiento: '2026-05-01' }} />);
    expect(dateInput().props.value).toBe('01/05/2026');
  });

  it('empties the stored value when the field is cleared', () => {
    render(<Harness initial={{ vencimiento: '2026-05-01' }} />);
    fireEvent.changeText(dateInput(), '');
    expect(latestForm.vencimiento).toBeUndefined();
  });

  it('reflects a value that changes from outside the field', () => {
    const onChange = jest.fn();
    const { rerender } = render(<ProductFormFields form={{}} onChange={onChange} />);
    rerender(<ProductFormFields form={{ vencimiento: '2027-01-02' }} onChange={onChange} />);
    expect(dateInput().props.value).toBe('02/01/2027');
    rerender(<ProductFormFields form={{}} onChange={onChange} />);
    expect(dateInput().props.value).toBe('');
  });

  it('has a calendar button to the right of the field that fills the date', () => {
    render(<Harness initial={{ vencimiento: '2026-10-15' }} />);
    expect(screen.queryByText('Octubre 2026')).toBeNull();
    fireEvent.press(screen.getByTestId('open-calendar'));
    expect(screen.getByText('Octubre 2026')).toBeTruthy();
    fireEvent.press(screen.getByTestId('calendar-day-20'));
    expect(dateInput().props.value).toBe('20/10/2026');
    expect(latestForm.vencimiento).toBe('2026-10-20');
    expect(screen.queryByText('Octubre 2026')).toBeNull();
  });

  it('closes the calendar without changing the date', () => {
    render(<Harness initial={{ vencimiento: '2026-10-15' }} />);
    fireEvent.press(screen.getByTestId('open-calendar'));
    fireEvent.press(screen.getAllByText('Cancelar')[0]);
    expect(latestForm.vencimiento).toBe('2026-10-15');
    expect(dateInput().props.value).toBe('15/10/2026');
  });
});

describe('ProductFormFields - add buttons and similar options', () => {
  it('puts the square add button before the chips', () => {
    render(<Harness />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('add-categoria')).toBeGreaterThan(-1);
    expect(tree.indexOf('add-categoria')).toBeLessThan(tree.indexOf('Lácteos'));
    expect(tree.indexOf('add-marca')).toBeLessThan(tree.indexOf('Sancor'));
    expect(tree.indexOf('add-ubicacion')).toBeLessThan(tree.indexOf('Heladera'));
  });

  it('draws the add button as a white square with a plus', () => {
    render(<Harness />);
    const style = StyleSheet.flatten(screen.getByTestId('add-categoria').props.style);
    expect(style.backgroundColor).toBe('#fff');
    expect(style.borderRadius).toBe(8);
    expect(style.width).toBe(style.height);
  });

  it('suggests existing options that look like what is being typed, ignoring accents and case', () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId('add-categoria'));
    expect(screen.queryByTestId('similar-categoria-Lácteos')).toBeNull();
    fireEvent.changeText(screen.getByTestId('input-categoria'), 'lacte');
    expect(screen.getByTestId('similar-categoria-Lácteos')).toBeTruthy();
    expect(screen.queryByTestId('similar-categoria-Limpieza')).toBeNull();
    fireEvent.changeText(screen.getByTestId('input-categoria'), 'zzz');
    expect(screen.queryByTestId('similar-categoria-Lácteos')).toBeNull();
  });

  it('selects the existing option when a suggestion is tapped, without adding a duplicate', () => {
    const onAddCategoria = jest.fn();
    render(<Harness onAddCategoria={onAddCategoria} />);
    fireEvent.press(screen.getByTestId('add-categoria'));
    fireEvent.changeText(screen.getByTestId('input-categoria'), 'lim');
    fireEvent.press(screen.getByTestId('similar-categoria-Limpieza'));
    expect(latestForm.categoria).toBe('Limpieza');
    expect(onAddCategoria).not.toHaveBeenCalled();
    expect(screen.queryByTestId('input-categoria')).toBeNull();
  });

  it('works the same for marca and ubicacion', () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId('add-marca'));
    fireEvent.changeText(screen.getByTestId('input-marca'), 'san');
    fireEvent.press(screen.getByTestId('similar-marca-Sancor'));
    expect(latestForm.marca).toBe('Sancor');

    fireEvent.press(screen.getByTestId('add-ubicacion'));
    fireEvent.changeText(screen.getByTestId('input-ubicacion'), 'hela');
    fireEvent.press(screen.getByTestId('similar-ubicacion-Heladera'));
    expect(latestForm.ubicacion).toBe('Heladera');
  });

  it('cancelling the new value clears the typed text and the suggestions', () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId('add-categoria'));
    fireEvent.changeText(screen.getByTestId('input-categoria'), 'lacte');
    fireEvent.press(screen.UNSAFE_getAllByProps({ name: 'close' })[0]);
    expect(screen.queryByTestId('similar-categoria-Lácteos')).toBeNull();
    fireEvent.press(screen.getByTestId('add-categoria'));
    expect(screen.getByTestId('input-categoria').props.value).toBe('');
  });
});

describe('ProductFormFields - labels and placeholders', () => {
  it('labels the date field just "Vencimiento", with the format as its placeholder, and "Opcional" in the description', () => {
    render(<Wrapper />);
    expect(screen.getByText('Vencimiento')).toBeTruthy();
    expect(screen.queryByText(/DD\/MM\/AAAA/)).toBeNull();
    expect(screen.getByTestId('input-vencimiento').props.placeholder).toBe('DD/MM/AAAA');
    expect(screen.getByTestId('input-descripcion').props.placeholder).toBe('Opcional');
  });

  it('starts the Categoría, Marca and Ubicación placeholders with a capital letter', () => {
    render(<Wrapper />);
    fireEvent.press(screen.getByTestId('add-categoria'));
    expect(screen.getByTestId('input-categoria').props.placeholder).toBe('Ej. Lácteos');
    fireEvent.press(screen.getByTestId('confirm-categoria'));
    fireEvent.press(screen.getByTestId('add-marca'));
    expect(screen.getByTestId('input-marca').props.placeholder).toBe('Opcional');
    fireEvent.press(screen.getByTestId('confirm-marca'));
    fireEvent.press(screen.getByTestId('add-ubicacion'));
    expect(screen.getByTestId('input-ubicacion').props.placeholder).toBe('Ej. Heladera, Alacena A, Freezer');
  });

  it('reserves the same label height in both alert rule fields so the inputs line up, with the title against its input', () => {
    render(<Wrapper />);
    const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);
    expect(flat('alert-label-box-stock-minimo').minHeight).toBe(32);
    expect(flat('alert-label-box-dias').minHeight).toBe(flat('alert-label-box-stock-minimo').minHeight);
    expect(flat('alert-label-box-stock-minimo').justifyContent).toBe('flex-end');
    expect(flat('alert-label-box-dias').justifyContent).toBe('flex-end');
  });

  it('puts the selected option first and sends it back to its place when deselected', () => {
    render(<Wrapper categoriaOptions={['Lácteos', 'Limpieza', 'Bebidas']} />);
    const order = () => {
      const tree = JSON.stringify(screen.toJSON());
      return ['Lácteos', 'Limpieza', 'Bebidas'].sort((a, b) => tree.indexOf(a) - tree.indexOf(b));
    };
    expect(order()).toEqual(['Lácteos', 'Limpieza', 'Bebidas']);
    fireEvent.press(screen.getByText('Bebidas'));
    expect(order()).toEqual(['Bebidas', 'Lácteos', 'Limpieza']);
    fireEvent.press(screen.getByText('Bebidas'));
    expect(order()).toEqual(['Lácteos', 'Limpieza', 'Bebidas']);
  });

  it('tells the screen when any text field is focused', () => {
    const onFieldFocus = jest.fn();
    render(
      <FieldFocusContext.Provider value={onFieldFocus}>
        <Wrapper />
      </FieldFocusContext.Provider>,
    );
    const ids = ['input-vencimiento', 'input-codigo-barras', 'input-descripcion'];
    ids.forEach(id => fireEvent(screen.getByTestId(id), 'focus'));
    fireEvent(screen.getByPlaceholderText('ej. Leche entera 1L'), 'focus');
    fireEvent(screen.getByPlaceholderText('0'), 'focus');
    screen.getAllByPlaceholderText('Default').forEach(input => fireEvent(input, 'focus'));
    fireEvent.press(screen.getByTestId('add-categoria'));
    fireEvent(screen.getByTestId('input-categoria'), 'focus');
    expect(onFieldFocus).toHaveBeenCalledTimes(ids.length + 2 + 2 + 1);
  });

  it('does not show the camera buttons unless the screen can scan', () => {
    render(<Wrapper />);
    expect(screen.queryByTestId('scan-expiry')).toBeNull();
    expect(screen.queryByTestId('scan-barcode')).toBeNull();
  });

  it('shows a camera button to the right of the calendar and one to the right of the barcode, in the same format', () => {
    render(<Wrapper onScanField={jest.fn()} />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('open-calendar')).toBeLessThan(tree.indexOf('scan-expiry'));
    expect(tree.indexOf('input-codigo-barras')).toBeLessThan(tree.indexOf('scan-barcode'));
    const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);
    expect(flat('scan-expiry')).toMatchObject({ width: 40, height: 40, borderRadius: 8, backgroundColor: '#fff' });
    expect(flat('scan-barcode')).toMatchObject(flat('open-calendar'));
    expect(flat('scan-expiry')).toMatchObject(flat('open-calendar'));
    expect(flat('input-codigo-barras').flex).toBe(1);
  });

  it('asks to scan the expiry date or the barcode when its camera button is pressed', () => {
    const onScanField = jest.fn();
    render(<Wrapper onScanField={onScanField} />);
    fireEvent.press(screen.getByTestId('scan-expiry'));
    expect(onScanField).toHaveBeenLastCalledWith('expiry_date');
    fireEvent.press(screen.getByTestId('scan-barcode'));
    expect(onScanField).toHaveBeenLastCalledWith('barcode');
  });

  it('shows "Default" in the alert rule fields', () => {
    render(<Wrapper />);
    expect(screen.getAllByPlaceholderText('Default')).toHaveLength(2);
  });
});

describe('ProductFormFields - character limits and counters', () => {
  const LONG = 'Supermercado Mayorista Central';

  it('shows the nombre counter above the field, updating as the user types', () => {
    render(<Wrapper />);
    expect(screen.getByTestId('nombre-counter').props.children.join('')).toBe('0/20');
    fireEvent.changeText(screen.getByPlaceholderText('ej. Leche entera 1L'), 'Rare water');
    expect(screen.getByTestId('nombre-counter').props.children.join('')).toBe('10/20');
    expect(screen.getByPlaceholderText('ej. Leche entera 1L').props.maxLength).toBe(20);
  });

  it('shows the descripcion counter with its 400 limit', () => {
    render(<Wrapper />);
    expect(screen.getByTestId('descripcion-counter').props.children.join('')).toBe('0/400');
    fireEvent.changeText(screen.getByTestId('input-descripcion'), 'x'.repeat(127));
    expect(screen.getByTestId('descripcion-counter').props.children.join('')).toBe('127/400');
    expect(screen.getByTestId('input-descripcion').props.maxLength).toBe(400);
  });

  it('limits the new categoria, marca and ubicacion inputs to 20 characters', () => {
    render(<Wrapper />);
    for (const key of ['categoria', 'marca', 'ubicacion']) {
      fireEvent.press(screen.getByTestId(`add-${key}`));
      expect(screen.getByTestId(`input-${key}`).props.maxLength).toBe(20);
      fireEvent.press(screen.UNSAFE_getAllByProps({ name: 'close' })[0]);
    }
  });

  it('shows the first 20 characters and "..." for long options, keeping the full value when selected', () => {
    render(<Wrapper categoriaOptions={[LONG]} marcaOptions={[LONG]} ubicacionOptions={[LONG]} />);
    const shown = `${LONG.slice(0, 20)}...`;
    expect(screen.getAllByText(shown)).toHaveLength(3);
    expect(screen.queryByText(LONG)).toBeNull();
    fireEvent.press(screen.getAllByText(shown)[0]);
    expect(screen.getAllByText(shown).length).toBeGreaterThan(0);
  });

  it('truncates a selected value that is not in the options, and long similar suggestions', () => {
    render(<Wrapper categoriaOptions={[LONG]} form={{ categoria: 'Otra categoria muy larga', marca: LONG, ubicacion: LONG }} />);
    const shown = `${LONG.slice(0, 20)}...`;
    expect(screen.getByText(`${'Otra categoria muy larga'.slice(0, 20)}...`)).toBeTruthy();
    expect(screen.getAllByText(shown).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId('add-categoria'));
    fireEvent.changeText(screen.getByTestId('input-categoria'), 'super');
    expect(screen.getAllByText(shown).length).toBeGreaterThan(0);
  });
});

describe('ProductFormFields - alert rule limits', () => {
  it('does not accept a stock mínimo of more than seven digits (9999999 at most)', () => {
    render(<Wrapper />);
    expect(screen.getByTestId('input-stock-minimo').props.maxLength).toBe(7);
    fireEvent.changeText(screen.getByTestId('input-stock-minimo'), '9999999');
    expect(screen.getByDisplayValue('9999999')).toBeTruthy();
  });

  it('does not accept días de anticipación of more than three digits (999 at most)', () => {
    render(<Wrapper />);
    expect(screen.getByTestId('input-dias-alerta').props.maxLength).toBe(3);
    fireEvent.changeText(screen.getByTestId('input-dias-alerta'), '999');
    expect(screen.getByDisplayValue('999')).toBeTruthy();
  });

  it('keeps working with the values below the limit and with the field empty', () => {
    render(<Wrapper />);
    fireEvent.changeText(screen.getByTestId('input-stock-minimo'), '25');
    fireEvent.changeText(screen.getByTestId('input-dias-alerta'), '7');
    expect(screen.getByDisplayValue('25')).toBeTruthy();
    expect(screen.getByDisplayValue('7')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('input-stock-minimo'), '');
    expect(screen.getByTestId('input-stock-minimo').props.value).toBe('');
  });
});

describe('ProductFormFields - stock limit', () => {
  it('does not accept more than six digits (999999 at most)', () => {
    render(<Wrapper />);
    expect(screen.getByPlaceholderText('0').props.maxLength).toBe(6);
    fireEvent.changeText(screen.getByPlaceholderText('0'), '999999');
    expect(screen.getByDisplayValue('999999')).toBeTruthy();
  });
});

describe('ProductFormFields - código de barras', () => {
  const input = () => screen.getByTestId('input-codigo-barras');

  it('sits right below Vencimiento, titled "Código de barras", with "Opcional" inside', () => {
    render(<Wrapper />);
    expect(screen.getByText('Código de barras')).toBeTruthy();
    expect(input().props.placeholder).toBe('Opcional');
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Vencimiento')).toBeLessThan(tree.indexOf('Código de barras'));
    expect(tree.indexOf('Código de barras')).toBeLessThan(tree.indexOf('input-descripcion'));
  });

  it('accepts only digits, up to 14, and shows no character counter', () => {
    render(<Wrapper />);
    expect(input().props.maxLength).toBe(14);
    expect(input().props.keyboardType).toBe('number-pad');
    fireEvent.changeText(input(), '779-12a3');
    expect(input().props.value).toBe('779123');
    expect(screen.queryByText(/\d+\/1[34]/)).toBeNull();
  });

  it('stores the barcode, and clears it when emptied', () => {
    render(<Harness />);
    fireEvent.changeText(input(), '7791234567898');
    expect(latestForm.codigo_barras).toBe('7791234567898');
    fireEvent.changeText(input(), '');
    expect(latestForm.codigo_barras).toBeUndefined();
  });

  it('shows an existing barcode', () => {
    render(<Wrapper form={{ codigo_barras: '7791234567898' }} />);
    expect(input().props.value).toBe('7791234567898');
  });
});

describe('ProductFormFields - selecting an existing product by name', () => {
  const existing: ProductSuggestion = {
    id: 1, nombre: 'Yogur Ser', marca: 'Ser', categoria: 'Lacteos', ubicacion: 'Heladera', stock: 2,
    vencimiento: '2027-01-01', stock_minimo: 3, dias_alerta_vencimiento: 4,
    descripcion: 'Natural', imagen_url: 'https://cdn/y.jpg', codigo_barras: '7791234567898',
  };

  it('also loads its barcode, minimum stock, anticipation days, description and image', async () => {
    jest.useFakeTimers();
    const suggestNombre = jest.fn().mockResolvedValue([existing]);
    render(<Harness suggestNombre={suggestNombre} />);
    const input = screen.getByPlaceholderText('ej. Leche entera 1L');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, 'yog');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    jest.useRealTimers();
    await waitFor(() => expect(screen.getByText('Yogur Ser · Ser')).toBeTruthy());
    fireEvent.press(screen.getByText('Yogur Ser · Ser'));

    expect(latestForm).toMatchObject({
      nombre: 'Yogur Ser', codigo_barras: '7791234567898', stock_minimo: 3, dias_alerta_vencimiento: 4,
      descripcion: 'Natural', imagen_url: 'https://cdn/y.jpg',
    });
    expect(screen.getByTestId('input-codigo-barras').props.value).toBe('7791234567898');
    expect(screen.getByTestId('input-descripcion').props.value).toBe('Natural');
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://cdn/y.jpg' });
  });
});

describe('ProductFormFields - image picker sheet', () => {
  it('opens as a bottom sheet (fading backdrop, sliding sheet) titled like the other windows, smaller', () => {
    render(<Wrapper />);
    expect(screen.queryByTestId('image-picker-sheet')).toBeNull();
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    expect(screen.getByTestId('image-picker-sheet')).toBeTruthy();
    const title = StyleSheet.flatten(screen.getAllByText('Seleccionar imagen').pop()!.props.style);
    expect(title.fontFamily).toBe('Roboto_500Medium');
    expect(title.fontSize).toBe(20);
  });

  it('closes when tapping outside the sheet but not when tapping the sheet', async () => {
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    fireEvent.press(screen.getByTestId('image-picker-sheet'));
    expect(screen.getByTestId('image-picker-sheet')).toBeTruthy();
    fireEvent.press(screen.getByTestId('image-picker-overlay'));
    await waitFor(() => expect(screen.queryByTestId('image-picker-sheet')).toBeNull(), { timeout: 3000 });
  });
});

describe('ProductFormFields - selecting a product replaces what was typed', () => {
  it('empties the barcode field typed before when the chosen product has no barcode', async () => {
    jest.useFakeTimers();
    const noBarcode: ProductSuggestion = {
      id: 1, nombre: 'Yogur Ser', marca: 'Ser', categoria: 'Lacteos', stock: 2, descripcion: 'Natural',
    };
    const suggestNombre = jest.fn().mockResolvedValue([noBarcode]);
    render(<Harness suggestNombre={suggestNombre} initial={{ codigo_barras: '7791234567898', vencimiento: '2027-01-01', imagen_url: 'https://cdn/x.jpg' }} />);
    expect(screen.getByTestId('input-codigo-barras').props.value).toBe('7791234567898');

    const input = screen.getByPlaceholderText('ej. Leche entera 1L');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, 'yog');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    jest.useRealTimers();
    await waitFor(() => expect(screen.getByText('Yogur Ser · Ser')).toBeTruthy());
    fireEvent.press(screen.getByText('Yogur Ser · Ser'));

    expect(screen.getByTestId('input-codigo-barras').props.value).toBe('');
    expect(screen.getByTestId('input-vencimiento').props.value).toBe('');
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(screen.getByTestId('input-descripcion').props.value).toBe('Natural');
    expect(latestForm.codigo_barras).toBeUndefined();
  });
});
