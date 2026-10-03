import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '../src/utils/storage';

describe('storage', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns null when the key is missing', async () => {
    await expect(storage.get('missing')).resolves.toBeNull();
  });

  it('round-trips a JSON-serializable value', async () => {
    await storage.set('key', { a: 1, b: ['x', 'y'] });
    await expect(storage.get('key')).resolves.toEqual({ a: 1, b: ['x', 'y'] });
  });

  it('removes a key', async () => {
    await storage.set('key', 'value');
    await storage.remove('key');
    await expect(storage.get('key')).resolves.toBeNull();
  });

  it('clears every key', async () => {
    await storage.set('a', 1);
    await storage.set('b', 2);
    await storage.clear();
    await expect(storage.get('a')).resolves.toBeNull();
    await expect(storage.get('b')).resolves.toBeNull();
  });
});
