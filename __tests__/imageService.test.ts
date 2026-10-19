import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { getAuthToken } from '../src/services/api';
import { pickFromCamera, pickFromGallery, uploadImage } from '../src/services/imageService';

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

  it('returns the picked image without uploading it: it is uploaded after the user confirms', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    const asset = { uri: 'file://a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg' };
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [asset] });

    await expect(pickFromGallery()).resolves.toBe(asset);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('does not offer to crop the image', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
    await pickFromGallery();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false }));
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

  it('returns the captured photo without uploading it, and without offering to crop it', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    const asset = { uri: 'file://b.jpg' };
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [asset] });

    await expect(pickFromCamera()).resolves.toBe(asset);
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false }));
  });
});

describe('imageService.uploadImage', () => {
  it('uploads the image and returns its url, attaching the auth token', async () => {
    (getAuthToken as jest.Mock).mockReturnValue('tok123');
    mockedAxios.post.mockResolvedValue({ data: { url: 'https://cdn/a.jpg' } });

    await expect(uploadImage({ uri: 'file://a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg' } as any)).resolves.toBe('https://cdn/a.jpg');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/storage/upload'),
      expect.any(FormData),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
      }),
    );
  });

  it('uploads without an Authorization header when there is no token', async () => {
    (getAuthToken as jest.Mock).mockReturnValue(null);
    mockedAxios.post.mockResolvedValue({ data: { url: 'https://cdn/a.jpg' } });

    await uploadImage({ uri: 'file://a.jpg' } as any);
    const headers = mockedAxios.post.mock.calls[0][2]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
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
    (getAuthToken as jest.Mock).mockReturnValue(null);
    mockedAxios.post.mockResolvedValue({ data: { url: 'https://cdn/p.png' } });

    await expect(
      uploadImage({ uri: 'blob:http://localhost/2', fileName: 'p.png', mimeType: 'image/png' } as any),
    ).resolves.toBe('https://cdn/p.png');

    const form = mockedAxios.post.mock.calls[0][1] as any;
    expect(form.get('file')).toBeInstanceOf(Blob);
    expect(form.get('folder')).toBe('tpp/products');
  });
});
