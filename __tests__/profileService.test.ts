import api from '../src/services/api';
import authApi from '../src/services/authApi';
import { getFirebaseToken } from '../src/services/notificationService';
import { profileService } from '../src/services/profileService';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

jest.mock('../src/services/authApi', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('../src/services/notificationService', () => ({
  getFirebaseToken: jest.fn(),
}));

// El de firebaseService es solo para la web: en el celular siempre devuelve null
const mockWebToken = jest.fn().mockResolvedValue(null);
jest.mock('../src/services/firebaseService', () => ({
  getFirebaseToken: (...args: unknown[]) => mockWebToken(...args),
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedAuthApi = authApi as jest.Mocked<typeof authApi>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('profileService.getProfile', () => {
  it('merges /auth/me and /profile/ into one object', async () => {
    mockedAuthApi.get.mockResolvedValue({ data: { id: 'u1', email: 'a@b.com' } });
    mockedApi.get.mockResolvedValue({ data: { coverageDaysThreshold: 5, expiryDaysThreshold: 3, alertCheckHour: 8, userType: 'individuo' } });

    const profile = await profileService.getProfile();

    expect(profile).toEqual({
      sub: 'u1',
      email: 'a@b.com',
      coverageDaysThreshold: 5,
      expiryDaysThreshold: 3,
      alertCheckHour: 8,
      userType: 'individuo',
    });
    expect(mockedApi.get).toHaveBeenCalledWith('/profile/');
    expect(mockedAuthApi.get).toHaveBeenCalledWith('/auth/me');
  });
});

describe('profileService.updateProfile', () => {
  it('puts the fields and merges the refreshed /auth/me', async () => {
    mockedApi.put.mockResolvedValue({ data: { coverageDaysThreshold: 1, expiryDaysThreshold: 2, alertCheckHour: 9, userType: 'comercio' } });
    mockedAuthApi.get.mockResolvedValue({ data: { id: 'u1', email: 'a@b.com' } });

    const result = await profileService.updateProfile('Ana', 'Perez', 'ana', 1, 2, 9, 'comercio');

    expect(result.sub).toBe('u1');
    expect(mockedApi.put).toHaveBeenCalledWith('/profile/', {
      firstName: 'Ana',
      lastName: 'Perez',
      username: 'ana',
      coverageDaysThreshold: 1,
      expiryDaysThreshold: 2,
      alertCheckHour: 9,
      userType: 'comercio',
    });
  });
});

describe('profileService.activateNotifications', () => {
  it('registers the firebase token and returns true on success', async () => {
    (getFirebaseToken as jest.Mock).mockResolvedValue('fcm-token');
    mockedApi.post.mockResolvedValue({ status: 200 });
    await expect(profileService.activateNotifications()).resolves.toBe(true);
    expect(mockedApi.post).toHaveBeenCalledWith('/profile/register_notification_token', { token: 'fcm-token' });
  });

  it('uses the token of the phone (notificationService), not the web-only one that is always null on the phone', async () => {
    (getFirebaseToken as jest.Mock).mockResolvedValue('fcm-token');
    mockedApi.post.mockResolvedValue({ status: 200 });
    await expect(profileService.activateNotifications()).resolves.toBe(true);
    expect(mockWebToken).not.toHaveBeenCalled();
  });

  it('throws when there is no firebase token', async () => {
    (getFirebaseToken as jest.Mock).mockResolvedValue(null);
    await expect(profileService.activateNotifications()).rejects.toThrow('Failed to get Firebase token');
  });

  it('throws when the backend does not confirm with 200', async () => {
    (getFirebaseToken as jest.Mock).mockResolvedValue('fcm-token');
    mockedApi.post.mockResolvedValue({ status: 500 });
    await expect(profileService.activateNotifications()).rejects.toThrow('Failed to activate notifications');
  });
});

describe('profileService.deactivateNotifications', () => {
  it('unregisters the token and returns true on success', async () => {
    mockedApi.delete.mockResolvedValue({ status: 200 });
    await expect(profileService.deactivateNotifications()).resolves.toBe(true);
    expect(mockedApi.delete).toHaveBeenCalledWith('/profile/unregister_notification_token');
  });

  it('throws when the backend does not confirm with 200', async () => {
    mockedApi.delete.mockResolvedValue({ status: 500 });
    await expect(profileService.deactivateNotifications()).rejects.toThrow('Failed to deactivate notifications');
  });
});

describe('profileService.isUsernameAvailable', () => {
  it('asks the server if the username is free', async () => {
    mockedApi.get.mockResolvedValue({ data: { available: false } });
    await expect(profileService.isUsernameAvailable('anag')).resolves.toBe(false);
    expect(mockedApi.get).toHaveBeenCalledWith('/profile/username-available', { params: { username: 'anag' } });
  });

  it('returns true when it is free', async () => {
    mockedApi.get.mockResolvedValue({ data: { available: true } });
    await expect(profileService.isUsernameAvailable('libre')).resolves.toBe(true);
  });
});
