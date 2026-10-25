import axios from 'axios';
import { getFirebaseToken } from './firebaseService';


const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL;

const api = axios.create({
  baseURL: AUTH_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface EmailStatus {
  exists: boolean;
  /** Solo viene si el email tiene cuenta. `false` = cuenta creada con Google que todavía no definió contraseña. */
  password_set?: boolean;
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const firebase_token = await getFirebaseToken();
    console.log("firebase token: ", firebase_token)
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password, firebase_token });
    return data;
  },

  async register(email: string, password: string): Promise<void> {
    await api.post('/auth/register', { email, password });
  },

  // Si el email tiene cuenta y si esa cuenta ya tiene contraseña (las creadas con Google todavía no)
  async getEmailStatus(email: string): Promise<EmailStatus> {
    const { data } = await api.post<EmailStatus>('/auth/check-email', { email });
    return data;
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

  async checkNewPassword(reset_token: string, new_password: string): Promise<boolean> {
    const { data } = await api.post<{ different: boolean }>('/auth/check-new-password', { reset_token, new_password });
    return data.different;
  },

  // Se manda el idToken de Google: el servidor lo verifica y comprueba que fue emitido para esta app
  async googleLogin(idToken: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/google', { id_token: idToken });
    return data;
  },
};
