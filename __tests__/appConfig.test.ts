import fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require('../app.config');

const baseConfig = {
  name: 'Smart Inventory',
  android: { package: 'com.smartinventory.app' },
};

const originalEnv = process.env.GOOGLE_SERVICES_JSON;

afterEach(() => {
  jest.restoreAllMocks();
  if (originalEnv === undefined) delete process.env.GOOGLE_SERVICES_JSON;
  else process.env.GOOGLE_SERVICES_JSON = originalEnv;
});

describe('app.config.js', () => {
  it('uses the file provided by EAS through GOOGLE_SERVICES_JSON', () => {
    process.env.GOOGLE_SERVICES_JSON = '/tmp/eas/google-services.json';

    const result = appConfig({ config: baseConfig });

    expect(result.android.googleServicesFile).toBe('/tmp/eas/google-services.json');
    expect(result.android.package).toBe('com.smartinventory.app');
  });

  it('falls back to the local google-services.json when it exists', () => {
    delete process.env.GOOGLE_SERVICES_JSON;
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = appConfig({ config: baseConfig });

    expect(result.android.googleServicesFile).toBe('./google-services.json');
  });

  it('leaves the config untouched when there are no Firebase credentials', () => {
    delete process.env.GOOGLE_SERVICES_JSON;
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = appConfig({ config: baseConfig });

    expect(result).toEqual(baseConfig);
  });
});
