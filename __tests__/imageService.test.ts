import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { getAuthToken } from '../src/services/api';
import { pickFromCamera, pickFromGallery } from '../src/services/imageService';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock('../src/services/api', () => ({
  __esModule: true,
  getAuthToken: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('imageService.pickFromGallery', () => {
  it('throws when permission is denied', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    await expect(pickFromGallery()).rejects.toThrow(/galería/);
  });

  it('returns null when the user cancels', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
    await expect(pickFromGallery()).resolves.toBeNull();
  });

  it('uploads the picked asset and returns its url, attaching the auth token', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg' }],
    });
    (getAuthToken as jest.Mock).mockReturnValue('tok123');
    mockedAxios.post.mockResolvedValue({ data: { url: 'https://cdn/a.jpg' } });

    await expect(pickFromGallery()).resolves.toBe('https://cdn/a.jpg');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/storage/upload'),
      expect.any(FormData),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
      }),
    );
  });

  it('uploads without an Authorization header when there is no token', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://a.jpg' }],
    });
    (getAuthToken as jest.Mock).mockReturnValue(null);
    mockedAxios.post.mockResolvedValue({ data: { url: 'https://cdn/a.jpg' } });

    await pickFromGallery();
    const headers = mockedAxios.post.mock.calls[0][2]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe('imageService.pickFromCamera', () => {
  it('throws when permission is denied', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    await expect(pickFromCamera()).rejects.toThrow(/cámara/);
  });

  it('returns null when the user cancels', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true });
    await expect(pickFromCamera()).resolves.toBeNull();
  });

  it('uploads the captured photo and returns its url', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://b.jpg' }],
    });
    (getAuthToken as jest.Mock).mockReturnValue('tok');
    mockedAxios.post.mockResolvedValue({ data: { url: 'https://cdn/b.jpg' } });

    await expect(pickFromCamera()).resolves.toBe('https://cdn/b.jpg');
  });
});

describe('imageService (web)', () => {
  const originalFetch = (global as any).fetch;

  afterEach(() => {
    (Platform as any).OS = 'ios';
    (global as any).fetch = originalFetch;
  });

  it('sube un Blob real y guarda la imagen en la carpeta tpp/products', async () => {
    (Platform as any).OS = 'web';
    const blob = new (Blob as any)(['x'], { type: 'image/png' });
    (global as any).fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'blob:http://localhost/2', fileName: 'p.png', mimeType: 'image/png' }],
    });
    (getAuthToken as jest.Mock).mockReturnValue(null);
    mockedAxios.post.mockResolvedValue({ data: { url: 'https://cdn/p.png' } });

    await expect(pickFromGallery()).resolves.toBe('https://cdn/p.png');

    const form = mockedAxios.post.mock.calls[0][1] as any;
    expect(form.get('file')).toBeInstanceOf(Blob);
    expect(form.get('folder')).toBe('tpp/products');
  });
});
