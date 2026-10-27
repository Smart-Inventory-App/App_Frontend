import React from 'react';
import { KeyboardAvoidingView, Modal, StyleSheet, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import CenteredModal from '../src/components/CenteredModal';

const centered = (visible: boolean, onRequestClose = jest.fn()) => (
  <CenteredModal visible={visible} onRequestClose={onRequestClose} overlayTestID="overlay" cardTestID="card">
    <Text>contenido</Text>
  </CenteredModal>
);

describe('CenteredModal', () => {
  it('renders nothing while hidden and shows the content when visible', () => {
    const { rerender } = render(centered(false));
    expect(screen.queryByText('contenido')).toBeNull();
    rerender(centered(true));
    expect(screen.getByText('contenido')).toBeTruthy();
  });

  it('is a transparent window that fades in, in the center of the screen', () => {
    render(centered(true));
    const modal = screen.UNSAFE_getByType(Modal);
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.animationType).toBe('fade');
    expect(StyleSheet.flatten(screen.UNSAFE_getByType(KeyboardAvoidingView).props.style).justifyContent).toBe('center');
    expect(StyleSheet.flatten(screen.getByTestId('card').props.style).borderRadius).toBe(20);
  });

  it('does not close when tapping outside the window or on it', () => {
    const onRequestClose = jest.fn();
    render(centered(true, onRequestClose));
    fireEvent.press(screen.getByTestId('overlay'));
    fireEvent.press(screen.getByTestId('card'));
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('closes only with the system back button', () => {
    const onRequestClose = jest.fn();
    render(centered(true, onRequestClose));
    screen.UNSAFE_getByType(Modal).props.onRequestClose();
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('shrinks to leave room for the keyboard', () => {
    render(centered(true));
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
    expect(StyleSheet.flatten(screen.getByTestId('card').props.style).flexShrink).toBe(1);
  });
});
