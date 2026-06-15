import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  lowStock: 'settings_lowStockThreshold',
  expiryDays: 'settings_expiryDaysThreshold',
};

const DEFAULTS = {
  lowStock: 5,
  expiryDays: 7,
};

export const settingsService = {
  async getLowStockThreshold(): Promise<number> {
    const v = await AsyncStorage.getItem(KEYS.lowStock);
    return v !== null ? parseInt(v, 10) : DEFAULTS.lowStock;
  },
  async getExpiryDaysThreshold(): Promise<number> {
    const v = await AsyncStorage.getItem(KEYS.expiryDays);
    return v !== null ? parseInt(v, 10) : DEFAULTS.expiryDays;
  },
  async setLowStockThreshold(value: number): Promise<void> {
    await AsyncStorage.setItem(KEYS.lowStock, String(value));
  },
  async setExpiryDaysThreshold(value: number): Promise<void> {
    await AsyncStorage.setItem(KEYS.expiryDays, String(value));
  },
  async getAll(): Promise<{ lowStock: number; expiryDays: number }> {
    const [ls, ed] = await Promise.all([
      AsyncStorage.getItem(KEYS.lowStock),
      AsyncStorage.getItem(KEYS.expiryDays),
    ]);
    return {
      lowStock: ls !== null ? parseInt(ls, 10) : DEFAULTS.lowStock,
      expiryDays: ed !== null ? parseInt(ed, 10) : DEFAULTS.expiryDays,
    };
  },
};
