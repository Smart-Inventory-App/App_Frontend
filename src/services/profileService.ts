import api from './api';
import authApi from './authApi';
import { getFirebaseToken } from './notificationService';

export type UserType = 'individuo' | 'comercio';

export interface UserProfile {
  sub: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  coverageDaysThreshold: number;
  expiryDaysThreshold: number;
  notificationToken?: string | null;
  alertCheckHour: number;
  userType: UserType;
}

interface MeResponse {
  id: string;
  email: string;
}

interface ProfileFields {
  firstName?: string;
  lastName?: string;
  username?: string;
  coverageDaysThreshold: number;
  expiryDaysThreshold: number;
  alertCheckHour: number;
  userType: UserType;
}

export const profileService = {
  async getProfile(): Promise<UserProfile> {
    const [{ data: me }, { data: profile }] = await Promise.all([
      authApi.get<MeResponse>('/auth/me'),
      api.get<ProfileFields>('/profile/'),
    ]);
    return { sub: me.id, email: me.email, ...profile };
  },

  // Si el nombre de usuario se puede usar (un nombre que ya es el de esta cuenta cuenta como disponible)
  async isUsernameAvailable(username: string): Promise<boolean> {
    const { data } = await api.get<{ available: boolean }>('/profile/username-available', { params: { username } });
    return data.available;
  },

  async updateProfile(
    firstName: string,
    lastName: string,
    username?: string,
    coverageDaysThreshold?: number,
    expiryDaysThreshold?: number,
    alertCheckHour?: number,
    userType?: UserType,
  ): Promise<UserProfile> {
    const [{ data: profile }, { data: me }] = await Promise.all([
      api.put<ProfileFields>('/profile/', {
        firstName,
        lastName,
        username,
        coverageDaysThreshold,
        expiryDaysThreshold,
        alertCheckHour,
        userType,
      }),
      authApi.get<MeResponse>('/auth/me'),
    ]);
    return { sub: me.id, email: me.email, ...profile };
  },

  async activateNotifications(): Promise<boolean> {
    const notificationToken = await getFirebaseToken();
    if (!notificationToken) {
      throw new Error('Failed to get Firebase token');
    }
    const response = await api.post('/profile/register_notification_token', { "token": notificationToken });
    if (response.status !== 200) {
      throw new Error('Failed to activate notifications');
    }
    return true;
  },

  async deactivateNotifications(): Promise<boolean> {
    const response = await api.delete('/profile/unregister_notification_token');
    if (response.status !== 200) {
      throw new Error('Failed to deactivate notifications');
    }
    return true;
  }
};
