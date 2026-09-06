jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Firebase SDK uses ESM and can't run in Jest — mock at the root so all tests are unaffected
jest.mock('./src/services/firebaseService', () => ({
  getFirebaseToken: jest.fn().mockResolvedValue(null),
  initNotifications: jest.fn().mockResolvedValue(undefined),
  messaging: null,
}));

jest.mock('./src/services/notificationService', () => ({
  getFirebaseToken: jest.fn().mockResolvedValue(null),
  registerTokenWithBackend: jest.fn().mockResolvedValue(undefined),
  setupForegroundHandler: jest.fn(),
  subscribeToTokenRefresh: jest.fn().mockReturnValue(() => {}),
}));
