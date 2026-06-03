import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { authService } from '../services/authService';

const TOKEN_KEY = 'kc_access_token';
const REFRESH_KEY = 'kc_refresh_token';

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
  loginWithGoogle: (code: string, redirectUri: string, codeVerifier?: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    storage.get(TOKEN_KEY)
      .then((stored) => setToken(stored ?? null))
      .finally(() => setIsLoading(false));
  }, []);

  const _storeTokens = async (accessToken: string, refreshToken?: string) => {
    await storage.set(TOKEN_KEY, accessToken);
    if (refreshToken) await storage.set(REFRESH_KEY, refreshToken);
    setToken(accessToken);
  };

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    await _storeTokens(result.access_token, result.refresh_token);
  };

  const logout = async () => {
    const refreshToken = await storage.get(REFRESH_KEY);
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch {
        // Si falla el logout en Keycloak igual limpiamos la sesión local
      }
    }
    await storage.delete(TOKEN_KEY);
    await storage.delete(REFRESH_KEY);
    setToken(null);
  };

  const register = async (email: string, password: string) => {
    await authService.register(email, password);
  };

  const loginWithGoogle = async (code: string, redirectUri: string, codeVerifier?: string) => {
    const result = await authService.socialCallback(code, redirectUri, codeVerifier);
    await _storeTokens(result.access_token, result.refresh_token);
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
