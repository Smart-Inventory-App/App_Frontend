import axios from 'axios';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
    return data;
  },

  async register(email: string, password: string): Promise<void> {
    await api.post('/auth/register', { email, password });
  },

  async checkEmail(email: string): Promise<boolean> {
    const { data } = await api.post<{ exists: boolean }>('/auth/check-email', { email });
    return data.exists;
  },

  async forgotPassword(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email });
  },

  async verifyCode(email: string, code: string): Promise<string> {
    const { data } = await api.post<{ reset_token: string }>('/auth/verify-code', { email, code });
    return data.reset_token;
  },

  async resetPassword(reset_token: string, new_password: string): Promise<void> {
    await api.post('/auth/reset-password', { reset_token, new_password });
  },

  async socialCallback(code: string, redirectUri: string, codeVerifier?: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/social-callback', {
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });
    return data;
  },
};
