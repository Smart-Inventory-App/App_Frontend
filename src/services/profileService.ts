import api from './api';
import authApi from './authApi';

export interface UserProfile {
  sub: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

interface MeResponse {
  id: string;
  email: string;
}

interface ProfileFields {
  firstName?: string;
  lastName?: string;
  username?: string;
}

export const profileService = {
  async getProfile(): Promise<UserProfile> {
    const [{ data: me }, { data: profile }] = await Promise.all([
      authApi.get<MeResponse>('/auth/me'),
      api.get<ProfileFields>('/profile/'),
    ]);
    return { sub: me.id, email: me.email, ...profile };
  },

  async updateProfile(firstName: string, lastName: string, username?: string): Promise<UserProfile> {
    const [{ data: profile }, { data: me }] = await Promise.all([
      api.put<ProfileFields>('/profile/', { firstName, lastName, username }),
      authApi.get<MeResponse>('/auth/me'),
    ]);
    return { sub: me.id, email: me.email, ...profile };
  },
};
