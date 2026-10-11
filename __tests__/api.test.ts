import api, { getAuthToken, setAuthToken, setUnauthorizedHandler } from '../src/services/api';

describe('api instance', () => {
  afterEach(() => {
    setAuthToken(null);
    setUnauthorizedHandler(null);
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

describe('expired session handling', () => {
  const rejected = () => (api.interceptors.response as any).handlers[0].rejected;

  afterEach(() => {
    setAuthToken(null);
    setUnauthorizedHandler(null);
  });

  it('notifies the handler once on a 401 while a session is active, clearing the token first', async () => {
    const handler = jest.fn(() => {
      expect(getAuthToken()).toBeNull();
    });
    setAuthToken('tok');
    setUnauthorizedHandler(handler);
    const error = { response: { status: 401 } };
    await expect(rejected()(error)).rejects.toBe(error);
    await expect(rejected()(error)).rejects.toBe(error);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores a 401 when there is no active session', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    const error = { response: { status: 401 } };
    await expect(rejected()(error)).rejects.toBe(error);
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores other error statuses', async () => {
    const handler = jest.fn();
    setAuthToken('tok');
    setUnauthorizedHandler(handler);
    const error = { response: { status: 500 } };
    await expect(rejected()(error)).rejects.toBe(error);
    expect(handler).not.toHaveBeenCalled();
    expect(getAuthToken()).toBe('tok');
  });

  it('does not fail when no handler is registered', async () => {
    setAuthToken('tok');
    const error = { response: { status: 401 } };
    await expect(rejected()(error)).rejects.toBe(error);
    expect(getAuthToken()).toBe('tok');
  });
});
