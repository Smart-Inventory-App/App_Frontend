import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ForgotPasswordScreen from '../app/(auth)/forgot-password';
import { authService } from '@/services/authService';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: { email?: string } = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
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
  mockParams = {};
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

describe('ForgotPasswordScreen - email from the login', () => {
  const renderWithProvider = () =>
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <ForgotPasswordScreen />
      </SafeAreaProvider>,
    );

  it('shows the email typed in the login already filled in', () => {
    mockParams = { email: 'a@b.com' };
    renderWithProvider();
    expect(screen.getByDisplayValue('a@b.com')).toBeTruthy();
  });

  it('continues with that email without typing it again', async () => {
    mockParams = { email: 'a@b.com' };
    mockedAuthService.forgotPassword.mockResolvedValue(undefined);
    renderWithProvider();
    await act(async () => {
      fireEvent.press(screen.getAllByText('Continuar')[0]);
    });
    expect(mockedAuthService.forgotPassword).toHaveBeenCalledWith('a@b.com');
  });

  it('starts empty when no email comes from the login', () => {
    renderWithProvider();
    expect(screen.queryByDisplayValue('a@b.com')).toBeNull();
  });

  it('asks for the mail address of the account', () => {
    renderWithProvider();
    expect(screen.getByText(/Ingresa la dirección de mail de tu cuenta\.\s*Si el mail indicado corresponde a una cuenta registrada, recibirás un código de recuperación de 6 dígitos\./)).toBeTruthy();
  });
});

describe('ForgotPasswordScreen - logo', () => {
  it('shows the horizontal logo of the app instead of the vertical one with text', () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByTestId('auth-logo')).toBeTruthy();
    expect(screen.queryByText('Smart')).toBeNull();
    expect(screen.queryByText('Inventory')).toBeNull();
  });
});
