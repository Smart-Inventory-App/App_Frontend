import authApi from '../src/services/authApi';
import { getAuthToken, handleUnauthorized } from '../src/services/api';

jest.mock('../src/services/api', () => ({
  getAuthToken: jest.fn(),
  handleUnauthorized: jest.fn(),
}));

describe('authApi instance', () => {
  it('attaches the Authorization header when a token is present', () => {
    (getAuthToken as jest.Mock).mockReturnValue('tok');
    const config = { headers: {} } as any;
    const interceptor = (authApi.interceptors.request as any).handlers[0].fulfilled;
    const result = interceptor(config);
    expect(result.headers['Authorization']).toBe('Bearer tok');
  });

  it('does not attach a header when there is no token', () => {
    (getAuthToken as jest.Mock).mockReturnValue(null);
    const config = { headers: {} } as any;
    const interceptor = (authApi.interceptors.request as any).handlers[0].fulfilled;
    const result = interceptor(config);
    expect(result.headers['Authorization']).toBeUndefined();
  });

  it('lets the session end when the auth service rejects the token, and keeps rejecting the request', async () => {
    const rejected = (authApi.interceptors.response as any).handlers[0].rejected;
    const error = { response: { status: 401 } };
    await expect(rejected(error)).rejects.toBe(error);
    expect(handleUnauthorized).toHaveBeenCalledWith(error);
  });

  it('passes successful responses through', () => {
    const fulfilled = (authApi.interceptors.response as any).handlers[0].fulfilled;
    const response = { status: 200 };
    expect(fulfilled(response)).toBe(response);
  });
});
