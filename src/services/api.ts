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

// Sesión vencida o inválida: un 401 con sesión activa cierra la sesión. Lo usan todas las instancias de axios con token
// (la del backend y la del servicio de auth), así no importa cuál de los dos servicios detecte primero el vencimiento.
export function handleUnauthorized(error: AxiosError) {
  if (error.response?.status === 401 && _token && _unauthorizedHandler) {
    // Se descarta el token antes de avisar, así los 401 simultáneos no disparan varios cierres.
    _token = null;
    _unauthorizedHandler();
  }
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
    handleUnauthorized(error);
    return Promise.reject(error);
  },
);

export default api;
