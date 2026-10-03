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
    await waitFor(() => expect(screen.getByText('Historial de consumo')).toBeTruthy());
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
    fireEvent.changeText(screen.getByPlaceholderText('Motivo (opcional)'), 'Nota');

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

  it('shows an alert when saving an edit fails', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5 })]);
    mockedProducts.updateConsumptionEvent.mockRejectedValue({ response: { data: { detail: 'no se pudo' } } });
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'no se pudo');
  });

  it('shows a generic alert message when saving an edit fails without a detail', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5 })]);
    mockedProducts.updateConsumptionEvent.mockRejectedValue(new Error('network'));
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudo corregir el registro');
  });

  it('deletes an event after confirming', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5 })]);
    mockedProducts.deleteConsumptionEvent.mockResolvedValue({ remaining_stock: 1 });
    const onChanged = jest.fn();
    (Alert.alert as jest.Mock).mockImplementation((_title, _msg, buttons) => {
      const destroy = buttons?.find((b: any) => b.style === 'destructive');
      destroy?.onPress?.();
    });
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={onChanged} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'trash'));
    });
    expect(mockedProducts.deleteConsumptionEvent).toHaveBeenCalledWith(1, 5);
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows an alert with the backend detail when deleting fails', async () => {
    mockedProducts.getConsumptionHistory.mockResolvedValue([event({ id: 5 })]);
    mockedProducts.deleteConsumptionEvent.mockRejectedValue({ response: { data: { detail: 'no se pudo borrar' } } });
    (Alert.alert as jest.Mock).mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b: any) => b.style === 'destructive')?.onPress?.();
    });
    render(<HistorialModal product={product} visible onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Consumido')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'trash'));
    });
    expect(Alert.alert).toHaveBeenLastCalledWith('Error', 'no se pudo borrar');
  });
});
