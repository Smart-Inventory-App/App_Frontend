import api from './api';

export interface UserProfile {
  sub: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export const profileService = {
  async getProfile(): Promise<UserProfile> {
    const { data } = await api.get<UserProfile>('/auth/profile');
    return data;
  },

  async updateProfile(firstName: string, lastName: string, username?: string): Promise<UserProfile> {
    const { data } = await api.put<UserProfile>('/auth/profile', { firstName, lastName, username });
    return data;
  },
};
