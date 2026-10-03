import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { GoogleSignin, isErrorWithCode } from '@react-native-google-signin/google-signin';
import { useAuth } from '@/context/AuthContext';

// GOOGLE_ENABLED is computed once at module load from these env vars, so they
// must be set before `app/(auth)/login` is required — that's why this branch
// gets its own test file instead of living in login.test.tsx.
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';
process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = 'android-client-id';

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
});

describe('LoginScreen - Google sign-in (enabled)', () => {
  it('configures GoogleSignin at module load', () => {
    expect(configureCallAtLoad).toEqual([{ webClientId: 'web-client-id' }]);
  });

  it('renders the Google button', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Continuar con Google')).toBeTruthy();
  });

  it('signs in with Google and navigates to the app', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue(undefined);
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({ accessToken: 'g-access' });
    mockLoginWithGoogle.mockResolvedValue(undefined);
    render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar con Google'));
    });
    expect(mockLoginWithGoogle).toHaveBeenCalledWith('g-access');
    expect(router.replace).toHaveBeenCalledWith('/(app)/');
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

  it('shows an error when there is no access token', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue(undefined);
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({ accessToken: null });
    render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar con Google'));
    });
    expect(screen.getByText('Error al iniciar sesión con Google')).toBeTruthy();
  });

  it('shows the backend detail message when the Google login call fails', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue(undefined);
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({ accessToken: 'g-access' });
    mockLoginWithGoogle.mockRejectedValue({ response: { data: { detail: 'auth.google_invalid_token' } } });
    render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Continuar con Google'));
    });
    expect(screen.getByText('Token de Google inválido')).toBeTruthy();
  });
});
