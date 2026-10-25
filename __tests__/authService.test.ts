import * as axiosModule from 'axios';
import { authService } from '../src/services/authService';
import { getFirebaseToken } from '../src/services/firebaseService';

jest.mock('axios', () => {
  const mockPost = jest.fn();
  return {
    __esModule: true,
    default: { create: jest.fn(() => ({ post: mockPost })) },
    __mockPost: mockPost,
  };
});

jest.mock('../src/services/firebaseService', () => ({
  getFirebaseToken: jest.fn().mockResolvedValue('fcm-token'),
}));

const mockPost = (axiosModule as unknown as { __mockPost: jest.Mock }).__mockPost;

beforeEach(() => {
  mockPost.mockReset();
  (getFirebaseToken as jest.Mock).mockClear().mockResolvedValue('fcm-token');
});

describe('authService', () => {
  it('login sends the firebase token along with credentials', async () => {
    mockPost.mockResolvedValue({ data: { access_token: 'a', token_type: 'bearer' } });
    const result = await authService.login('a@b.com', 'pw');
    expect(result).toEqual({ access_token: 'a', token_type: 'bearer' });
    expect(mockPost).toHaveBeenCalledWith('/auth/login', {
      email: 'a@b.com',
      password: 'pw',
      firebase_token: 'fcm-token',
    });
  });

  it('register posts email and password', async () => {
    mockPost.mockResolvedValue({ data: undefined });
    await authService.register('a@b.com', 'pw');
    expect(mockPost).toHaveBeenCalledWith('/auth/register', { email: 'a@b.com', password: 'pw' });
  });

  it('checkEmail returns whether the email exists', async () => {
    mockPost.mockResolvedValue({ data: { exists: true } });
    await expect(authService.checkEmail('a@b.com')).resolves.toBe(true);
  });

  it('forgotPassword posts the email', async () => {
    mockPost.mockResolvedValue({ data: undefined });
    await authService.forgotPassword('a@b.com');
    expect(mockPost).toHaveBeenCalledWith('/auth/forgot-password', { email: 'a@b.com' });
  });

  it('verifyCode returns the reset token', async () => {
    mockPost.mockResolvedValue({ data: { reset_token: 'rt' } });
    await expect(authService.verifyCode('a@b.com', '123456')).resolves.toBe('rt');
  });

  it('resetPassword posts the new password', async () => {
    mockPost.mockResolvedValue({ data: undefined });
    await authService.resetPassword('rt', 'newpw');
    expect(mockPost).toHaveBeenCalledWith('/auth/reset-password', { reset_token: 'rt', new_password: 'newpw' });
  });

  it('checkNewPassword returns whether the new password differs from the current one', async () => {
    mockPost.mockResolvedValue({ data: { different: false } });
    await expect(authService.checkNewPassword('rt', 'pw')).resolves.toBe(false);
    expect(mockPost).toHaveBeenCalledWith('/auth/check-new-password', { reset_token: 'rt', new_password: 'pw' });
  });

  it('getEmailStatus says if the email has an account and if that account already has a password', async () => {
    mockPost.mockResolvedValue({ data: { exists: true, password_set: false } });
    await expect(authService.getEmailStatus('a@b.com')).resolves.toEqual({ exists: true, password_set: false });
    expect(mockPost).toHaveBeenCalledWith('/auth/check-email', { email: 'a@b.com' });
  });

  it('getEmailStatus has no password data for an email without account', async () => {
    mockPost.mockResolvedValue({ data: { exists: false } });
    await expect(authService.getEmailStatus('a@b.com')).resolves.toEqual({ exists: false });
  });

  it('googleLogin exchanges the id token of Google', async () => {
    mockPost.mockResolvedValue({ data: { access_token: 'g', token_type: 'bearer' } });
    await expect(authService.googleLogin('g-token')).resolves.toEqual({ access_token: 'g', token_type: 'bearer' });
    expect(mockPost).toHaveBeenCalledWith('/auth/google', { id_token: 'g-token' });
  });
});
