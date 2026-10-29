import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Ionicons } from '@expo/vector-icons';
import HistorialModal from '../src/components/HistorialModal';
import { productService } from '@/services/productService';
import { ConsumptionEvent, Product } from '@/types/product';

jest.mock('@/services/productService', () => ({
  productService: {
    getConsumptionHistory: jest.fn(),
    updateConsumptionEvent: jest.fn(),
    deleteConsumptionEvent: jest.fn(),
  },
}));

const mockedProducts = productService as jest.Mocked<typeof productService>;

const product: Product = { id: 1, user_id: 'u1', nombre: 'Leche', categoria: 'Lacteos', stock: 3 };

const event = (overrides: Partial<ConsumptionEvent> = {}): ConsumptionEvent => ({
  id: 1,
  quantity: 2,
  event_type: 'consumed',
  consumed_at: '2026-01-01T00:00:00Z',
  reversed: false,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  (Alert.alert as jest.Mock).mockRestore();
});

describe('HistorialModal', () => {
  it('renders nothing relevant when there is no product', () => {
    render(<HistorialModal product={null} visible={false} onClose={jest.fn()} onChanged={jest.fn()} />);
  });

  it('loads and shows the consumption history when opened', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 1 }), event({ id: 2, event_type: 'restocked' })]);
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    expect(mockedProducts.getConsumptionHistory).toHaveBeenCalledWith(1);
  });

  it('shows an empty state when there are no events', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([]);
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Todavía no hay movimientos para este producto')).toBeTruthy());
  });

  it('shows an alert when loading history fails', async () => {
    mockedProducts.getConsumptionHistory.mockRejectedValue(new Error('boom'));
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudo cargar el historial'));
  });

  it('closes via the header close button', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([]);
    const onClose = jest.fn();
    render(<HistorialModal product={product} visible onClose={onClose} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Historial del Producto')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a badge and undo icon for a reversed / reversing event, hiding its actions', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([
      event({ id: 1, reversed: true }),
      event({ id: 2, reverses_event_id: 1, note: 'Corrección', actor_email: 'a@b.com' }),
    ]);
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Corregido')).toBeTruthy());
    expect(screen.getByText('Corrección')).toBeTruthy();
    expect(screen.getByText(/a@b.com/)).toBeTruthy();
  });

  it('edits and saves an event with a new quantity/motivo/note', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5, quantity: 2 })]);
    mockedProducts.updateConsumptionEvent.mockResolvedValue({ event_type: 'consumed', quantity: 4, remaining_stock: 1 });
    const onChanged = jest.fn();
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={onChanged} />);

    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));

    fireEvent.changeText(screen.getByDisplayValue('2'), '4');
    fireEvent.press(screen.getByText('Vencido'));
    fireEvent.changeText(screen.getByPlaceholderText('Motivo (Opcional)'), 'Nota');

    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5, quantity: 4, event_type: 'expired' })]);
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });

    expect(mockedProducts.updateConsumptionEvent).toHaveBeenCalledWith(1, 5, 4, 'expired', 'Nota');
    expect(onChanged).toHaveBeenCalled();
  });

  it('does not save an edit with an invalid quantity', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5, quantity: 2 })]);
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
    fireEvent.changeText(screen.getByDisplayValue('2'), '');
    fireEvent.press(screen.getByText('Guardar'));
    expect(mockedProducts.updateConsumptionEvent).not.toHaveBeenCalled();
  });

  it('cancels editing an event', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5 })]);
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByText('Guardar')).toBeNull();
  });

  const BLOCKED = 'No se puede editar el historial de consumo';

  it('shows "No se puede editar el historial de consumo" when saving an edit fails, whatever the reason', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5 })]);
    mockedProducts.updateConsumptionEvent.mockRejectedValue({ response: { data: { detail: 'Cantidad inválida' } } });
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
    expect(screen.queryByTestId('historial-error')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });
    expect(screen.getByTestId('historial-error')).toBeTruthy();
    expect(screen.getByText(BLOCKED)).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('shows the same message when the edit fails without any detail (e.g. network)', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5 })]);
    mockedProducts.updateConsumptionEvent.mockRejectedValue(new Error('network'));
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });
    expect(screen.getByText(BLOCKED)).toBeTruthy();
  });

  it('clears the message when editing again or when an edit succeeds', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5 })]);
    mockedProducts.updateConsumptionEvent.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ remaining_stock: 1 } as any);
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });
    expect(screen.getByText(BLOCKED)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });
    expect(screen.queryByText(BLOCKED)).toBeNull();
  });

  it('labels sales and rentals in the history rows', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([
      event({ id: 1, event_type: 'sold' }),
      event({ id: 2, event_type: 'rented' }),
      event({ id: 3, event_type: 'expired' }),
    ]);
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Vendido')).toBeTruthy());
    expect(screen.getByText('Alquilado')).toBeTruthy();
    expect(screen.getByText('Vencido')).toBeTruthy();
  });

  describe('edit form depends on the kind of record', () => {
    const openEdit = async (events: ConsumptionEvent[]) => {
      mockedProducts.getConsumptionHistory.mockResolvedValue(events);
      render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
      await waitFor(() => expect(screen.getByTestId('historial-sheet')).toBeTruthy());
      await waitFor(() => expect(screen.UNSAFE_queryAllByType(Ionicons).some((n: any) => n.props.name === 'pencil')).toBe(true));
      fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
    };

    it('an entry only lets you change the units and the (optional) reason', async () => {
      await openEdit([event({ id: 7, event_type: 'restocked', quantity: 5 })]);
      expect(screen.getByText('Unidades')).toBeTruthy();
      expect(screen.getByText('Motivo')).toBeTruthy();
      expect(screen.getByPlaceholderText('Motivo (Opcional)')).toBeTruthy();
      expect(screen.queryByText('Consumido')).toBeNull();
      expect(screen.queryByText('Vencido')).toBeNull();
      expect(screen.queryByText('Entrada')).toBeNull();
    });

    it('an entry keeps being an entry when saved', async () => {
      mockedProducts.updateConsumptionEvent.mockResolvedValue({ event_type: 'restocked', quantity: 6, remaining_stock: 9 } as any);
      await openEdit([event({ id: 7, event_type: 'restocked', quantity: 5 })]);
      fireEvent.changeText(screen.getByDisplayValue('5'), '6');
      await act(async () => {
        fireEvent.press(screen.getByText('Guardar'));
      });
      expect(mockedProducts.updateConsumptionEvent).toHaveBeenCalledWith(1, 7, 6, 'restocked', '');
    });

    it('an exit lets you change units, switch between Consumido and Vencido (no Entrada) and the reason', async () => {
      await openEdit([event({ id: 8, event_type: 'consumed', quantity: 2 })]);
      expect(screen.getByText('Unidades')).toBeTruthy();
      expect(screen.getByText('Consumido')).toBeTruthy();
      expect(screen.getByText('Vencido')).toBeTruthy();
      expect(screen.queryByText('Entrada')).toBeNull();
      expect(screen.getByText('Motivo')).toBeTruthy();
      expect(screen.getByPlaceholderText('Motivo (Opcional)')).toBeTruthy();
    });

    it('an exit can be switched to any of the four reasons, including Vendido and Alquilado', async () => {
      await openEdit([event({ id: 9, event_type: 'consumed', quantity: 2 })]);
      expect(screen.getByText('Vendido')).toBeTruthy();
      expect(screen.getByText('Alquilado')).toBeTruthy();
      fireEvent.press(screen.getByTestId('historial-motivo-rented'));
      await act(async () => {
        fireEvent.press(screen.getByText('Guardar'));
      });
      expect(mockedProducts.updateConsumptionEvent).toHaveBeenCalledWith(1, 9, 2, 'rented', '');
    });

    it('an entry does not offer the exit reasons, Vendido and Alquilado included', async () => {
      await openEdit([event({ id: 7, event_type: 'restocked', quantity: 5 })]);
      expect(screen.queryByText('Vendido')).toBeNull();
      expect(screen.queryByText('Alquilado')).toBeNull();
    });
  });

  it('gives every history row the same fixed height, with single-line texts', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([
      event({ id: 1, note: 'Una nota bastante larga que no debería agrandar la fila de ninguna manera posible', actor_email: 'alguien@example.com' }),
      event({ id: 2 }),
      event({ id: 3, reversed: true }),
    ]);
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText(/Una nota bastante larga/)).toBeTruthy());
    const rows = screen.UNSAFE_getAllByType(require('react-native').View).filter((v: any) => {
      const style = require('react-native').StyleSheet.flatten(v.props.style);
      return style && style.height === 66;
    });
    expect(rows).toHaveLength(3);
    expect(screen.getByText(/Una nota bastante larga/).props.numberOfLines).toBe(1);
  });

  const CONFIRM_TEXT = '¿Borrar este registro de consumo?\nEl stock se va a ajustar automáticamente.';
  const pressTrash = () =>
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'trash'));

  it('closes when tapping outside the sheet, but not when tapping the sheet itself', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5 })]);
    const onClose = jest.fn();
    render(<HistorialModal product={product} visible onClose={onClose} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    fireEvent.press(screen.getByTestId('historial-sheet'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('historial-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation before deleting an event, and cancelling does nothing', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5 })]);
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    expect(screen.queryByText(CONFIRM_TEXT)).toBeNull();
    pressTrash();
    expect(screen.getByText(CONFIRM_TEXT)).toBeTruthy();
    fireEvent.press(screen.getAllByText('Cancelar').pop()!);
    expect(screen.queryByText(CONFIRM_TEXT)).toBeNull();
    expect(mockedProducts.deleteConsumptionEvent).not.toHaveBeenCalled();
  });

  it('deletes an event after confirming', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5 })]);
    mockedProducts.deleteConsumptionEvent.mockResolvedValue({ remaining_stock: 1 });
    const onChanged = jest.fn();
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={onChanged} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    pressTrash();
    await act(async () => {
      fireEvent.press(screen.getByText('Borrar'));
    });
    expect(mockedProducts.deleteConsumptionEvent).toHaveBeenCalledWith(1, 5);
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByText(CONFIRM_TEXT)).toBeNull();
  });

  it('shows "No se puede editar el historial de consumo" when deleting fails (e.g. not enough stock)', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5 })]);
    mockedProducts.deleteConsumptionEvent.mockRejectedValue({ response: { data: { detail: 'No se puede borrar: dejaría el stock en negativo' } } });
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    pressTrash();
    await act(async () => {
      fireEvent.press(screen.getByText('Borrar'));
    });
    expect(screen.getByText(BLOCKED)).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('shows the same message when deleting fails without any detail', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5 })]);
    mockedProducts.deleteConsumptionEvent.mockRejectedValue(new Error('boom'));
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    pressTrash();
    await act(async () => {
      fireEvent.press(screen.getByText('Borrar'));
    });
    expect(screen.getByText(BLOCKED)).toBeTruthy();
  });
});

describe('HistorialModal - dates, notes and limits', () => {
  const pencil = () =>
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));

  it('shows each record as time first, then date, in 24-hour Argentine time', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([
      event({ id: 1, consumed_at: '2026-10-10T20:43:23.962872+00:00' }),
    ]);
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('17:43:23 10/10/2026')).toBeTruthy());
  });

  it('mentions the original record by its time and date instead of its number', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([
      event({ id: 43, consumed_at: '2026-10-10T20:43:23+00:00', reversed: true }),
      event({ id: 44, consumed_at: '2026-10-10T21:00:00+00:00', event_type: 'restocked', reverses_event_id: 43, note: 'Deshecho: revierte el registro #43' }),
    ]);
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Deshace el registro del 10/10/2026 17:43')).toBeTruthy());
    expect(screen.queryByText(/#43/)).toBeNull();
  });

  it('shows the reason in a single line, cut with an ellipsis when it is too long', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 1, note: 'x'.repeat(50) })]);
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('x'.repeat(50))).toBeTruthy());
    const note = screen.getByText('x'.repeat(50));
    expect(note.props.numberOfLines).toBe(1);
    expect(note.props.ellipsizeMode).toBe('tail');
  });

  it('limits the reason to 50 characters and counts them while editing', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5 })]);
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    pencil();
    expect(screen.getByTestId('historial-note-counter').props.children.join('')).toBe('0/50');
    const input = screen.getByPlaceholderText('Motivo (Opcional)');
    expect(input.props.maxLength).toBe(50);
    fireEvent.changeText(input, 'compré de más');
    expect(screen.getByTestId('historial-note-counter').props.children.join('')).toBe('13/50');
  });

  it('limits the edited units to six digits', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5, quantity: 2 })]);
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    pencil();
    expect(screen.getByDisplayValue('2').props.maxLength).toBe(6);
  });
});
