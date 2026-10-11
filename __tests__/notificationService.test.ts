import api from '../src/services/api';
import { registerTokenWithBackend } from '../src/services/notificationService';

// jest.setup.js stubs this module globally for every other test file (Firebase's
// SDK can't run in Jest); this file opts back in to test the real implementation.
//
// Note: only `registerTokenWithBackend` is covered here. The rest of this module
// (`getFirebaseToken`, `setupForegroundHandler`, `subscribeToTokenRefresh`) uses
// dynamic `import("expo-notifications")` / `import("./firebaseService")`, which
// this project's Jest config (no `--experimental-vm-modules`) cannot execute —
// it throws `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG` and crashes the worker.
jest.unmock('../src/services/notificationService');

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { patch: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('notificationService.registerTokenWithBackend', () => {
  it('patches the backend with the token', async () => {
    mockedApi.patch.mockResolvedValue({});
    await registerTokenWithBackend('tok');
    expect(mockedApi.patch).toHaveBeenCalledWith('/auth/firebase-token', { firebase_token: 'tok' });
  });

  it('swallows a failure silently, so the caller keeps working', async () => {
    mockedApi.patch.mockRejectedValue(new Error('down'));
    await expect(registerTokenWithBackend('tok')).resolves.toBeUndefined();
  });
});
