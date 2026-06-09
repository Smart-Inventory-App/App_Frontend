import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

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

api.interceptors.request.use((config: AxiosRequestConfig) => {
  if (_token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => Promise.reject(error),
);

export default api;
