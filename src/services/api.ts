import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

let _token: string | null = null;

export function setAuthToken(token: string | null) {
  _token = token;
}

export function getAuthToken(): string | null {
  return _token;
}

let _unauthorizedHandler: (() => void) | null = null;

// Se invoca cuando el backend responde 401 con una sesión activa (token vencido o inválido).
export function setUnauthorizedHandler(handler: (() => void) | null) {
  _unauthorizedHandler = handler;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (_token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && _token && _unauthorizedHandler) {
      // Se descarta el token antes de avisar, así los 401 simultáneos no disparan varios cierres.
      _token = null;
      _unauthorizedHandler();
    }
    return Promise.reject(error);
  },
);

export default api;
