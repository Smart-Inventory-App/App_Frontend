import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { authService } from '../services/authService';

const TOKEN_KEY = 'kc_access_token';

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

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    await storage.set(TOKEN_KEY, result.access_token);
    setToken(result.access_token);
  };

  const logout = async () => {
    await storage.delete(TOKEN_KEY);
    setToken(null);
  };

  const register = async (email: string, password: string) => {
    await authService.register(email, password);
  };

  return (
    <AuthContext.Provider value={{ token, isLoading, isAuthenticated: !!token, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
