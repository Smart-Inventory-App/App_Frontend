import authApi from '../src/services/authApi';
import { getAuthToken, setAuthToken, setUnauthorizedHandler } from '../src/services/api';

// Sin mockear api: un 401 del servicio de auth tiene que cerrar la sesión igual que uno del backend
const rejected = () => (authApi.interceptors.response as any).handlers[0].rejected;

afterEach(() => {
  setAuthToken(null);
  setUnauthorizedHandler(null);
});

describe('authApi - expired session', () => {
  it('ends the session once, clearing the token first, when /auth/me answers 401', async () => {
    const handler = jest.fn(() => { expect(getAuthToken()).toBeNull(); });
    setAuthToken('tok');
    setUnauthorizedHandler(handler);
    const error = { response: { status: 401 } };
    await expect(rejected()(error)).rejects.toBe(error);
    await expect(rejected()(error)).rejects.toBe(error);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not end the session for a network error or a server error', async () => {
    const handler = jest.fn();
    setAuthToken('tok');
    setUnauthorizedHandler(handler);
    await expect(rejected()({ message: 'Network Error' })).rejects.toBeTruthy();
    await expect(rejected()({ response: { status: 500 } })).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
    expect(getAuthToken()).toBe('tok');
  });
});
