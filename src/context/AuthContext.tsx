import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { authService } from '../services/authService';
import { setAuthToken } from '../services/api';
import {
  getFirebaseToken,
  registerTokenWithBackend,
  setupForegroundHandler,
  subscribeToTokenRefresh,
} from '../services/notificationService';

const TOKEN_KEY = 'auth_access_token';

// expo-secure-store doesn't work on web — fall back to AsyncStorage
const storage = {
  get: (key: string) =>
    Platform.OS === 'web'
      ? AsyncStorage.getItem(key)
      : SecureStore.getItemAsync(key),
  set: (key: string, value: string) =>
    Platform.OS === 'web'
      ? AsyncStorage.setItem(key, value)
      : SecureStore.setItemAsync(key, value),
  delete: (key: string) =>
    Platform.OS === 'web'
      ? AsyncStorage.removeItem(key)
      : SecureStore.deleteItemAsync(key),
};

interface AuthState {
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (accessToken: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const unsubscribeTokenRefresh = useRef<(() => void) | null>(null);

  useEffect(() => {
    setupForegroundHandler();
    storage.get(TOKEN_KEY)
      .then((stored) => {
        setAuthToken(stored ?? null);
        setToken(stored ?? null);
        if (stored) {
          // Renovar token FCM al arrancar si ya hay sesión
          unsubscribeTokenRefresh.current = subscribeToTokenRefresh();
          getFirebaseToken().then((fcm) => { if (fcm) registerTokenWithBackend(fcm); });
        }
      })
      .finally(() => setIsLoading(false));
    return () => unsubscribeTokenRefresh.current?.();
  }, []);

  const _afterLogin = async (accessToken: string) => {
    await storage.set(TOKEN_KEY, accessToken);
    setAuthToken(accessToken);
    setToken(accessToken);
    // Registrar token FCM después del login (no bloquea)
    unsubscribeTokenRefresh.current?.();
    unsubscribeTokenRefresh.current = subscribeToTokenRefresh();
    getFirebaseToken().then((fcm) => { if (fcm) registerTokenWithBackend(fcm); });
  };

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    await _afterLogin(result.access_token);
  };

  const logout = async () => {
    unsubscribeTokenRefresh.current?.();
    unsubscribeTokenRefresh.current = null;
    await storage.delete(TOKEN_KEY);
    setAuthToken(null);
    setToken(null);
  };

  const register = async (email: string, password: string) => {
    await authService.register(email, password);
  };

  const loginWithGoogle = async (accessToken: string) => {
    const result = await authService.googleLogin(accessToken);
    await _afterLogin(result.access_token);
  };

  return (
    <AuthContext.Provider value={{ token, isLoading, isAuthenticated: !!token, login, logout, register, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
