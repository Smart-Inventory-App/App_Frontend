import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ChangePasswordScreen from '../app/(auth)/change-password';
import { authService } from '@/services/authService';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: any[]) => mockReplace(...args) },
  useLocalSearchParams: () => ({ reset_token: 'reset-tok' }),
}));

jest.mock('../src/services/authService', () => ({
  authService: { resetPassword: jest.fn() },
}));

const mockedAuthService = authService as jest.Mocked<typeof authService>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ChangePasswordScreen', () => {
  it('does not submit while the passwords are invalid or do not match', async () => {
    render(<ChangePasswordScreen />);
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'weak');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'weak');
    await act(async () => {
      fireEvent.press(screen.getByText('Cambiar Contraseña'));
    });
    expect(mockedAuthService.resetPassword).not.toHaveBeenCalled();
  });

  it('changes the password and redirects to login', async () => {
    mockedAuthService.resetPassword.mockResolvedValue(undefined);
    render(<ChangePasswordScreen />);
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'Password1!');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'Password1!');
    await act(async () => {
      fireEvent.press(screen.getByText('Cambiar Contraseña'));
    });
    expect(mockedAuthService.resetPassword).toHaveBeenCalledWith('reset-tok', 'Password1!');
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('shows a translated error message on failure', async () => {
    mockedAuthService.resetPassword.mockRejectedValue({ response: { data: { detail: 'auth.invalid_or_expired_token' } } });
    render(<ChangePasswordScreen />);
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'Password1!');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'Password1!');
    await act(async () => {
      fireEvent.press(screen.getByText('Cambiar Contraseña'));
    });
    expect(screen.getByText('El enlace de recuperación es inválido o expiró')).toBeTruthy();
  });

  it('falls back to the generic error message', async () => {
    mockedAuthService.resetPassword.mockRejectedValue(new Error('boom'));
    render(<ChangePasswordScreen />);
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'Password1!');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'Password1!');
    await act(async () => {
      fireEvent.press(screen.getByText('Cambiar Contraseña'));
    });
    expect(screen.getByText('No se pudo cambiar la contraseña. Intentá de nuevo.')).toBeTruthy();
  });

  it('clears the error as soon as either password field changes', async () => {
    mockedAuthService.resetPassword.mockRejectedValue(new Error('boom'));
    render(<ChangePasswordScreen />);
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'Password1!');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'Password1!');
    await act(async () => {
      fireEvent.press(screen.getByText('Cambiar Contraseña'));
    });
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'Password2!');
    expect(screen.queryByText('No se pudo cambiar la contraseña. Intentá de nuevo.')).toBeNull();
  });
});
