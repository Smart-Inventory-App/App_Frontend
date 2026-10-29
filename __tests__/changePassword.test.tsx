import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ChangePasswordScreen from '../app/(auth)/change-password';
import { authService } from '@/services/authService';
import { clearFlashMessage, peekFlashMessage } from '@/utils/flashMessage';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: any[]) => mockReplace(...args) },
  useLocalSearchParams: () => ({ reset_token: 'reset-tok' }),
}));

jest.mock('../src/services/authService', () => ({
  authService: { resetPassword: jest.fn(), checkNewPassword: jest.fn() },
}));

const mockedAuthService = authService as jest.Mocked<typeof authService>;

beforeEach(() => {
  jest.clearAllMocks();
  clearFlashMessage();
  mockedAuthService.checkNewPassword.mockResolvedValue(true);
});

function typePasswords(value: string) {
  fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], value);
  fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], value);
}

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
    expect(peekFlashMessage()).toBe('changePassword.success');
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

describe('ChangePasswordScreen: different from the current password', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the rule as pending, then green when the server says it is different', async () => {
    jest.useFakeTimers();
    render(<ChangePasswordScreen />);
    expect(screen.getByText('Contraseña diferente a la actual')).toBeTruthy();
    typePasswords('Password1!');
    expect(mockedAuthService.checkNewPassword).not.toHaveBeenCalled();
    await act(async () => { await jest.advanceTimersByTimeAsync(500); });
    expect(mockedAuthService.checkNewPassword).toHaveBeenCalledWith('reset-tok', 'Password1!');
    const colorOf = (label: string) => StyleSheet.flatten(screen.getByText(label).props.style).color;
    expect(colorOf('Contraseña diferente a la actual')).not.toBe('#FF3B30');
  });

  it('turns the rule red and blocks the button when the password equals the current one', async () => {
    jest.useFakeTimers();
    mockedAuthService.checkNewPassword.mockResolvedValue(false);
    render(<ChangePasswordScreen />);
    typePasswords('Password1!');
    await act(async () => { await jest.advanceTimersByTimeAsync(500); });
    const colorOf = (label: string) => StyleSheet.flatten(screen.getByText(label).props.style).color;
    expect(colorOf('Contraseña diferente a la actual')).toBe('#FF3B30');
    await act(async () => {
      fireEvent.press(screen.getByText('Cambiar Contraseña'));
    });
    expect(mockedAuthService.resetPassword).not.toHaveBeenCalled();
  });

  it('goes back to pending when the password is cleared', async () => {
    jest.useFakeTimers();
    mockedAuthService.checkNewPassword.mockResolvedValue(false);
    render(<ChangePasswordScreen />);
    typePasswords('Password1!');
    await act(async () => { await jest.advanceTimersByTimeAsync(500); });
    typePasswords('');
    const colorOf = (label: string) => StyleSheet.flatten(screen.getByText(label).props.style).color;
    expect(colorOf('Contraseña diferente a la actual')).not.toBe('#FF3B30');
  });

  it('does not block the user when the check itself fails', async () => {
    jest.useFakeTimers();
    mockedAuthService.checkNewPassword.mockRejectedValue(new Error('boom'));
    mockedAuthService.resetPassword.mockResolvedValue(undefined);
    render(<ChangePasswordScreen />);
    typePasswords('Password1!');
    await act(async () => { await jest.advanceTimersByTimeAsync(500); });
    await act(async () => {
      fireEvent.press(screen.getByText('Cambiar Contraseña'));
    });
    expect(mockedAuthService.resetPassword).toHaveBeenCalled();
  });

  it('marks the rule red when the server rejects the password on submit', async () => {
    mockedAuthService.resetPassword.mockRejectedValue({ response: { data: { detail: 'auth.password_same_as_current' } } });
    render(<ChangePasswordScreen />);
    typePasswords('Password1!');
    await act(async () => {
      fireEvent.press(screen.getByText('Cambiar Contraseña'));
    });
    const colorOf = (label: string) => StyleSheet.flatten(screen.getByText(label).props.style).color;
    expect(colorOf('Contraseña diferente a la actual')).toBe('#FF3B30');
    expect(screen.queryByText('No se pudo cambiar la contraseña. Intentá de nuevo.')).toBeNull();
    expect(peekFlashMessage()).toBeNull();
  });
});

describe('ChangePasswordScreen: rules layout', () => {
  it('lists "different from the current password" first and "passwords match" last', () => {
    render(<ChangePasswordScreen />);
    const labels = [
      'Contraseña diferente a la actual',
      'Mínimo de 8 caracteres',
      'Contiene mayúsculas',
      'Contiene minúsculas',
      'Contiene número y/o carácter especial',
      'Las contraseñas coinciden',
    ];
    const rendered = JSON.stringify(screen.toJSON());
    const positions = labels.map((l) => rendered.indexOf(l));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('turns "passwords match" green only when both passwords are equal', () => {
    render(<ChangePasswordScreen />);
    const colorOf = (label: string) => StyleSheet.flatten(screen.getByText(label).props.style).color;
    expect(colorOf('Las contraseñas coinciden')).not.toBe('#FF3B30');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'Password1!');
    expect(colorOf('Las contraseñas coinciden')).toBe('#FF3B30');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'Password1!');
    expect(colorOf('Las contraseñas coinciden')).not.toBe('#FF3B30');
    expect(screen.getAllByText('✓').length).toBeGreaterThan(0);
  });
});

describe('ChangePasswordScreen - password fields and logo', () => {
  it('shows the horizontal logo of the app', () => {
    render(<ChangePasswordScreen />);
    expect(screen.getByTestId('auth-logo')).toBeTruthy();
    expect(screen.queryByText('Smart')).toBeNull();
  });

  it('hides both passwords by default and toggles each one with its eye button', () => {
    render(<ChangePasswordScreen />);
    const fields = () => screen.getAllByPlaceholderText('••••••••');
    expect(fields()[0].props.secureTextEntry).toBe(true);
    expect(fields()[1].props.secureTextEntry).toBe(true);
    const eyes = screen.getAllByTestId('toggle-password');
    expect(eyes).toHaveLength(2);
    fireEvent.press(eyes[0]);
    expect(fields()[0].props.secureTextEntry).toBe(false);
    expect(fields()[1].props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getAllByTestId('toggle-password')[0]);
    expect(fields()[0].props.secureTextEntry).toBe(true);
  });

  it('keeps what was typed when the password is shown', () => {
    render(<ChangePasswordScreen />);
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'Abcdef12');
    fireEvent.press(screen.getAllByTestId('toggle-password')[1]);
    expect(screen.getAllByPlaceholderText('••••••••')[1].props.value).toBe('Abcdef12');
  });
});
