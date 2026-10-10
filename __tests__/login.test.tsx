import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from '../app/(auth)/login';
import { useAuth } from '@/context/AuthContext';
import { clearFlashMessage, setFlashMessage } from '@/utils/flashMessage';

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: any[]) => mockReplace(...args),
    push: (...args: any[]) => mockPush(...args),
  },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn(), getTokens: jest.fn() },
  isErrorWithCode: jest.fn(() => false),
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));

jest.mock('../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockLogin = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  clearFlashMessage();
  (useAuth as jest.Mock).mockReturnValue({ login: mockLogin, loginWithGoogle: jest.fn() });
});

describe('LoginScreen', () => {
  it('shows the account-created banner after registering and hides it when dismissed', async () => {
    setFlashMessage('register.accountCreated');
    render(<LoginScreen />);
    expect(screen.getByText('La cuenta ha sido creada exitosamente')).toBeTruthy();
    fireEvent.press(screen.getByText('La cuenta ha sido creada exitosamente'));
    await waitFor(() => expect(screen.queryByText('La cuenta ha sido creada exitosamente')).toBeNull());
  });

  it('hides the account-created banner on its own after a few seconds', async () => {
    jest.useFakeTimers();
    setFlashMessage('register.accountCreated');
    render(<LoginScreen />);
    expect(screen.getByText('La cuenta ha sido creada exitosamente')).toBeTruthy();
    await act(async () => { await jest.advanceTimersByTimeAsync(5500); });
    expect(screen.queryByText('La cuenta ha sido creada exitosamente')).toBeNull();
    jest.useRealTimers();
  });

  it('does not show the banner when there is no pending message', () => {
    render(<LoginScreen />);
    expect(screen.queryByText('La cuenta ha sido creada exitosamente')).toBeNull();
  });

  it('does not advance to the password step with an empty email', () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByText('Continuar'));
    expect(screen.queryByPlaceholderText('Contraseña')).toBeNull();
  });

  it('advances to the password step once an email is entered', () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    fireEvent.press(screen.getByText('Continuar'));
    expect(screen.getByPlaceholderText('Contraseña')).toBeTruthy();
    expect(screen.getByText('a@b.com')).toBeTruthy();
  });

  it('goes back to the email step, clearing password and error', () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    fireEvent.press(screen.getByText('Continuar'));
    fireEvent.press(screen.getByText('a@b.com'));
    expect(screen.getByPlaceholderText('email@example.com')).toBeTruthy();
  });

  it('toggles password visibility', () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    fireEvent.press(screen.getByText('Continuar'));
    const eyeIcon = screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'eye');
    fireEvent.press(eyeIcon.parent);
  });

  it('logs in successfully and navigates to the app', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    fireEvent.press(screen.getByText('Continuar'));
    fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), 'pw123456');
    await act(async () => {
      fireEvent.press(screen.getAllByText('Continuar')[0]);
    });
    expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'pw123456');
    expect(mockReplace).toHaveBeenCalledWith('/(app)/');
  });

  it('shows a translated error when login fails', async () => {
    mockLogin.mockRejectedValue({ response: { data: { detail: 'auth.invalid_credentials' } } });
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    fireEvent.press(screen.getByText('Continuar'));
    fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), 'pw123456');
    await act(async () => {
      fireEvent.press(screen.getAllByText('Continuar')[0]);
    });
    expect(screen.getByText('Email o contraseña incorrectos')).toBeTruthy();
  });

  it('clears the error as soon as the password changes again', async () => {
    mockLogin.mockRejectedValue({ response: { data: { detail: 'auth.invalid_credentials' } } });
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    fireEvent.press(screen.getByText('Continuar'));
    fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), 'pw123456');
    await act(async () => {
      fireEvent.press(screen.getAllByText('Continuar')[0]);
    });
    fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), 'other');
    expect(screen.queryByText('Email o contraseña incorrectos')).toBeNull();
  });

  it('navigates to register and forgot-password', () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByText('Crear una cuenta'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/register');

    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    fireEvent.press(screen.getByText('Continuar'));
    fireEvent.press(screen.getByText('Olvidé mi contraseña'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/forgot-password');
  });
});
