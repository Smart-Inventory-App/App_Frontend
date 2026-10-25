import React from 'react';
import { Colors } from '../src/constants/colors';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { GoogleSignin, isErrorWithCode } from '@react-native-google-signin/google-signin';
import { useAuth } from '@/context/AuthContext';
import { authService } from '../src/services/authService';

// GOOGLE_ENABLED is computed once at module load from this env var, so it
// must be set before `app/(auth)/login` is required — that's why this branch
// gets its own test file instead of living in login.test.tsx.
// Only the Web client id is needed: Google recognizes the Android client by package and signing key.
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';
delete process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    getTokens: jest.fn(),
  },
  isErrorWithCode: jest.fn(() => false),
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));

jest.mock('../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../src/services/authService', () => ({
  authService: { getEmailStatus: jest.fn() },
}));

// `import` statements (unlike plain `require`) are hoisted above the `process.env`
// assignments above by the ES module -> CommonJS transform, which would make
// GOOGLE_ENABLED evaluate to false again. A plain `require()` keeps this in place.
const LoginScreen = require('../app/(auth)/login').default;

// Captured immediately: `beforeEach`'s `jest.clearAllMocks()` would otherwise wipe
// this call, since `GoogleSignin.configure(...)` only runs once, at module load.
const configureCallAtLoad = (GoogleSignin.configure as jest.Mock).mock.calls[0];

const mockLoginWithGoogle = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (isErrorWithCode as unknown as jest.Mock).mockReturnValue(false);
  (useAuth as jest.Mock).mockReturnValue({ login: jest.fn(), loginWithGoogle: mockLoginWithGoogle });
  (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
  (authService.getEmailStatus as jest.Mock).mockResolvedValue({ exists: true, password_set: true });
});

describe('LoginScreen - Google sign-in (enabled)', () => {
  it('configures GoogleSignin at module load', () => {
    expect(configureCallAtLoad).toEqual([{ webClientId: 'web-client-id' }]);
  });

  it('renders the Google button', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Continuar con Google')).toBeTruthy();
  });

  it('signs in with Google, sending the id token, and navigates to the app', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'success', data: { idToken: 'g-id' } });
    mockLoginWithGoogle.mockResolvedValue(undefined);
    render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar con Google'));
    });
    expect(mockLoginWithGoogle).toHaveBeenCalledWith('g-id');
    expect(GoogleSignin.getTokens).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(app)/');
  });

  it('asks the library for the id token when the sign in did not bring it', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'success', data: { idToken: null } });
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({ idToken: 'g-id-2', accessToken: 'g-access' });
    mockLoginWithGoogle.mockResolvedValue(undefined);
    render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar con Google'));
    });
    expect(mockLoginWithGoogle).toHaveBeenCalledWith('g-id-2');
  });

  it('never sends the access token, only the id token', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'success', data: { idToken: 'g-id' } });
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({ idToken: 'otro', accessToken: 'g-access' });
    mockLoginWithGoogle.mockResolvedValue(undefined);
    render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar con Google'));
    });
    expect(mockLoginWithGoogle).not.toHaveBeenCalledWith('g-access');
  });

  it('silently returns when the library reports that the user closed the Google window', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'cancelled', data: null });
    render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar con Google'));
    });
    expect(mockLoginWithGoogle).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.queryByText('Error al iniciar sesión con Google')).toBeNull();
  });

  it('silently returns when the user cancels the Google picker', async () => {
    (isErrorWithCode as unknown as jest.Mock).mockReturnValue(true);
    (GoogleSignin.signIn as jest.Mock).mockRejectedValue({ code: 'SIGN_IN_CANCELLED' });
    render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar con Google'));
    });
    expect(mockLoginWithGoogle).not.toHaveBeenCalled();
  });

  it('shows an error when there is no id token', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'success', data: { idToken: null } });
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({ idToken: null, accessToken: 'g-access' });
    render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar con Google'));
    });
    expect(screen.getByText('Error al iniciar sesión con Google')).toBeTruthy();
  });

  it('shows the backend detail message when the Google login call fails', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'success', data: { idToken: 'g-id' } });
    mockLoginWithGoogle.mockRejectedValue({ response: { data: { detail: 'auth.google_invalid_token' } } });
    render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar con Google'));
    });
    expect(screen.getByText('Token de Google inválido')).toBeTruthy();
  });
});

describe('LoginScreen - Google sign-in, other errors of the server', () => {
  it('says that Google is not available when the server has no client id', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'success', data: { idToken: 'g-id' } });
    mockLoginWithGoogle.mockRejectedValue({ response: { data: { detail: 'auth.google_not_configured' } } });
    render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar con Google'));
    });
    expect(screen.getByText('El inicio de sesión con Google no está disponible por el momento')).toBeTruthy();
  });
});

describe('LoginScreen - Google button, texts and accounts created with Google', () => {
  it('shows the button with only the Web client id defined', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Continuar con Google')).toBeTruthy();
    expect(screen.getByText('o')).toBeTruthy();
  });

  it('says it is connecting while the Google window is open', async () => {
    let finish: (value: any) => void = () => {};
    (GoogleSignin.signIn as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<LoginScreen />);
    fireEvent.press(screen.getByText('Continuar con Google'));
    await act(async () => {});
    expect(screen.getByText('Conectando...')).toBeTruthy();
    await act(async () => { finish({ type: 'cancelled', data: null }); });
    expect(screen.getByText('Continuar con Google')).toBeTruthy();
  });

  it('keeps the Google button behind the pop up for an account created with Google', async () => {
    (authService.getEmailStatus as jest.Mock).mockResolvedValue({ exists: true, password_set: false });
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), 'g@b.com');
    await act(async () => { fireEvent.press(screen.getByText('Continuar')); });
    expect(screen.getByTestId('confirm-card')).toBeTruthy();
    expect(screen.getByText('Continuar con Google')).toBeTruthy();
    expect(screen.getByTestId('confirm-accept')).toBeTruthy();
  });
});

describe('LoginScreen - Google button icon', () => {
  it('paints the G with the main color of the app, not red, and grey while connecting', async () => {
    render(<LoginScreen />);
    expect(screen.UNSAFE_getByProps({ name: 'logo-google' }).props.color).toBe(Colors.primary);
    let finish: (value: any) => void = () => {};
    (GoogleSignin.signIn as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    fireEvent.press(screen.getByText('Continuar con Google'));
    await act(async () => {});
    expect(screen.UNSAFE_getByProps({ name: 'logo-google' }).props.color).toBe(Colors.textSecondary);
    await act(async () => { finish({ type: 'cancelled', data: null }); });
  });
});
