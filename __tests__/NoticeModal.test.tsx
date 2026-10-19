import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import NoticeModal from '../src/components/NoticeModal';

const setup = (visible = true) => {
  const onContinue = jest.fn();
  render(<NoticeModal visible={visible} message="Aviso importante" buttonLabel="Continuar" onContinue={onContinue} />);
  return onContinue;
};

describe('NoticeModal', () => {
  it('shows nothing while hidden', () => {
    setup(false);
    expect(screen.queryByTestId('notice-card')).toBeNull();
  });

  it('shows the message with a single button', () => {
    setup();
    expect(screen.getByTestId('notice-message').props.children).toBe('Aviso importante');
    expect(screen.getByText('Continuar')).toBeTruthy();
    expect(screen.queryByText('Cancelar')).toBeNull();
  });

  it('closes with the button, tapping outside and the system back button', () => {
    const onContinue = setup();
    fireEvent.press(screen.getByTestId('notice-continue'));
    fireEvent.press(screen.getByTestId('notice-backdrop'));
    const { Modal } = require('react-native');
    screen.UNSAFE_getByType(Modal).props.onRequestClose();
    expect(onContinue).toHaveBeenCalledTimes(3);
  });

  it('does not close when tapping the card', () => {
    const onContinue = setup();
    fireEvent.press(screen.getByTestId('notice-card'));
    expect(onContinue).not.toHaveBeenCalled();
  });
});
