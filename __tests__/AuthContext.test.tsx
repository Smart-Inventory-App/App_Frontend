import React from 'react';
import { Platform, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { authService } from '@/services/authService';
import { setAuthToken, setUnauthorizedHandler } from '@/services/api';
import { clearFlashMessage, peekFlashMessage } from '@/utils/flashMessage';
import { markWelcomeSeen, resetWelcome, shouldWelcome } from '@/utils/welcomeState';
import {
  getFirebaseToken,
  registerTokenWithBackend,
  subscribeToTokenRefresh,
} from '@/services/notificationService';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@/services/authService', () => ({
  authService: {
    login: jest.fn(),
    register: jest.fn(),
    googleLogin: jest.fn(),
  },
}));

jest.mock('@/services/api', () => ({
  setAuthToken: jest.fn(),
  setUnauthorizedHandler: jest.fn(),
}));

const mockedAuth = authService as jest.Mocked<typeof authService>;

function Probe() {
  const { token, isLoading, isAuthenticated, login, logout, register, loginWithGoogle } = useAuth();
  return (
    <>
      <Text testID="loading">{String(isLoading)}</Text>
      <Text testID="authenticated">{String(isAuthenticated)}</Text>
      <Text testID="token">{token ?? ''}</Text>
      <Text testID="login" onPress={() => login('a@b.com', 'pw')}>login</Text>
      <Text testID="logout" onPress={() => logout()}>logout</Text>
      <Text testID="register" onPress={() => register('a@b.com', 'pw')}>register</Text>
      <Text testID="google" onPress={() => loginWithGoogle('g-token')}>google</Text>
    </>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
});

describe('AuthContext', () => {
  it('throws when useAuth is used outside the provider', () => {
    const BadProbe = () => { useAuth(); return null; };
    expect(() => render(<BadProbe />)).toThrow('useAuth must be used inside AuthProvider');
  });

  it('starts unauthenticated with no stored token', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));
    expect(screen.getByTestId('authenticated').props.children).toBe('false');
  });

  it('restores a stored token on mount and refreshes the FCM subscription', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
    (getFirebaseToken as jest.Mock).mockResolvedValue('fcm-1');
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('authenticated').props.children).toBe('true'));
    expect(setAuthToken).toHaveBeenCalledWith('stored-token');
    expect(subscribeToTokenRefresh).toHaveBeenCalled();
    await waitFor(() => expect(registerTokenWithBackend).toHaveBeenCalledWith('fcm-1'));
  });

  it('logs in, stores the token and marks the user authenticated', async () => {
    mockedAuth.login.mockResolvedValue({ access_token: 'new-token', token_type: 'bearer' });
    (getFirebaseToken as jest.Mock).mockResolvedValue(null);
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('login'));
    });

    expect(mockedAuth.login).toHaveBeenCalledWith('a@b.com', 'pw');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_access_token', 'new-token');
    expect(screen.getByTestId('authenticated').props.children).toBe('true');
    expect(screen.getByTestId('token').props.children).toBe('new-token');
  });

  it('logs out and clears the stored token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('authenticated').props.children).toBe('true'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('logout'));
    });

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_access_token');
    expect(screen.getByTestId('authenticated').props.children).toBe('false');
  });

  it('leaves a "session closed" message for the login screen when logging out', async () => {
    clearFlashMessage();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('authenticated').props.children).toBe('true'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('logout'));
    });
    expect(peekFlashMessage()).toBe('login.sessionClosed');
    clearFlashMessage();
  });

  it('logs out automatically when the API reports an expired session', async () => {
    clearFlashMessage();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('authenticated').props.children).toBe('true'));
    const handler = (setUnauthorizedHandler as jest.Mock).mock.calls.find((c) => typeof c[0] === 'function')![0];
    await act(async () => {
      handler();
    });
    expect(screen.getByTestId('authenticated').props.children).toBe('false');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_access_token');
    expect(peekFlashMessage()).toBe('login.sessionExpired');
    clearFlashMessage();
  });

  it('unregisters the expired-session handler on unmount', async () => {
    const { unmount } = render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));
    unmount();
    expect(setUnauthorizedHandler).toHaveBeenLastCalledWith(null);
  });

  it('registers a new account without logging in', async () => {
    mockedAuth.register.mockResolvedValue(undefined);
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('register'));
    });
    expect(mockedAuth.register).toHaveBeenCalledWith('a@b.com', 'pw');
    expect(screen.getByTestId('authenticated').props.children).toBe('false');
  });

  it('logs in with google', async () => {
    mockedAuth.googleLogin.mockResolvedValue({ access_token: 'g-access', token_type: 'bearer' });
    (getFirebaseToken as jest.Mock).mockResolvedValue(null);
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('google'));
    });
    expect(mockedAuth.googleLogin).toHaveBeenCalledWith('g-token');
    expect(screen.getByTestId('token').props.children).toBe('g-access');
  });

  it('falls back to AsyncStorage on web', async () => {
    const originalOS = Platform.OS;
    (Platform as any).OS = 'web';
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));
    (Platform as any).OS = originalOS;
  });
});

describe('AuthContext - welcome message', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  });

  it('welcomes the user again after logging in', async () => {
    mockedAuth.login.mockResolvedValue({ access_token: 'new-token', token_type: 'bearer' });
    (getFirebaseToken as jest.Mock).mockResolvedValue(null);
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));
    markWelcomeSeen();
    expect(shouldWelcome()).toBe(false);

    await act(async () => {
      fireEvent.press(screen.getByTestId('login'));
    });

    expect(shouldWelcome()).toBe(true);
  });

  it('welcomes the user again after logging in with Google', async () => {
    mockedAuth.googleLogin.mockResolvedValue({ access_token: 'g-new', token_type: 'bearer' });
    (getFirebaseToken as jest.Mock).mockResolvedValue(null);
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));
    markWelcomeSeen();

    await act(async () => {
      fireEvent.press(screen.getByTestId('google'));
    });

    expect(shouldWelcome()).toBe(true);
  });

  it('starts the welcome again when the session is closed', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('authenticated').props.children).toBe('true'));
    markWelcomeSeen();

    await act(async () => {
      fireEvent.press(screen.getByTestId('logout'));
    });

    expect(shouldWelcome()).toBe(true);
    resetWelcome();
  });

  it('does not change the welcome when only restoring a stored session', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
    markWelcomeSeen();
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('authenticated').props.children).toBe('true'));
    expect(shouldWelcome()).toBe(false);
    resetWelcome();
  });
});
