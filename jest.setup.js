jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Sin SafeAreaProvider en los tests: los márgenes seguros valen 0 (o lo que indique un provider propio del test)
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Las fuentes se cargan de forma asíncrona y avisan con un setState que ningún test espera: en los tests se dan por
// cargadas desde el primer render (así no hay actualizaciones de estado fuera de act)
jest.mock('@expo-google-fonts/figtree', () => ({
  ...jest.requireActual('@expo-google-fonts/figtree'),
  useFonts: () => [true, null],
}));

// Lo mismo con las fuentes de los íconos: se dan por cargadas y no hay un setState tardío en cada <Icon>
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  isLoaded: () => true,
}));

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

// Initialize real i18next resources synchronously so components using
// useTranslation() render actual (Spanish) copy in tests instead of raw keys.
const i18n = require('i18next');
const { initReactI18next } = require('react-i18next');
const es = require('./src/i18n/locales/es').default;
const en = require('./src/i18n/locales/en').default;

i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
  initImmediate: false,
});
