import axios, { InternalAxiosRequestConfig } from 'axios';
import { getAuthToken } from './api';

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

export default authApi;
