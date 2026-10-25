import { Platform } from 'react-native';

const mockConfigure = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
}));

const originalOS = Platform.OS;

// El servicio lee las variables y la plataforma al cargarse: cada prueba lo carga de nuevo
function load(env: { web?: string; android?: string }, os: 'android' | 'ios' | 'web' = 'android') {
  (Platform as any).OS = os;
  if (env.web === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = env.web;
  if (env.android === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  else process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = env.android;
  let service: typeof import('../src/services/googleSignIn');
  jest.isolateModules(() => {
    require('react-native').Platform.OS = os;
    service = require('../src/services/googleSignIn');
  });
  return service!;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue(undefined);
});

afterEach(() => {
  (Platform as any).OS = originalOS;
  delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
});

describe('googleSignIn - when it is enabled', () => {
  it('is enabled on the phone with the Web client id, and the Android client id is not needed', () => {
    expect(load({ web: 'web-id' }, 'android').GOOGLE_ENABLED).toBe(true);
    expect(load({ web: 'web-id' }, 'ios').GOOGLE_ENABLED).toBe(true);
    expect(load({ web: 'web-id', android: 'android-id' }).GOOGLE_ENABLED).toBe(true);
  });

  it('is disabled without the Web client id, even with the Android one', () => {
    expect(load({}).GOOGLE_ENABLED).toBe(false);
    expect(load({ web: '' }).GOOGLE_ENABLED).toBe(false);
    expect(load({ android: 'android-id' }).GOOGLE_ENABLED).toBe(false);
  });

  it('is disabled on the web, where the library does not work', () => {
    expect(load({ web: 'web-id', android: 'android-id' }, 'web').GOOGLE_ENABLED).toBe(false);
  });
});

describe('googleSignIn - configure', () => {
  it('configures the library with the Web client id, only once', () => {
    const service = load({ web: 'web-id' });
    service.configureGoogleSignIn();
    service.configureGoogleSignIn();
    expect(mockConfigure).toHaveBeenCalledTimes(1);
    expect(mockConfigure).toHaveBeenCalledWith({ webClientId: 'web-id' });
  });

  it('does not touch the library when Google is disabled', () => {
    load({}).configureGoogleSignIn();
    load({ web: 'web-id' }, 'web').configureGoogleSignIn();
    expect(mockConfigure).not.toHaveBeenCalled();
  });
});

describe('googleSignIn - sign out', () => {
  it('signs out of Google on the phone', async () => {
    await load({ web: 'web-id' }).signOutFromGoogle();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('does nothing when Google is disabled', async () => {
    await load({}).signOutFromGoogle();
    await load({ web: 'web-id' }, 'web').signOutFromGoogle();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('never fails, even if Google can not sign out', async () => {
    mockSignOut.mockRejectedValue(new Error('boom'));
    await expect(load({ web: 'web-id' }).signOutFromGoogle()).resolves.toBeUndefined();
  });
});
