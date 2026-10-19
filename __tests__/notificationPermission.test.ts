import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  ensureAndroidChannel,
  ensureNotificationPermission,
  getNotificationPermission,
  requestNotificationPermission,
} from '../src/services/notificationPermission';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { MAX: 5 },
}));

const mocked = Notifications as jest.Mocked<typeof Notifications>;
const perms = (granted: boolean, canAskAgain: boolean) => ({ granted, canAskAgain, status: granted ? 'granted' : 'denied' }) as any;

const originalOS = Platform.OS;
const originalNotification = (globalThis as any).Notification;

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as any).OS = 'android';
});

afterEach(() => {
  (Platform as any).OS = originalOS;
  (globalThis as any).Notification = originalNotification;
});

describe('getNotificationPermission', () => {
  it('says the permission is granted when the phone has it', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(perms(true, true));
    await expect(getNotificationPermission()).resolves.toEqual({ granted: true, canAskAgain: true });
  });

  it('says it can still be asked when it was never answered or denied once', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(perms(false, true));
    await expect(getNotificationPermission()).resolves.toEqual({ granted: false, canAskAgain: true });
  });

  it('says it can not be asked again when the user chose to never allow it', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(perms(false, false));
    await expect(getNotificationPermission()).resolves.toEqual({ granted: false, canAskAgain: false });
  });

  it('reads the status when the answer has no granted flag, and assumes it can be asked', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
    await expect(getNotificationPermission()).resolves.toEqual({ granted: true, canAskAgain: true });
    mocked.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);
    await expect(getNotificationPermission()).resolves.toEqual({ granted: false, canAskAgain: true });
  });

  it('does not bother the user when the permission can not be read', async () => {
    mocked.getPermissionsAsync.mockRejectedValue(new Error('boom'));
    await expect(getNotificationPermission()).resolves.toEqual({ granted: true, canAskAgain: true });
  });

  it('reads the permission of the browser on the web', async () => {
    (Platform as any).OS = 'web';
    (globalThis as any).Notification = { permission: 'granted' };
    await expect(getNotificationPermission()).resolves.toEqual({ granted: true, canAskAgain: false });
    (globalThis as any).Notification = { permission: 'default' };
    await expect(getNotificationPermission()).resolves.toEqual({ granted: false, canAskAgain: true });
    (globalThis as any).Notification = { permission: 'denied' };
    await expect(getNotificationPermission()).resolves.toEqual({ granted: false, canAskAgain: false });
  });

  it('assumes it is granted on a web without notifications', async () => {
    (Platform as any).OS = 'web';
    (globalThis as any).Notification = undefined;
    await expect(getNotificationPermission()).resolves.toEqual({ granted: true, canAskAgain: true });
  });
});

describe('requestNotificationPermission', () => {
  it('creates the Android channel first and then shows the request of the system', async () => {
    mocked.requestPermissionsAsync.mockResolvedValue(perms(true, true));
    await expect(requestNotificationPermission()).resolves.toEqual({ granted: true, canAskAgain: true });
    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith('default', expect.objectContaining({ name: 'Alertas' }));
    expect(mocked.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mocked.requestPermissionsAsync.mock.invocationCallOrder[0],
    );
  });

  it('does not create the channel outside Android', async () => {
    (Platform as any).OS = 'ios';
    mocked.requestPermissionsAsync.mockResolvedValue(perms(false, true));
    await requestNotificationPermission();
    expect(mocked.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('counts as denied, asking again later, when the request fails', async () => {
    mocked.requestPermissionsAsync.mockRejectedValue(new Error('boom'));
    await expect(requestNotificationPermission()).resolves.toEqual({ granted: false, canAskAgain: true });
  });

  it('asks the browser on the web', async () => {
    (Platform as any).OS = 'web';
    (globalThis as any).Notification = { requestPermission: jest.fn().mockResolvedValue('denied') };
    await expect(requestNotificationPermission()).resolves.toEqual({ granted: false, canAskAgain: false });
    (globalThis as any).Notification = { requestPermission: jest.fn().mockResolvedValue('granted') };
    await expect(requestNotificationPermission()).resolves.toEqual({ granted: true, canAskAgain: false });
  });
});

describe('ensureAndroidChannel', () => {
  it('does nothing outside Android', async () => {
    (Platform as any).OS = 'ios';
    await ensureAndroidChannel(Notifications);
    expect(mocked.setNotificationChannelAsync).not.toHaveBeenCalled();
  });
});

describe('ensureNotificationPermission', () => {
  it('goes on without asking when the permission is already given', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(perms(true, true));
    await expect(ensureNotificationPermission()).resolves.toBe('granted');
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('shows the request of the system when the permission was not given yet, and is granted if the user accepts', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(perms(false, true));
    mocked.requestPermissionsAsync.mockResolvedValue(perms(true, true));
    await expect(ensureNotificationPermission()).resolves.toBe('granted');
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('is denied, so it can be asked again, when the user refuses the request', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(perms(false, true));
    mocked.requestPermissionsAsync.mockResolvedValue(perms(false, true));
    await expect(ensureNotificationPermission()).resolves.toBe('denied');
  });

  it('is blocked, with no request shown, when the user chose to never allow it', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(perms(false, false));
    await expect(ensureNotificationPermission()).resolves.toBe('blocked');
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('is blocked when the user refuses the request choosing never to allow it', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(perms(false, true));
    mocked.requestPermissionsAsync.mockResolvedValue(perms(false, false));
    await expect(ensureNotificationPermission()).resolves.toBe('blocked');
  });
});
