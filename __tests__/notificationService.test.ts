import authApi from '../src/services/authApi';
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

// /auth/firebase-token vive en el servicio de auth, no en app_backend: tiene que ir por authApi.
jest.mock('../src/services/authApi', () => ({
  __esModule: true,
  default: { patch: jest.fn() },
}));

const mockedAuthApi = authApi as jest.Mocked<typeof authApi>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('notificationService.registerTokenWithBackend', () => {
  it('patches the auth service with the token', async () => {
    mockedAuthApi.patch.mockResolvedValue({});
    await registerTokenWithBackend('tok');
    expect(mockedAuthApi.patch).toHaveBeenCalledWith('/auth/firebase-token', { firebase_token: 'tok' });
  });

  it('swallows a failure silently, so the caller keeps working', async () => {
    mockedAuthApi.patch.mockRejectedValue(new Error('down'));
    await expect(registerTokenWithBackend('tok')).resolves.toBeUndefined();
  });
});
