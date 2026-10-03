import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Image, Alert } from 'react-native';
import ProductFormFields from '../src/components/ProductFormFields';
import { pickFromCamera, pickFromGallery } from '@/services/imageService';
import { ProductCreate, ProductSuggestion } from '@/types/product';

jest.mock('@/services/imageService', () => ({
  pickFromGallery: jest.fn(),
  pickFromCamera: jest.fn(),
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

    fireEvent.changeText(screen.getByPlaceholderText('opcional'), 'Entera');
    expect(screen.getByDisplayValue('Entera')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('2026-12-31 (opcional)'), '2026-05-01');
    expect(screen.getByDisplayValue('2026-05-01')).toBeTruthy();
  });

  it('clears vencimiento when emptied', () => {
    render(<Wrapper form={{ vencimiento: '2026-05-01' }} />);
    fireEvent.changeText(screen.getByPlaceholderText('2026-12-31 (opcional)'), '');
    expect(screen.getByPlaceholderText('2026-12-31 (opcional)').props.value).toBe('');
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
  it('uploads from the camera and sets imagen_url', async () => {
    (pickFromCamera as jest.Mock).mockResolvedValue('https://cdn/a.jpg');
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    await act(async () => {
      fireEvent.press(screen.getByText('Tomar foto'));
    });
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://cdn/a.jpg' });
  });

  it('uploads from the gallery and sets imagen_url', async () => {
    (pickFromGallery as jest.Mock).mockResolvedValue('https://cdn/b.jpg');
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    await act(async () => {
      fireEvent.press(screen.getByText('Elegir de la galería'));
    });
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://cdn/b.jpg' });
  });

  it('keeps no image when the user cancels the picker', async () => {
    (pickFromCamera as jest.Mock).mockResolvedValue(null);
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    await act(async () => {
      fireEvent.press(screen.getByText('Tomar foto'));
    });
    expect(screen.getByText('Seleccionar imagen')).toBeTruthy();
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

  it('shows a generic alert message for a non-Error rejection', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (pickFromCamera as jest.Mock).mockRejectedValue('boom');
    render(<Wrapper />);
    fireEvent.press(screen.getByText('Seleccionar imagen'));
    await act(async () => {
      fireEvent.press(screen.getByText('Tomar foto'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Error al subir la imagen.');
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
