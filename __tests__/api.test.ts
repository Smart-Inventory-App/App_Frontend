import api, { getAuthToken, setAuthToken } from '../src/services/api';

describe('api instance', () => {
  afterEach(() => {
    setAuthToken(null);
  });

  it('has no token by default', () => {
    expect(getAuthToken()).toBeNull();
  });

  it('stores and returns the auth token', () => {
    setAuthToken('abc123');
    expect(getAuthToken()).toBe('abc123');
  });

  it('clears the token when set to null', () => {
    setAuthToken('abc123');
    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
  });

  it('attaches the Authorization header on requests when a token is set', () => {
    setAuthToken('tok');
    const config = { headers: {} } as any;
    const interceptor = (api.interceptors.request as any).handlers[0].fulfilled;
    const result = interceptor(config);
    expect(result.headers['Authorization']).toBe('Bearer tok');
  });

  it('does not attach an Authorization header when there is no token', () => {
    setAuthToken(null);
    const config = { headers: {} } as any;
    const interceptor = (api.interceptors.request as any).handlers[0].fulfilled;
    const result = interceptor(config);
    expect(result.headers['Authorization']).toBeUndefined();
  });

  it('passes through successful responses unchanged', () => {
    const response = { data: { ok: true } } as any;
    const interceptor = (api.interceptors.response as any).handlers[0].fulfilled;
    expect(interceptor(response)).toBe(response);
  });

  it('rejects with the original error on response failure', async () => {
    const error = new Error('network error');
    const interceptor = (api.interceptors.response as any).handlers[0].rejected;
    await expect(interceptor(error)).rejects.toBe(error);
  });
});
