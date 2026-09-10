import api from './api';
import authApi from './authApi';
import { getFirebaseToken } from './firebaseService';

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
    coverageDaysThreshold?: number,
    expiryDaysThreshold?: number,
    alertCheckHour?: number,
  ): Promise<UserProfile> {
    const [{ data: profile }, { data: me }] = await Promise.all([
      api.put<ProfileFields>('/profile/', {
        firstName,
        lastName,
        username,
        coverageDaysThreshold,
        expiryDaysThreshold,
        alertCheckHour,
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
