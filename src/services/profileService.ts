import api from './api';
import authApi from './authApi';
import { getFirebaseToken } from './firebaseService';

export interface UserProfile {
  sub: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  lowStockThreshold: number;
  expiryDaysThreshold: number;
  notificationToken?: string | null;
}

interface MeResponse {
  id: string;
  email: string;
}

interface ProfileFields {
  firstName?: string;
  lastName?: string;
  username?: string;
  lowStockThreshold: number;
  expiryDaysThreshold: number;
}

export const profileService = {
  async getProfile(): Promise<UserProfile> {
    const [{ data: me }, { data: profile }] = await Promise.all([
      authApi.get<MeResponse>('/auth/me'),
      api.get<ProfileFields>('/profile/'),
    ]);
    return { sub: me.id, email: me.email, ...profile };
  },

  async updateProfile(
    firstName: string,
    lastName: string,
    username?: string,
    lowStockThreshold?: number,
    expiryDaysThreshold?: number,
  ): Promise<UserProfile> {
    const [{ data: profile }, { data: me }] = await Promise.all([
      api.put<ProfileFields>('/profile/', {
        firstName,
        lastName,
        username,
        lowStockThreshold,
        expiryDaysThreshold,
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
  }
};
