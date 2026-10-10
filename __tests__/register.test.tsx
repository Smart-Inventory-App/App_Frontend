import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RegisterScreen from '../app/(auth)/register';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/authService';
import { clearFlashMessage, peekFlashMessage } from '@/utils/flashMessage';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: any[]) => mockReplace(...args) },
}));

jest.mock('../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../src/services/authService', () => ({
  authService: { checkEmail: jest.fn() },
}));

const mockRegister = jest.fn();
const mockedAuthService = authService as jest.Mocked<typeof authService>;

beforeEach(() => {
  jest.clearAllMocks();
  clearFlashMessage();
  (useAuth as jest.Mock).mockReturnValue({ register: mockRegister });
  mockedAuthService.checkEmail.mockResolvedValue(false);
});

describe('RegisterScreen', () => {
  it('disables the submit button until the password rules are all met', async () => {
    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'weak');
    await act(async () => {
      fireEvent.press(screen.getByText('Crear Cuenta'));
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('shows the email check with a waiting circle until the email is complete, then green or red', async () => {
    jest.useFakeTimers();
    render(<RegisterScreen />);
    const colorOf = (label: string) => StyleSheet.flatten(screen.getByText(label).props.style).color;
    expect(screen.getByText('Correo no registrado')).toBeTruthy();
    expect(screen.getAllByText('○')).toHaveLength(6);

    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b');
    expect(screen.getAllByText('○')).toHaveLength(6);

    mockedAuthService.checkEmail.mockResolvedValue(false);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    expect(screen.getAllByText('○')).toHaveLength(6);
    await act(async () => { await jest.advanceTimersByTimeAsync(600); });
    expect(screen.getAllByText('○')).toHaveLength(5);
    expect(screen.getAllByText('✓')).toHaveLength(1);
    expect(colorOf('Correo no registrado')).not.toBe('#FF3B30');

    mockedAuthService.checkEmail.mockResolvedValue(true);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'taken@b.com');
    expect(screen.getAllByText('○')).toHaveLength(6);
    await act(async () => { await jest.advanceTimersByTimeAsync(600); });
    expect(colorOf('Correo no registrado')).toBe('#FF3B30');
    expect(screen.getAllByText('✗')).toHaveLength(1);
    jest.useRealTimers();
  });

  it('goes back to waiting when the email is edited into an incomplete one', async () => {
    jest.useFakeTimers();
    mockedAuthService.checkEmail.mockResolvedValue(true);
    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    await act(async () => { await jest.advanceTimersByTimeAsync(600); });
    expect(screen.getAllByText('✗')).toHaveLength(1);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b');
    expect(screen.getAllByText('○')).toHaveLength(6);
    jest.useRealTimers();
  });

  it('shows the password rules from the start in a neutral state, then validates them', () => {
    render(<RegisterScreen />);
    expect(screen.getByText('Mínimo de 8 caracteres')).toBeTruthy();
    expect(screen.getByText('Las contraseñas coinciden')).toBeTruthy();
    expect(screen.queryByText('✗')).toBeNull();
    expect(screen.queryByText('✓')).toBeNull();
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'abc');
    expect(screen.getAllByText('✓').length).toBeGreaterThan(0);
    expect(screen.getAllByText('✗').length).toBeGreaterThan(0);
  });

  it('turns the "passwords match" rule green only when both passwords are equal', () => {
    render(<RegisterScreen />);
    const colorOf = (label: string) => StyleSheet.flatten(screen.getByText(label).props.style).color;
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'Password1!');
    expect(colorOf('Las contraseñas coinciden')).toBe('#FF3B30');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'Password1');
    expect(colorOf('Las contraseñas coinciden')).toBe('#FF3B30');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'Password1!');
    expect(colorOf('Las contraseñas coinciden')).not.toBe('#FF3B30');
  });

  it('shows the password rules once typing starts, and marks them valid', () => {
    render(<RegisterScreen />);
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'Password1!');
    expect(screen.getByText('Mínimo de 8 caracteres')).toBeTruthy();
  });

  it('registers successfully and redirects to login', async () => {
    mockRegister.mockResolvedValue(undefined);
    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'Password1!');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'Password1!');

    await act(async () => {
      fireEvent.press(screen.getByText('Crear Cuenta'));
    });

    expect(mockRegister).toHaveBeenCalledWith('a@b.com', 'Password1!');
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    expect(peekFlashMessage()).toBe('register.accountCreated');
  });

  it('marks the email as taken when the backend reports it', async () => {
    mockRegister.mockRejectedValue({ response: { data: { detail: 'auth.email_already_registered' } } });
    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'Password1!');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'Password1!');
    await act(async () => {
      fireEvent.press(screen.getByText('Crear Cuenta'));
    });
    expect(screen.getByText('Mail en uso')).toBeTruthy();
  });

  it('shows a network error message', async () => {
    mockRegister.mockRejectedValue({ message: 'Network Error' });
    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'Password1!');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'Password1!');
    await act(async () => {
      fireEvent.press(screen.getByText('Crear Cuenta'));
    });
    expect(screen.getByText('Sin conexión con el servidor')).toBeTruthy();
  });

  it('shows a generic translated error for anything else', async () => {
    mockRegister.mockRejectedValue({ response: { data: { detail: 'auth.account_disabled' } } });
    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'Password1!');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'Password1!');
    await act(async () => {
      fireEvent.press(screen.getByText('Crear Cuenta'));
    });
    expect(screen.getByText('La cuenta está desactivada')).toBeTruthy();
  });

  it('debounces an email-availability check and flags it as taken', async () => {
    jest.useFakeTimers();
    mockedAuthService.checkEmail.mockResolvedValue(true);
    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(600);
    });
    jest.useRealTimers();
    await waitFor(() => expect(screen.getByText('Mail en uso')).toBeTruthy());
  });

  it('does not check availability for an incomplete email', async () => {
    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'incomplete');
    expect(mockedAuthService.checkEmail).not.toHaveBeenCalled();
  });

  it('silently ignores a failure checking email availability', async () => {
    jest.useFakeTimers();
    mockedAuthService.checkEmail.mockRejectedValue(new Error('boom'));
    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(600);
    });
    jest.useRealTimers();
    expect(screen.queryByText('Mail en uso')).toBeNull();
  });
});
