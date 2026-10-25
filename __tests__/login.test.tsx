import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from '../app/(auth)/login';
import { useAuth } from '@/context/AuthContext';
import { authService } from '../src/services/authService';
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

jest.mock('../src/services/authService', () => ({
  authService: { getEmailStatus: jest.fn() },
}));

const mockLogin = jest.fn();
const mockedAuthService = authService as jest.Mocked<typeof authService>;

// Al tocar «Continuar» con el email, se consulta si la cuenta ya tiene contraseña antes de pasar al siguiente paso
const continueWithEmail = () => act(async () => { fireEvent.press(screen.getByText('Continuar')); });

beforeEach(() => {
  jest.clearAllMocks();
  clearFlashMessage();
  (useAuth as jest.Mock).mockReturnValue({ login: mockLogin, loginWithGoogle: jest.fn() });
  mockedAuthService.getEmailStatus.mockResolvedValue({ exists: true, password_set: true });
});

describe('LoginScreen', () => {
  it('shows the account-created banner after registering and hides it when dismissed', async () => {
    setFlashMessage('register.accountCreated');
    render(<LoginScreen />);
    expect(screen.getByText('La cuenta ha sido creada exitosamente')).toBeTruthy();
    fireEvent.press(screen.getByText('La cuenta ha sido creada exitosamente'));
    await waitFor(() => expect(screen.queryByText('La cuenta ha sido creada exitosamente')).toBeNull());
  });

  it('shows the session-closed message after logging out', () => {
    setFlashMessage('login.sessionClosed');
    render(<LoginScreen />);
    expect(screen.getByText('Se ha cerrado sesión')).toBeTruthy();
  });

  it('shows the session-expired message when the session ended on its own', () => {
    setFlashMessage('login.sessionExpired');
    render(<LoginScreen />);
    expect(screen.getByText('La sesión ha expirado')).toBeTruthy();
    expect(screen.queryByText('Se ha cerrado sesión')).toBeNull();
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

  it('hides the Google sign-in button by default', () => {
    render(<LoginScreen />);
    expect(screen.queryByText('Continuar con Google')).toBeNull();
  });

  it('does not show the banner when there is no pending message', () => {
    render(<LoginScreen />);
    expect(screen.queryByText('La cuenta ha sido creada exitosamente')).toBeNull();
  });

  it('does not advance to the password step with an empty email', async () => {
    render(<LoginScreen />);
    await continueWithEmail();
    expect(screen.queryByPlaceholderText('Contraseña')).toBeNull();
  });

  it('advances to the password step once an email is entered', async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    await continueWithEmail();
    expect(screen.getByPlaceholderText('Contraseña')).toBeTruthy();
    expect(screen.getByText('a@b.com')).toBeTruthy();
  });

  it('goes back to the email step, clearing password and error', async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    await continueWithEmail();
    fireEvent.press(screen.getByText('a@b.com'));
    expect(screen.getByPlaceholderText('email@example.com')).toBeTruthy();
  });

  it('toggles password visibility', async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    await continueWithEmail();
    const eyeIcon = screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'eye');
    fireEvent.press(eyeIcon.parent);
  });

  it('logs in successfully and navigates to the app', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    await continueWithEmail();
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
    await continueWithEmail();
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
    await continueWithEmail();
    fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), 'pw123456');
    await act(async () => {
      fireEvent.press(screen.getAllByText('Continuar')[0]);
    });
    fireEvent.changeText(screen.getByPlaceholderText('Contraseña'), 'other');
    expect(screen.queryByText('Email o contraseña incorrectos')).toBeNull();
  });

  it('navigates to register and forgot-password', async () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByText('Crear una cuenta'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/register');

    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
    await continueWithEmail();
    fireEvent.press(screen.getByText('Olvidé mi contraseña'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/forgot-password', params: { email: 'a@b.com' } });
  });
});

describe('LoginScreen - accounts created with Google', () => {
  const typeEmail = () => fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'a@b.com');
  const NOTICE = 'Esta cuenta se creó con Google y todavía no tiene contraseña. Ingresá con Google o creá una contraseña.';

  it('asks the server about the email before moving on', async () => {
    render(<LoginScreen />);
    typeEmail();
    await continueWithEmail();
    expect(mockedAuthService.getEmailStatus).toHaveBeenCalledWith('a@b.com');
    expect(screen.getByPlaceholderText('Contraseña')).toBeTruthy();
  });

  it('explains in a pop up that the account was created with Google, staying in the email step', async () => {
    mockedAuthService.getEmailStatus.mockResolvedValue({ exists: true, password_set: false });
    render(<LoginScreen />);
    typeEmail();
    await continueWithEmail();
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(screen.getByTestId('confirm-card')).toBeTruthy();
    expect(screen.getByText('Crear contraseña')).toBeTruthy();
    expect(screen.getByText('Volver al login')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('confirm-accept').props.style).width).toBe('100%');
    expect(StyleSheet.flatten(screen.getByTestId('confirm-cancel').props.style).width).toBe('100%');
    expect(screen.queryByPlaceholderText('Contraseña')).toBeNull();
  });

  it('takes the email to the recovery screen with "Crear contraseña" and closes the pop up', async () => {
    mockedAuthService.getEmailStatus.mockResolvedValue({ exists: true, password_set: false });
    render(<LoginScreen />);
    typeEmail();
    await continueWithEmail();
    fireEvent.press(screen.getByTestId('confirm-accept'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/forgot-password', params: { email: 'a@b.com' } });
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('closes the pop up with "Volver al login" and keeps the email, without navigating', async () => {
    mockedAuthService.getEmailStatus.mockResolvedValue({ exists: true, password_set: false });
    render(<LoginScreen />);
    typeEmail();
    await continueWithEmail();
    fireEvent.press(screen.getByTestId('confirm-cancel'));
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('a@b.com')).toBeTruthy();
  });

  it('closes the pop up when tapping outside of it', async () => {
    mockedAuthService.getEmailStatus.mockResolvedValue({ exists: true, password_set: false });
    render(<LoginScreen />);
    typeEmail();
    await continueWithEmail();
    fireEvent.press(screen.getByTestId('confirm-backdrop'));
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('goes on to the password step for an account that has a password', async () => {
    render(<LoginScreen />);
    typeEmail();
    await continueWithEmail();
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.getByPlaceholderText('Contraseña')).toBeTruthy();
  });

  it('keeps the usual behavior for an email without account: it goes to the password step', async () => {
    mockedAuthService.getEmailStatus.mockResolvedValue({ exists: false });
    render(<LoginScreen />);
    typeEmail();
    await continueWithEmail();
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.getByPlaceholderText('Contraseña')).toBeTruthy();
  });

  it('goes on to the password step when the account can not be checked', async () => {
    mockedAuthService.getEmailStatus.mockRejectedValue(new Error('sin red'));
    render(<LoginScreen />);
    typeEmail();
    await continueWithEmail();
    expect(screen.getByPlaceholderText('Contraseña')).toBeTruthy();
  });

  it('does not ask twice when the button is pressed again while it is checking', async () => {
    let finish: (value: any) => void = () => {};
    mockedAuthService.getEmailStatus.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<LoginScreen />);
    typeEmail();
    fireEvent.press(screen.getByText('Continuar'));
    fireEvent.press(screen.getByText('Continuar'));
    expect(mockedAuthService.getEmailStatus).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ exists: true, password_set: true }); });
    expect(screen.getByPlaceholderText('Contraseña')).toBeTruthy();
  });
});
