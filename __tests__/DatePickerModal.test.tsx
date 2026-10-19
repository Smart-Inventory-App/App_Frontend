import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Modal } from 'react-native';
import DatePickerModal from '../src/components/DatePickerModal';

describe('DatePickerModal', () => {
  it('renders nothing while hidden', () => {
    render(<DatePickerModal visible={false} onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(screen.queryByText('Cancelar')).toBeNull();
  });

  it('opens on the month of the current value, with Monday as the first weekday', () => {
    render(<DatePickerModal visible value="2026-10-15" onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Octubre 2026')).toBeTruthy();
    expect(screen.getAllByText('L').length).toBeGreaterThan(0);
    expect(screen.getByTestId('calendar-day-31')).toBeTruthy();
    expect(screen.queryByTestId('calendar-day-32')).toBeNull();
  });

  it('opens on the current month when there is no valid value', () => {
    render(<DatePickerModal visible value="12/0" onSelect={jest.fn()} onClose={jest.fn()} />);
    const now = new Date();
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    expect(screen.getByText(`${months[now.getMonth()]} ${now.getFullYear()}`)).toBeTruthy();
  });

  it('returns the picked day as an ISO date', () => {
    const onSelect = jest.fn();
    render(<DatePickerModal visible value="2026-10-15" onSelect={onSelect} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('calendar-day-7'));
    expect(onSelect).toHaveBeenCalledWith('2026-10-07');
  });

  it('moves between months and wraps the year', () => {
    const onSelect = jest.fn();
    render(<DatePickerModal visible value="2026-12-10" onSelect={onSelect} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('calendar-next-month'));
    expect(screen.getByText('Enero 2027')).toBeTruthy();
    fireEvent.press(screen.getByTestId('calendar-prev-month'));
    fireEvent.press(screen.getByTestId('calendar-prev-month'));
    expect(screen.getByText('Noviembre 2026')).toBeTruthy();
    fireEvent.press(screen.getByTestId('calendar-day-3'));
    expect(onSelect).toHaveBeenCalledWith('2026-11-03');
  });

  it('moves a whole year at a time', () => {
    render(<DatePickerModal visible value="2026-03-10" onSelect={jest.fn()} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('calendar-next-year'));
    expect(screen.getByText('Marzo 2027')).toBeTruthy();
    fireEvent.press(screen.getByTestId('calendar-prev-year'));
    fireEvent.press(screen.getByTestId('calendar-prev-year'));
    expect(screen.getByText('Marzo 2025')).toBeTruthy();
  });

  it.each([
    ['2027-02-10', 'Febrero 2027'], // empieza en lunes y tiene 28 días: 4 semanas de días
    ['2026-10-10', 'Octubre 2026'],
    ['2026-08-10', 'Agosto 2026'], // 31 días empezando en sábado: 6 semanas de días
  ])('always shows six weeks so the calendar keeps the same size (%s)', (value, title) => {
    render(<DatePickerModal visible value={value} onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText(title)).toBeTruthy();
    for (let week = 0; week < 6; week++) {
      expect(screen.getByTestId(`calendar-week-${week}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('calendar-week-6')).toBeNull();
  });

  it('handles February in a leap year', () => {
    render(<DatePickerModal visible value="2028-02-10" onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByTestId('calendar-day-29')).toBeTruthy();
    expect(screen.queryByTestId('calendar-day-30')).toBeNull();
  });

  it('closes from the cancel button, the backdrop and the system back, but not by tapping the card', () => {
    const onClose = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <DatePickerModal visible value="2026-10-15" onSelect={jest.fn()} onClose={onClose} />,
    );
    fireEvent.press(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('Octubre 2026'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('calendar-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
    UNSAFE_getAllByType(Modal)[0].props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('reopens on the selected month after navigating away', () => {
    const { rerender } = render(<DatePickerModal visible value="2026-10-15" onSelect={jest.fn()} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('calendar-next-month'));
    rerender(<DatePickerModal visible={false} value="2026-10-15" onSelect={jest.fn()} onClose={jest.fn()} />);
    rerender(<DatePickerModal visible value="2026-10-15" onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Octubre 2026')).toBeTruthy();
  });
});

describe('DatePickerModal - pantalla completa', () => {
  it('covers the status bar and the system buttons too', () => {
    const { UNSAFE_getByType } = render(<DatePickerModal visible value="2026-10-15" onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(UNSAFE_getByType(Modal).props.statusBarTranslucent).toBe(true);
    expect(UNSAFE_getByType(Modal).props.navigationBarTranslucent).toBe(true);
  });
});
