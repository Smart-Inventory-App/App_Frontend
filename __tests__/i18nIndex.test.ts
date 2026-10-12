import AsyncStorage from '@react-native-async-storage/async-storage';
import { initI18n, changeLanguage, i18n } from '../src/i18n';

describe('i18n/index', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('initializes using the language stored in AsyncStorage when present', async () => {
    await AsyncStorage.setItem('app_language', 'en');
    await initI18n();
    expect(i18n.language).toBe('en');
  });

  it('falls back to the device/app default when nothing is stored', async () => {
    await initI18n();
    expect(['es', 'en']).toContain(i18n.language);
  });

  it('changeLanguage updates the active language and persists the choice', async () => {
    await changeLanguage('es');
    expect(i18n.language).toBe('es');
    await expect(AsyncStorage.getItem('app_language')).resolves.toBe('es');

    await changeLanguage('en');
    expect(i18n.language).toBe('en');
    await expect(AsyncStorage.getItem('app_language')).resolves.toBe('en');
  });
});
