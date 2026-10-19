import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Modal } from 'react-native';
import ConfirmModal from '../src/components/ConfirmModal';

const baseProps = {
  message: '¿Seguro?',
  confirmLabel: 'Cerrar',
  cancelLabel: 'Cancelar',
};

describe('ConfirmModal', () => {
  it('renders nothing when not visible', () => {
    render(<ConfirmModal {...baseProps} visible={false} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.queryByText('¿Seguro?')).toBeNull();
  });

  it('shows the message and both buttons', () => {
    render(<ConfirmModal {...baseProps} visible onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('¿Seguro?')).toBeTruthy();
    expect(screen.getByText('Cerrar')).toBeTruthy();
    expect(screen.getByText('Cancelar')).toBeTruthy();
  });

  it('calls onConfirm / onCancel from their buttons', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(<ConfirmModal {...baseProps} visible onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.press(screen.getByText('Cerrar'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels when the backdrop is tapped or the system back is pressed, but not when the card is tapped', () => {
    const onCancel = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ConfirmModal {...baseProps} visible onConfirm={jest.fn()} onCancel={onCancel} />,
    );
    const { Modal } = require('react-native');
    fireEvent.press(screen.getByTestId('confirm-card'));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('confirm-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    UNSAFE_getAllByType(Modal)[0].props.onRequestClose();
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});

describe('ConfirmModal - pantalla completa', () => {
  it('covers the status bar and the system buttons too', () => {
    const { UNSAFE_getByType } = render(<ConfirmModal {...baseProps} visible onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(UNSAFE_getByType(Modal).props.statusBarTranslucent).toBe(true);
    expect(UNSAFE_getByType(Modal).props.navigationBarTranslucent).toBe(true);
  });
});
