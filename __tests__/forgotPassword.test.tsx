import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ForgotPasswordScreen from '../app/(auth)/forgot-password';
import { authService } from '@/services/authService';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: any[]) => mockPush(...args),
    back: (...args: any[]) => mockBack(...args),
  },
}));

jest.mock('../src/services/authService', () => ({
  authService: { forgotPassword: jest.fn() },
}));

const mockedAuthService = authService as jest.Mocked<typeof authService>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ForgotPasswordScreen', () => {
  it('does nothing when the email is empty', () => {
    render(<ForgotPasswordScreen />);
    fireEvent.press(screen.getByText('Continuar'));
    expect(mockedAuthService.forgotPassword).not.toHaveBeenCalled();
  });

  it('sends the reset email and navigates to verify-code', async () => {
    mockedAuthService.forgotPassword.mockResolvedValue(undefined);
    render(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar'));
    });
    expect(mockedAuthService.forgotPassword).toHaveBeenCalledWith('a@b.com');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/verify-code', params: { email: 'a@b.com' } });
  });

  it('still navigates to verify-code even if sending the email fails (no email enumeration)', async () => {
    mockedAuthService.forgotPassword.mockRejectedValue(new Error('boom'));
    render(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar'));
    });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/verify-code', params: { email: 'a@b.com' } });
  });

  it('navigates back to login', () => {
    render(<ForgotPasswordScreen />);
    fireEvent.press(screen.getByText('Volver al inicio de sesión'));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('ForgotPasswordScreen - barras del sistema de Android', () => {
  it('keeps its content away from the status bar and the system buttons', () => {
    const { UNSAFE_getByType } = render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 30, left: 0, right: 0, bottom: 24 } }}>
        <ForgotPasswordScreen />
      </SafeAreaProvider>,
    );
    const style = StyleSheet.flatten(UNSAFE_getByType(KeyboardAvoidingView).props.style);
    expect(style.paddingTop).toBe(30);
    expect(style.paddingBottom).toBe(24);
  });
});
