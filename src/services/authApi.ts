import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { getAuthToken, handleUnauthorized } from './api';

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL;

const authApi = axios.create({
  baseURL: AUTH_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

authApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Si el servicio de auth rechaza el token (vencido o inválido), se cierra la sesión y se vuelve al login
authApi.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    handleUnauthorized(error);
    return Promise.reject(error);
  },
);

export default authApi;
