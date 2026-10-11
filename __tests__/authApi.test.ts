import authApi from '../src/services/authApi';
import { getAuthToken } from '../src/services/api';

jest.mock('../src/services/api', () => ({
  getAuthToken: jest.fn(),
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
});
