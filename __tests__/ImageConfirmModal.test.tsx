import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ImageConfirmModal from '../src/components/ImageConfirmModal';

const setup = (uri: string | null = 'file://a.jpg', visible = true) => {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  render(<ImageConfirmModal visible={visible} uri={uri} onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel };
};

describe('ImageConfirmModal', () => {
  it('shows nothing while hidden', () => {
    setup('file://a.jpg', false);
    expect(screen.queryByTestId('image-confirm-card')).toBeNull();
  });

  it('asks for confirmation and shows the chosen image', () => {
    setup();
    expect(screen.getByText('¿Querés cargar esta imagen?')).toBeTruthy();
    expect(screen.getByTestId('image-confirm-preview').props.source).toEqual({ uri: 'file://a.jpg' });
  });

  it('has no crop option', () => {
    setup();
    expect(screen.queryByText(/cortar|recortar/i)).toBeNull();
  });

  it('confirms with the Confirmar button', () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.press(screen.getByTestId('image-confirm-accept'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels with the Cancelar button, tapping outside and the system back button', () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.press(screen.getByTestId('image-confirm-cancel'));
    fireEvent.press(screen.getByTestId('image-confirm-backdrop'));
    const { Modal } = require('react-native');
    screen.UNSAFE_getByType(Modal).props.onRequestClose();
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not close when tapping the card itself', () => {
    const { onCancel } = setup();
    fireEvent.press(screen.getByTestId('image-confirm-card'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('does not draw a preview without an image', () => {
    setup(null);
    expect(screen.queryByTestId('image-confirm-preview')).toBeNull();
  });
});
