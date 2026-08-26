import api from './api';
import authApi from './authApi';

export interface UserProfile {
  sub: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  coverageDaysThreshold: number;
  expiryDaysThreshold: number;
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
};
